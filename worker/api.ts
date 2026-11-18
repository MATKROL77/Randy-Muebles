import { DISCLAIMER, PRICES, RULES, configProperties, demoQuote, enforce, placardVariants, type ItemKey, type PriceLine } from "../src/lib/randy.ts";

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
  /**
   * Los productos de la tienda, en JSON:
   * { "placard": "<id del producto Placard a medida>", "url": "/productos/<su dirección>/", "items": { "cajon": "<id>", ... } }
   */
  TN_PRODUCTS?: string;
};

export type StoreProducts = { placard: string | null; /** dirección de la ficha del placard en la tienda */ url: string | null; items: Partial<Record<ItemKey, string>> };

export type SavedConfig = {
  id: string;
  config: unknown;
  properties: { name: string; value: string }[];
  /** el precio validado, renglón por renglón */
  lines: PriceLine[];
  price: number;
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

export function storeProducts(env: Env): StoreProducts {
  try {
    const v = JSON.parse(env.TN_PRODUCTS ?? "{}") as Partial<StoreProducts> | null;
    return { placard: v?.placard ? String(v.placard) : null, url: typeof v?.url === "string" ? v.url : null, items: v?.items && typeof v.items === "object" ? v.items : {} };
  } catch {
    return { placard: null, url: null, items: {} };
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

    // el catálogo de la demo: reglas, lista de precios y las variantes de tamaño. Es lo que hay que cargar en la tienda
    if (path === "/api/tn/catalog" && request.method === "GET") {
      return json({ demo: true, disclaimer: DISCLAIMER, rules: RULES, prices: PRICES, products: storeProducts(env), variants: placardVariants() }, 200, h);
    }

    // valida y cotiza sin guardar
    if (path === "/api/tn/quote" && request.method === "POST") {
      const body = await readBody(request);
      if (!body) return json({ error: "pedido_invalido" }, 400, h);
      const config = enforce(body.config as never);
      return json({ config, ...demoQuote(config), properties: configProperties(config) }, 200, h);
    }

    // valida, cotiza y guarda: devuelve el identificador que viaja con el carrito
    if (path === "/api/tn/configs" && request.method === "POST") {
      const body = await readBody(request);
      if (!body) return json({ error: "pedido_invalido" }, 400, h);
      const products = storeProducts(env);
      const productId = typeof body.productId === "string" || typeof body.productId === "number" ? String(body.productId).slice(0, 24) : null;
      // el configurador solo vende el producto de la tienda que tiene vinculado
      if (productId && products.placard && productId !== products.placard) return json({ error: "producto_no_vinculado" }, 400, h);
      const config = enforce(body.config as never);
      const q = demoQuote(config);
      const saved: SavedConfig = {
        id: newId(),
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
      return json({ ...saved, products, disclaimer: DISCLAIMER, hasSnapshot: !!snapshot }, 201, h);
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
