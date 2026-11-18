/**
 * Catálogo de DEMOSTRACIÓN para Randy Muebles.
 *
 * Es el único archivo que hay que tocar para adaptar la demo al comercio real:
 * modelos, medidas permitidas, terminaciones, costos y recargos. Lo leen el
 * configurador (navegador) y el servidor (Worker), que vuelve a calcular todo
 * antes de aceptar una configuración: el precio nunca sale del navegador.
 *
 * TODO LO DE ACÁ ES ILUSTRATIVO (DEMO). No es el catálogo ni la lista de
 * precios de Randy Muebles: son valores de ejemplo hasta que el comercio pase
 * los suyos.
 */

import { catalog, configureCatalog } from "./catalog.ts";
import { LIMITS, configureLimits, innerAvailable, normalize, type ModuleConfig, type WardrobeConfig } from "./model.ts";
import { quote } from "./quote.ts";
import { dimensionsLabel, leafLines } from "./share.ts";
import { DOOR_STYLE_LABELS, LAYOUT_LABELS, leafLook } from "./model.ts";
import { materialById } from "./catalog.ts";

export const DISCLAIMER =
  "Demostración de configurador 3D. Modelos, colores, opciones y precios ilustrativos, sujetos a adaptación al catálogo y las condiciones de fabricación del comercio.";

export const BRAND = { name: "Randy Muebles · propuesta DEMO", tagline: "Placares corredizos a medida" };

/** unidad del producto "Adicionales de personalización" en la tienda, en pesos */
export const EXTRA_UNIT = 1000;

/**
 * Reglas de fabricación PROVISIONALES (las confirma el comercio):
 *
 *  - cada módulo mide como mínimo 60 cm de ancho interior libre;
 *  - el placard completo no pasa de 3 m de ancho;
 *  - se pueden sumar módulos mientras entren en ese ancho.
 *
 * El ancho total cuenta las placas: cada lateral y cada divisor suma su
 * espesor (18 mm). Con n módulos hay n + 1 placas verticales, así que cuatro
 * módulos de 60 cm ocupan 4 × 600 + 5 × 18 = 2490 mm y cinco ya no entran en
 * 3 m (3108 mm). Los cajones y las bandejas descuentan además sus correderas.
 */
export const RULES = {
  width: { min: 1260, max: 3000 },
  /** ancho interior libre de un módulo, en mm */
  module: { min: 600, max: 1000 },
  modules: { min: 2, max: 4 },
} as const;

export type RandyModel = {
  id: string;
  name: string;
  /** con cuántas hojas corredizas (= módulos) arranca; después se pueden sumar o sacar */
  leaves: number;
  /** ancho con el que arranca, en mm */
  width: { initial: number };
  /** con qué arranca: interior, frentes y colores */
  initial: Partial<WardrobeConfig>;
  /** la configuración más económica del modelo: de ahí sale el precio "desde" */
  cheapest: Partial<WardrobeConfig>;
};

const m = (layout: ModuleConfig["layout"], extra: Partial<ModuleConfig> = {}): ModuleConfig => ({
  layout,
  shelves: 0,
  drawers: 0,
  trays: 0,
  width: 0,
  ledShelves: false,
  ledSides: false,
  ...extra,
});

const common: Partial<WardrobeConfig> = { shape: "straight", doors: "sliding", height: 2400, depth: 600, plinth: true };

export const MODELS: RandyModel[] = [
  {
    id: "placard-2p",
    name: "Placard corredizo de 2 puertas",
    leaves: 2,
    width: { initial: 1600 },
    initial: {
      ...common,
      doorStyle: "flat",
      bodyMaterial: "blanco",
      doorMaterial: "roble",
      runs: [{ width: 1600, modules: [m("hanging"), m("drawers-shelves", { drawers: 2, shelves: 3, trays: 1 })] }],
    },
    cheapest: { runs: [{ width: 1260, modules: [m("hanging"), m("hanging")] }] },
  },
  {
    id: "placard-3p",
    name: "Placard corredizo de 3 puertas",
    leaves: 3,
    width: { initial: 2400 },
    initial: {
      ...common,
      doorStyle: "flat",
      bodyMaterial: "blanco",
      doorMaterial: "arena",
      runs: [{ width: 2400, modules: [m("hanging"), m("drawers-shelves", { drawers: 3, shelves: 3, trays: 1 }), m("double-hanging")] }],
    },
    cheapest: { runs: [{ width: 1880, modules: [m("hanging"), m("hanging"), m("hanging")] }] },
  },
  {
    id: "placard-espejo",
    name: "Placard corredizo con puerta espejada",
    leaves: 2,
    width: { initial: 1800 },
    initial: {
      ...common,
      doorStyle: "flat",
      bodyMaterial: "blanco",
      doorMaterial: "grafito",
      leaves: [{ style: "mirror" }, null],
      runs: [{ width: 1800, modules: [m("drawers-hanging", { drawers: 2 }), m("shelves", { shelves: 4, trays: 2 })] }],
    },
    cheapest: { leaves: [{ style: "mirror" }, null], runs: [{ width: 1260, modules: [m("hanging"), m("hanging")] }] },
  },
];

export const modelById = (id: string | null | undefined): RandyModel | undefined => MODELS.find((x) => x.id === id);

let configured = false;
/** la marca y las terminaciones de la demo. Se aplica una vez, antes de cotizar o dibujar */
export function setupCatalog() {
  if (configured) return;
  configured = true;
  configureCatalog({ brandName: BRAND.name, tagline: BRAND.tagline });
  configureLimits({ widthMin: RULES.width.min, widthMax: RULES.width.max, moduleMax: RULES.module.max, slidingModuleMin: RULES.module.min });
}

const T = () => catalog.board.thickness;
/** entre qué anchos totales entran `n` módulos, en mm */
export function widthRange(n: number): { min: number; max: number } {
  const t = T();
  return { min: Math.max(RULES.width.min, n * RULES.module.min + (n + 1) * t), max: Math.min(RULES.width.max, n * RULES.module.max + (n + 1) * t) };
}
/** cuántos módulos admite un ancho total */
export function modulesFor(width: number): number[] {
  const out: number[] = [];
  for (let n = RULES.modules.min; n <= RULES.modules.max; n++) {
    const avail = innerAvailable(width, n);
    if (avail >= n * RULES.module.min && avail <= n * RULES.module.max) out.push(n);
  }
  return out;
}

/**
 * Deja una configuración dentro de lo fabricable, venga de donde venga
 * (interfaz, enlace o un pedido armado a mano contra el servidor): recto,
 * corredizas, ancho total y de módulo en sus rangos, y la cantidad de módulos
 * que de verdad entra en ese ancho.
 */
export function enforce(model: RandyModel, input: Partial<WardrobeConfig> | null | undefined): WardrobeConfig {
  setupCatalog();
  const src: Partial<WardrobeConfig> = input && typeof input === "object" ? input : {};
  const run = Array.isArray(src.runs) && src.runs[0] && typeof src.runs[0] === "object" ? src.runs[0] : model.initial.runs![0];
  const rawWidth = Number(run.width);
  const width = Math.round(Math.min(RULES.width.max, Math.max(RULES.width.min, Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : model.width.initial)));
  const fallback = model.initial.runs![0].modules;
  const given = Array.isArray(run.modules) && run.modules.length ? run.modules : fallback;
  // la cantidad pedida, o la más cercana que entra en ese ancho
  const fits = modulesFor(width);
  const wanted = Math.min(RULES.modules.max, Math.max(RULES.modules.min, given.length));
  const count = fits.reduce((best, n) => (Math.abs(n - wanted) < Math.abs(best - wanted) ? n : best), fits[0] ?? wanted);
  const same = given.length === count;
  const modules = Array.from({ length: count }, (_, i) => ({ ...(given[i] ?? given[given.length - 1]), ...(same ? {} : { width: 0 }) }));
  return normalize({
    ...model.initial,
    ...src,
    shape: "straight",
    doors: "sliding",
    slope: { enabled: false, low: 1800, side: "right" },
    curved: { left: false, right: false },
    runs: [{ width, modules }],
  });
}

/** suma o saca módulos: el ancho acompaña, con cada módulo cerca de la medida que tenía */
export function withModules(model: RandyModel, config: WardrobeConfig, n: number): WardrobeConfig {
  const count = Math.min(RULES.modules.max, Math.max(RULES.modules.min, Math.round(n)));
  const current = config.runs[0].modules;
  const avg = current.reduce((s, x) => s + x.width, 0) / current.length;
  const range = widthRange(count);
  const width = Math.round(Math.min(range.max, Math.max(range.min, count * avg + (count + 1) * T())));
  const modules = Array.from({ length: count }, (_, i) => ({ ...(current[i] ?? { ...current[current.length - 1], drawers: 0, trays: 0, layout: "hanging" as const }), width: 0 }));
  const leaves = config.leaves ? Array.from({ length: count }, (_, i) => config.leaves![i] ?? null) : undefined;
  return enforce(model, { ...config, leaves, runs: [{ width, modules }] });
}

export const initialConfig = (model: RandyModel): WardrobeConfig => enforce(model, model.initial);

const roundTo = (v: number, unit: number) => Math.round(v / unit) * unit;

/** el precio "desde" del modelo: su configuración más económica, redondeada hacia abajo */
export function basePrice(model: RandyModel): number {
  setupCatalog();
  const cheapest = enforce(model, {
    ...common,
    height: LIMITS.height.min,
    depth: LIMITS.depth.min,
    plinth: false,
    topBox: { enabled: false, height: 450 },
    doorStyle: "flat",
    bodyMaterial: "blanco",
    doorMaterial: "blanco",
    ...model.cheapest,
  });
  return Math.floor(quote(cheapest).price / EXTRA_UNIT) * EXTRA_UNIT;
}

export type DemoQuote = {
  /** precio total de demostración, en pesos, redondeado a EXTRA_UNIT */
  price: number;
  /** precio del producto en la tienda (el "desde" del modelo) */
  base: number;
  /** unidades de "Adicionales de personalización" que completan el total */
  extraUnits: number;
};

/** el precio de una configuración ya validada, partido como va al carrito */
export function demoQuote(model: RandyModel, config: WardrobeConfig): DemoQuote {
  setupCatalog();
  const base = basePrice(model);
  const price = Math.max(base, roundTo(quote(config).price, EXTRA_UNIT));
  return { price, base, extraUnits: Math.round((price - base) / EXTRA_UNIT) };
}

const cm = (mm: number) => `${Math.round(mm / 10)} cm`;

/**
 * Lo que eligió la persona, en renglones cortos con nombre: es lo que viaja
 * con el ítem del carrito y lo que se ve en el resumen.
 */
export function configProperties(config: WardrobeConfig): { name: string; value: string }[] {
  setupCatalog();
  const mods = config.runs[0].modules;
  const count = (k: "drawers" | "trays") => mods.reduce((n, x) => n + x[k], 0);
  const shelves = mods.reduce((n, x) => n + (x.layout === "shelves" || x.layout === "drawers-shelves" ? x.shelves - x.trays : 0), 0);
  const leaves = mods.map((_, k) => {
    const look = leafLook(config, k);
    return look.style === "mirror" ? "espejo" : look.style === "glass" ? "vidrio" : `${DOOR_STYLE_LABELS[look.style].toLowerCase()} ${materialById(look.material).name.toLowerCase()}`;
  });
  const leds = mods.some((x) => x.ledShelves || x.ledSides);
  return [
    { name: "Medidas", value: `${dimensionsLabel(config)} (ancho × alto × prof.)` },
    { name: "Puertas", value: `${mods.length} corredizas: ${leaves.join(" + ")}` },
    { name: "Interior", value: mods.map((x, i) => `${i + 1}) ${LAYOUT_LABELS[x.layout].toLowerCase()} ${cm(x.width)}`).join(" · ") },
    { name: "Cajones", value: String(count("drawers")) },
    { name: "Estantes", value: String(shelves) },
    { name: "Bandejas", value: String(count("trays")) },
    { name: "Cuerpo", value: materialById(config.bodyMaterial).name },
    ...(config.topBox.enabled ? [{ name: "Altillo", value: cm(config.topBox.height) }] : []),
    ...(leds ? [{ name: "Luz LED", value: config.led.color === "rgb" ? "RGB" : config.led.color }] : []),
  ];
}

export { leafLines, catalog };
