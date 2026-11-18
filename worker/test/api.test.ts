import assert from "node:assert/strict";
import { test } from "node:test";

import { handle, type Env } from "../api.ts";
import { MODELS, RULES, basePrice, demoQuote, enforce, initialConfig, modulesFor, withModules } from "../../src/lib/randy.ts";
import { quote } from "../../src/lib/quote.ts";

function env(): Env & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    CONFIGS: { get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) },
    ENVIRONMENT: "test",
    ALLOWED_ORIGINS: "https://tienda.example",
    TN_EXTRAS_PRODUCT_ID: "999",
    TN_PRODUCT_MODELS: JSON.stringify({ "111": "placard-2p", "333": "placard-3p" }),
  };
}
const post = (path: string, body: unknown, origin = "https://tienda.example") =>
  new Request(`https://rm.example${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
const get = (path: string) => new Request(`https://rm.example${path}`);

test("catálogo: cada modelo arranca dentro de sus límites y con corredizas", () => {
  for (const m of MODELS) {
    const c = initialConfig(m);
    assert.equal(c.doors, "sliding");
    assert.equal(c.shape, "straight");
    assert.equal(c.runs[0].modules.length, m.leaves);
    assert.ok(c.runs[0].width >= RULES.width.min && c.runs[0].width <= RULES.width.max);
    for (const mod of c.runs[0].modules) assert.ok(mod.width >= RULES.module.min - 0.5);
    assert.ok(basePrice(m) > 0 && basePrice(m) <= demoQuote(m, c).price);
  }
});

test("precio: el total es el del motor redondeado, y base + adicionales lo reconstruyen", () => {
  for (const m of MODELS) {
    const c = initialConfig(m);
    const q = demoQuote(m, c);
    assert.equal(q.price, q.base + q.extraUnits * 1000);
    assert.ok(Math.abs(q.price - quote(c).price) <= 500);
  }
});

test("validación: una configuración imposible se corrige del lado del servidor", async () => {
  const e = env();
  const r = await handle(post("/api/tn/quote", { model: "placard-2p", config: { doors: "none", shape: "l-left", height: 99999, depth: 1, runs: [{ width: 50000, modules: [{ layout: "shelves", shelves: 99, drawers: 99, trays: 99 }] }] } }), e);
  assert.equal(r.status, 200);
  const b = (await r.json()) as { config: ReturnType<typeof initialConfig>; price: number };
  assert.equal(b.config.doors, "sliding");
  assert.equal(b.config.shape, "straight");
  assert.equal(b.config.runs[0].width, 3000);
  assert.ok(b.config.runs[0].modules.length >= 3 && b.config.runs[0].modules.every((x: { width: number }) => x.width >= 599.5));
  assert.ok(b.config.height <= 2500 && b.config.depth >= 450);
  for (const mod of b.config.runs[0].modules) assert.ok(mod.shelves <= 6 && mod.drawers <= 4 && mod.trays <= 3 && mod.trays <= mod.shelves);
});

test("precio: el que manda el navegador se ignora", async () => {
  const e = env();
  const m = MODELS[0];
  const r = await handle(post("/api/tn/configs", { model: m.id, config: initialConfig(m), price: 1, extraUnits: 0, base: 1 }), e);
  assert.equal(r.status, 201);
  const b = (await r.json()) as { id: string; price: number; base: number; extraUnits: number };
  assert.match(b.id, /^RM-[2-9A-HJ-NP-Z]{8}$/);
  assert.deepEqual({ price: b.price, base: b.base, extraUnits: b.extraUnits }, demoQuote(m, initialConfig(m)));
});

test("guardar y recuperar: la configuración vuelve entera con su identificador", async () => {
  const e = env();
  const m = MODELS[2];
  const sent = enforce(m, { ...initialConfig(m), bodyMaterial: "nogal" });
  const r = await handle(post("/api/tn/configs", { model: m.id, config: sent, productId: 555 }), e);
  const b = (await r.json()) as { id: string; properties: { name: string; value: string }[] };
  const back = await handle(get(`/api/tn/configs/${b.id}`), e);
  assert.equal(back.status, 200);
  const saved = (await back.json()) as { config: unknown; productId: string; properties: { name: string; value: string }[] };
  assert.deepEqual(saved.config, JSON.parse(JSON.stringify(sent)));
  assert.equal(saved.productId, "555");
  assert.ok(saved.properties.find((p) => p.name === "Puertas")!.value.includes("espejo"));
  assert.equal(saved.properties.find((p) => p.name === "Cuerpo")!.value, "Nogal");
  assert.equal((await handle(get("/api/tn/configs/RM-22222222"), e)).status, 404);
  assert.equal((await handle(get("/api/tn/configs/cualquiera"), e)).status, 400);
});

test("vínculo producto-modelo: un producto de la tienda no acepta otro modelo", async () => {
  const e = env();
  const r = await handle(post("/api/tn/configs", { model: "placard-3p", config: {}, productId: "111" }), e);
  assert.equal(r.status, 400);
  assert.equal(((await r.json()) as { error: string }).error, "producto_de_otro_modelo");
  assert.equal((await handle(post("/api/tn/configs", { model: "no-existe", config: {} }), e)).status, 400);
  assert.equal(e.data.size, 0);
});

test("CORS: solo la tienda autorizada", async () => {
  const e = env();
  const ok = await handle(post("/api/tn/quote", { model: "placard-2p", config: {} }), e);
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://tienda.example");
  const no = await handle(post("/api/tn/quote", { model: "placard-2p", config: {} }, "https://otra.example"), e);
  assert.equal(no.headers.get("Access-Control-Allow-Origin"), null);
});

test("bandejas y hojas combinadas cambian el precio", () => {
  const m = MODELS[0];
  const base = enforce(m, { ...m.initial, runs: [{ width: 1600, modules: [{ layout: "shelves", shelves: 4, drawers: 0, trays: 0, width: 0, ledShelves: false, ledSides: false }, { layout: "hanging", shelves: 0, drawers: 0, trays: 0, width: 0, ledShelves: false, ledSides: false }] }] });
  const withTrays = enforce(m, { ...base, runs: [{ width: 1600, modules: base.runs[0].modules.map((x, i) => (i === 0 ? { ...x, trays: 2 } : x)) }] });
  assert.equal(withTrays.runs[0].modules[0].trays, 2);
  assert.ok(quote(withTrays).price > quote(base).price);
  const withMirror = enforce(m, { ...base, leaves: [{ style: "mirror" }, null] });
  assert.equal(withMirror.leaves?.[0]?.style, "mirror");
  assert.ok(quote(withMirror).price > quote(base).price);
  // una hoja igual al resto no es una excepción
  assert.equal(enforce(m, { ...base, leaves: [{ style: "flat" }, null] }).leaves, undefined);
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
  const page = await serveSite(new Request("https://rm.example/tn/?m=placard-2p"), store);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "<html>tn</html>");
  assert.equal(page.headers.get("Cache-Control"), "no-cache");
  const js = await serveSite(new Request("https://rm.example/tn/embed.js"), store);
  assert.equal(js.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal((await serveSite(new Request("https://rm.example/no-existe"), store)).status, 404);
});

test("reglas: módulos de 60 cm como mínimo, hasta 3 m de ancho, y se suman los que entran", () => {
  const m = MODELS[0];
  // contando las placas (18 mm cada una), en 3 m entran cuatro módulos de 60 cm y el quinto no
  assert.ok(modulesFor(3000).includes(4) && !modulesFor(3000).includes(5));
  assert.equal(4 * 600 + 5 * 18, 2490);
  let c = initialConfig(m);
  for (let n = 3; n <= 7; n++) c = withModules(m, c, n);
  assert.equal(c.runs[0].modules.length, 4);
  assert.ok(c.runs[0].width <= 3000);
  // el ancho total es la suma de los interiores más las placas verticales
  const sum = c.runs[0].modules.reduce((s, x) => s + x.width, 0) + (c.runs[0].modules.length + 1) * 18;
  assert.ok(Math.abs(sum - c.runs[0].width) < 1, `interiores + placas = ${sum}, ancho = ${c.runs[0].width}`);
  // cualquier ancho del rango se arma, y ningún módulo queda por debajo de 60 cm
  for (let w = RULES.width.min; w <= RULES.width.max; w += 10) {
    assert.ok(modulesFor(w).length > 0, `sin módulos para ${w} mm`);
    const fit = enforce(m, { runs: [{ width: w, modules: c.runs[0].modules }] });
    assert.equal(fit.runs[0].width, w);
    for (const mod of fit.runs[0].modules) assert.ok(mod.width >= 599.5, `ancho ${w}: módulo de ${mod.width} mm`);
  }
  // por debajo del mínimo no se acepta: el servidor lo lleva al ancho mínimo
  assert.equal(enforce(m, { runs: [{ width: 500, modules: [] }] }).runs[0].width, RULES.width.min);
  // sacar módulos achica el placard, nunca por debajo de dos
  for (let n = 3; n >= 0; n--) c = withModules(m, c, n);
  assert.equal(c.runs[0].modules.length, 2);
});
