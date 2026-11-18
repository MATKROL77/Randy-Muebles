import assert from "node:assert/strict";
import { test } from "node:test";

import { handle, type Env } from "../api.ts";
import { PRICES, RULES, demoQuote, enforce, initialConfig, modulesFor, placardVariants, withModules } from "../../src/lib/randy.ts";
import type { ModuleConfig } from "../../src/lib/model.ts";

function env(): Env & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    CONFIGS: { get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) },
    ENVIRONMENT: "test",
    ALLOWED_ORIGINS: "https://tienda.example",
    TN_PRODUCTS: JSON.stringify({ placard: "111", items: { cajon: "201", espejo: "202" } }),
  };
}
const post = (path: string, body: unknown, origin = "https://tienda.example") =>
  new Request(`https://rm.example${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
const get = (path: string) => new Request(`https://rm.example${path}`);
const mod = (layout: ModuleConfig["layout"], extra: Partial<ModuleConfig> = {}): ModuleConfig => ({ layout, shelves: 0, drawers: 0, trays: 0, width: 0, ledShelves: false, ledSides: false, ...extra });
const line = (q: ReturnType<typeof demoQuote>, key: string) => q.lines.find((l) => l.kind === "item" && l.key === key);

test("arranque: dos módulos, corredizas, dentro de las reglas", () => {
  const c = initialConfig();
  assert.equal(c.doors, "sliding");
  assert.equal(c.shape, "straight");
  assert.equal(c.runs[0].modules.length, 2);
  for (const x of c.runs[0].modules) assert.ok(x.width >= RULES.module.min - 0.5);
});

test("precio: el total es la suma de los renglones y cada renglón es cantidad × precio de lista", () => {
  const c = enforce({ ...initialConfig(), leaves: [{ style: "mirror" }, null] });
  const q = demoQuote(c);
  assert.equal(q.price, q.lines.reduce((s, l) => s + l.total, 0));
  for (const l of q.lines) assert.equal(l.total, l.qty * l.unit);
  assert.equal(q.lines[0].kind, "placard");
  assert.equal(line(q, "espejo")!.qty, 1);
  assert.equal(line(q, "espejo")!.unit, PRICES.items.espejo.unit);
});

test("precio del placard: sube con cada medida y coincide con su variante de la tienda", () => {
  const variants = placardVariants();
  assert.equal(variants.length, PRICES.placard.widths.length * PRICES.placard.heights.length * PRICES.placard.depths.length);
  assert.equal(new Set(variants.map((v) => v.values.join("|"))).size, variants.length);
  const base = initialConfig();
  const at = (patch: Parameters<typeof enforce>[0]) => demoQuote(enforce({ ...base, ...patch })).lines[0];
  const small = at({ height: 2200, depth: 550, runs: [{ width: 1260, modules: base.runs[0].modules }] });
  assert.equal(small.unit, PRICES.placard.base);
  assert.ok(at({ runs: [{ width: 2000, modules: base.runs[0].modules }] }).unit > at({ runs: [{ width: 1600, modules: base.runs[0].modules }] }).unit);
  assert.ok(at({ height: 2500 }).unit > at({ height: 2000 }).unit);
  assert.ok(at({ depth: 650 }).unit > at({ depth: 550 }).unit);
  // cualquier tamaño fabricable tiene su variante, con el mismo precio
  for (const w of [1260, 1300, 1301, 1995, 2490, 3000]) {
    for (const h of [1800, 2000, 2010, 2400, 2500]) {
      for (const d of [450, 460, 550, 650]) {
        const l = at({ height: h, depth: d, runs: [{ width: w, modules: base.runs[0].modules }] });
        assert.ok(l.kind === "placard");
        const v = variants.find((x) => x.values.join("|") === l.variant.join("|"));
        assert.ok(v, `sin variante para ${w}×${h}×${d}`);
        assert.equal(v.price, l.unit);
        // el escalón cubre la medida: nunca se cobra un tamaño más chico
        const [vw, vh, vd] = l.variant.map((s) => Number(s.replace(/\D/g, "")) * 10);
        assert.ok(vw >= w && vh >= h && vd >= d, `${l.variant.join(" ")} no cubre ${w}×${h}×${d}`);
      }
    }
  }
});

test("agregados: cada cosa dibujada está cobrada en su renglón, y nada más", () => {
  const plain = enforce({ ...initialConfig(), runs: [{ width: 1600, modules: [mod("hanging"), mod("hanging")] }] });
  const q0 = demoQuote(plain);
  // dos módulos para colgar: un maletero y un barral cada uno
  assert.deepEqual(q0.lines.map((l) => (l.kind === "item" ? `${l.key}:${l.qty}` : "placard")), ["placard", "estante:2", "barral:2"]);

  const full = enforce({
    ...plain,
    leaves: [{ style: "mirror" }, { style: "glass" }],
    runs: [{ width: 1600, modules: [mod("drawers-shelves", { drawers: 3, shelves: 3, trays: 2, ledShelves: true }), mod("double-hanging")] }],
  });
  const q = demoQuote(full);
  assert.equal(line(q, "cajon")!.qty, 3);
  assert.equal(line(q, "bandeja")!.qty, 2);
  // módulo 1: el fijo sobre los cajones + 1 regulable (las otras 2 son bandejas); módulo 2: maletero + intermedio
  assert.equal(line(q, "estante")!.qty, 4);
  assert.equal(line(q, "barral")!.qty, 2);
  assert.equal(line(q, "espejo")!.qty, 1);
  assert.equal(line(q, "vidrio")!.qty, 1);
  assert.equal(line(q, "led")!.qty, 1);
  assert.equal(line(q, "modulo"), undefined);
  assert.ok(q.price > q0.price);

  const three = demoQuote(withModules(full, 3));
  assert.equal(line(three, "modulo")!.qty, 1);
  // sacar un cajón baja exactamente lo que vale un cajón
  const less = demoQuote(enforce({ ...full, runs: [{ width: 1600, modules: [{ ...full.runs[0].modules[0], drawers: 2 }, full.runs[0].modules[1]] }] }));
  assert.equal(q.price - less.price, PRICES.items.cajon.unit);
});

test("validación: una configuración imposible se corrige del lado del servidor", async () => {
  const e = env();
  const r = await handle(post("/api/tn/quote", { config: { doors: "none", shape: "l-left", height: 99999, depth: 1, topBox: { enabled: true, height: 600 }, runs: [{ width: 50000, modules: [{ layout: "shelves", shelves: 99, drawers: 99, trays: 99 }] }] } }), e);
  assert.equal(r.status, 200);
  const b = (await r.json()) as { config: ReturnType<typeof initialConfig> };
  assert.equal(b.config.doors, "sliding");
  assert.equal(b.config.shape, "straight");
  assert.equal(b.config.topBox.enabled, false);
  assert.equal(b.config.runs[0].width, 3000);
  assert.ok(b.config.height <= 2500 && b.config.depth >= 450);
  for (const x of b.config.runs[0].modules) assert.ok(x.width >= 599.5 && x.shelves <= 6 && x.drawers <= 4 && x.trays <= 3 && x.trays <= x.shelves);
});

test("precio: el que manda el navegador se ignora", async () => {
  const e = env();
  const r = await handle(post("/api/tn/configs", { config: initialConfig(), price: 1, lines: [], productId: "111" }), e);
  assert.equal(r.status, 201);
  const b = (await r.json()) as { id: string; price: number; lines: unknown[]; products: { placard: string } };
  assert.match(b.id, /^RM-[2-9A-HJ-NP-Z]{8}$/);
  const q = demoQuote(initialConfig());
  assert.equal(b.price, q.price);
  assert.deepEqual(b.lines, JSON.parse(JSON.stringify(q.lines)));
  assert.equal(b.products.placard, "111");
});

test("guardar y recuperar: la configuración vuelve entera con su identificador", async () => {
  const e = env();
  const sent = enforce({ ...initialConfig(), bodyMaterial: "nogal", leaves: [{ style: "mirror" }, null] });
  const r = await handle(post("/api/tn/configs", { config: sent, productId: 111 }), e);
  const b = (await r.json()) as { id: string };
  const back = await handle(get(`/api/tn/configs/${b.id}`), e);
  assert.equal(back.status, 200);
  const saved = (await back.json()) as { config: unknown; productId: string; price: number; properties: { name: string; value: string }[] };
  assert.deepEqual(saved.config, JSON.parse(JSON.stringify(sent)));
  assert.equal(saved.productId, "111");
  assert.equal(saved.price, demoQuote(sent).price);
  assert.ok(saved.properties.find((p) => p.name === "Puertas")!.value.includes("espejo"));
  assert.equal(saved.properties.find((p) => p.name === "Cuerpo")!.value, "Nogal");
  assert.equal((await handle(get("/api/tn/configs/RM-22222222"), e)).status, 404);
  assert.equal((await handle(get("/api/tn/configs/cualquiera"), e)).status, 400);
});

test("vínculo con la tienda: solo el producto vinculado", async () => {
  const e = env();
  const r = await handle(post("/api/tn/configs", { config: {}, productId: "999" }), e);
  assert.equal(r.status, 400);
  assert.equal(((await r.json()) as { error: string }).error, "producto_no_vinculado");
  assert.equal(e.data.size, 0);
});

test("CORS: solo la tienda autorizada", async () => {
  const e = env();
  const ok = await handle(post("/api/tn/quote", { config: {} }), e);
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://tienda.example");
  const no = await handle(post("/api/tn/quote", { config: {} }, "https://otra.example"), e);
  assert.equal(no.headers.get("Access-Control-Allow-Origin"), null);
});

test("reglas: módulos de 60 cm como mínimo, hasta 3 m de ancho, y se suman los que entran", () => {
  // contando las placas (18 mm cada una), en 3 m entran cuatro módulos de 60 cm y el quinto no
  assert.ok(modulesFor(3000).includes(4) && !modulesFor(3000).includes(5));
  let c = initialConfig();
  for (let n = 3; n <= 7; n++) c = withModules(c, n);
  assert.equal(c.runs[0].modules.length, 4);
  assert.ok(c.runs[0].width <= 3000);
  // el ancho total es la suma de los interiores más las placas verticales
  const sum = c.runs[0].modules.reduce((s, x) => s + x.width, 0) + (c.runs[0].modules.length + 1) * 18;
  assert.ok(Math.abs(sum - c.runs[0].width) < 1, `interiores + placas = ${sum}, ancho = ${c.runs[0].width}`);
  // cualquier ancho del rango se arma, y ningún módulo queda por debajo de 60 cm
  for (let w = RULES.width.min; w <= RULES.width.max; w += 10) {
    assert.ok(modulesFor(w).length > 0, `sin módulos para ${w} mm`);
    const fit = enforce({ runs: [{ width: w, modules: c.runs[0].modules }] });
    assert.equal(fit.runs[0].width, w);
    for (const x of fit.runs[0].modules) assert.ok(x.width >= 599.5, `ancho ${w}: módulo de ${x.width} mm`);
  }
  assert.equal(enforce({ runs: [{ width: 500, modules: [] }] }).runs[0].width, RULES.width.min);
  for (let n = 3; n >= 0; n--) c = withModules(c, n);
  assert.equal(c.runs[0].modules.length, 2);
});

test("sitio: cada ruta encuentra su archivo y lo que no existe da 404", async () => {
  const { candidates, serveSite } = await import("../site.ts");
  assert.deepEqual(candidates("/tn/"), ["/tn/index.html"]);
  assert.deepEqual(candidates("/tn"), ["/tn/index.html", "/tn.html"]);
  assert.deepEqual(candidates("/tn/embed.js"), ["/tn/embed.js"]);
  const files = new Map<string, { value: ArrayBuffer; metadata: unknown }>([
    ["site:/tn/index.html", { value: new TextEncoder().encode("<html>tn</html>").buffer as ArrayBuffer, metadata: { type: "text/html; charset=utf-8" } }],
    ["site:/tn/embed.js", { value: new TextEncoder().encode("js").buffer as ArrayBuffer, metadata: { type: "text/javascript; charset=utf-8" } }],
  ]);
  const store = { getWithMetadata: async (k: string) => files.get(k) ?? { value: null, metadata: null } };
  const page = await serveSite(new Request("https://rm.example/tn/?p=1"), store);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "<html>tn</html>");
  const js = await serveSite(new Request("https://rm.example/tn/embed.js"), store);
  assert.equal(js.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal((await serveSite(new Request("https://rm.example/no-existe"), store)).status, 404);
});
