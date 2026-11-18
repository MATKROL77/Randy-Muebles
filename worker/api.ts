import { DISCLAIMER, EXTRA_UNIT, MODELS, RULES, basePrice, configProperties, demoQuote, enforce, modelById } from "../src/lib/randy.ts";

/** lo mínimo de un KV: así las pruebas usan un Map */
export type Store = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type Env = {
  CONFIGS: Store;
  /** "dev" | "staging" | "production" */
  ENVIRONMENT?: string;
  /** orígenes de tienda que pueden usar la API, separados por coma */
  ALLOWED_ORIGINS?: string;
  /** producto "Adicionales de personalización" de la tienda */
  TN_EXTRAS_PRODUCT_ID?: string;
  /** JSON: { "<id de producto en la tienda>": "<id de modelo>" } */
  TN_PRODUCT_MODELS?: string;
};

export type SavedConfig = {
  id: string;
  model: string;
  modelName: string;
  config: unknown;
  properties: { name: string; value: string }[];
  price: number;
  base: number;
  extraUnits: number;
  productId: string | null;
  origin: string | null;
  createdAt: string;
  demo: true;
};

const MAX_BODY = 24_000;
const MAX_SNAPSHOT = 220_000;
/** una configuración de demo se guarda 180 días */
const TTL = 60 * 60 * 24 * 180;
const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `RM-${[...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("")}`;
}

const isId = (v: string) => /^RM-[2-9A-HJ-NP-Z]{8}$/.test(v);

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const self = new URL(request.url).origin;
  const ok = origin && (origin === self || allowed.includes(origin));
  return ok ? { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } : {};
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

function productModels(env: Env): Record<string, string> {
  try {
    const v = JSON.parse(env.TN_PRODUCT_MODELS ?? "{}");
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY + MAX_SNAPSHOT) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const h = cors(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

  try {
    if (path === "/api/health" && request.method === "GET") return json({ ok: true, environment: env.ENVIRONMENT ?? "dev" }, 200, h);

    // el catálogo de la demo: modelos, rangos y precio "desde". Es lo que hay que cargar en la tienda
    if (path === "/api/tn/catalog" && request.method === "GET") {
      return json(
        {
          demo: true,
          disclaimer: DISCLAIMER,
          extraUnit: EXTRA_UNIT,
          extrasProductId: env.TN_EXTRAS_PRODUCT_ID ?? null,
          products: productModels(env),
          rules: RULES,
          models: MODELS.map((m) => ({ id: m.id, name: m.name, leaves: m.leaves, width: m.width, basePrice: basePrice(m) })),
        },
        200,
        h,
      );
    }

    // valida y cotiza sin guardar
    if (path === "/api/tn/quote" && request.method === "POST") {
      const body = await readBody(request);
      const model = modelById(String(body?.model ?? ""));
      if (!body || !model) return json({ error: "modelo_desconocido" }, 400, h);
      const config = enforce(model, body.config as never);
      return json({ model: model.id, config, ...demoQuote(model, config), properties: configProperties(config) }, 200, h);
    }

    // valida, cotiza y guarda: devuelve el identificador que viaja con el carrito
    if (path === "/api/tn/configs" && request.method === "POST") {
      const body = await readBody(request);
      const model = modelById(String(body?.model ?? ""));
      if (!body || !model) return json({ error: "modelo_desconocido" }, 400, h);
      const productId = typeof body.productId === "string" || typeof body.productId === "number" ? String(body.productId).slice(0, 24) : null;
      // si el producto de la tienda está vinculado a un modelo, tiene que ser este
      const linked = productId ? productModels(env)[productId] : undefined;
      if (linked && linked !== model.id) return json({ error: "producto_de_otro_modelo" }, 400, h);
      const config = enforce(model, body.config as never);
      const q = demoQuote(model, config);
      const saved: SavedConfig = {
        id: newId(),
        model: model.id,
        modelName: model.name,
        config,
        properties: configProperties(config),
        ...q,
        productId,
        origin: request.headers.get("Origin"),
        createdAt: new Date().toISOString(),
        demo: true,
      };
      await env.CONFIGS.put(`cfg:${saved.id}`, JSON.stringify(saved), { expirationTtl: TTL });
      const snapshot = typeof body.snapshot === "string" && body.snapshot.startsWith("data:image/jpeg;base64,") && body.snapshot.length <= MAX_SNAPSHOT ? body.snapshot : null;
      if (snapshot) await env.CONFIGS.put(`img:${saved.id}`, snapshot, { expirationTtl: TTL });
      return json({ ...saved, extrasProductId: env.TN_EXTRAS_PRODUCT_ID ?? null, extraUnit: EXTRA_UNIT, disclaimer: DISCLAIMER, hasSnapshot: !!snapshot }, 201, h);
    }

    // recuperar una configuración guardada: para el carrito, el pedido o el taller
    const one = path.match(/^\/api\/tn\/configs\/([^/]+)(\/snapshot)?$/);
    if (one && request.method === "GET") {
      const id = one[1].toUpperCase();
      if (!isId(id)) return json({ error: "identificador_invalido" }, 400, h);
      if (one[2]) {
        const img = await env.CONFIGS.get(`img:${id}`);
        if (!img) return json({ error: "sin_imagen" }, 404, h);
        const bytes = Uint8Array.from(atob(img.slice(img.indexOf(",") + 1)), (c) => c.charCodeAt(0));
        return new Response(bytes, { status: 200, headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", ...h } });
      }
      const raw = await env.CONFIGS.get(`cfg:${id}`);
      if (!raw) return json({ error: "no_encontrada" }, 404, h);
      return json(JSON.parse(raw), 200, h);
    }

    return json({ error: "no_encontrado" }, 404, h);
  } catch {
    return json({ error: "error_interno" }, 500, h);
  }
}
