/**
 * Catálogo de DEMOSTRACIÓN para Randy Muebles.
 *
 * Es el único archivo que hay que tocar para adaptar la demo al comercio real:
 * reglas de fabricación, terminaciones y lista de precios. Lo leen el
 * configurador (navegador) y el servidor (Worker), que vuelve a validar y a
 * calcular todo antes de aceptar una configuración: el precio nunca sale del
 * navegador.
 *
 * TODO LO DE ACÁ ES ILUSTRATIVO (DEMO). No es el catálogo ni la lista de
 * precios de Randy Muebles: son valores de ejemplo hasta que el comercio pase
 * los suyos.
 */

import { allParts, buildAssembly } from "./assembly.ts";
import { catalog, configureCatalog, materialById } from "./catalog.ts";
import { DOOR_STYLE_LABELS, LAYOUT_LABELS, configureLimits, innerAvailable, leafLook, normalize, type DoorStyle, type ModuleConfig, type WardrobeConfig } from "./model.ts";
import { dimensionsLabel } from "./share.ts";

export const DISCLAIMER =
  "Demostración de configurador 3D. Modelos, colores, opciones y precios ilustrativos, sujetos a adaptación al catálogo y las condiciones de fabricación del comercio.";

export const BRAND = { name: "Randy Muebles · propuesta DEMO", tagline: "Placares corredizos a medida" };

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
  height: { min: 1800, max: 2500 },
  depth: { min: 450, max: 650 },
  /** ancho interior libre de un módulo, en mm */
  module: { min: 600, max: 1000 },
  modules: { min: 2, max: 4 },
} as const;

/**
 * LISTA DE PRECIOS DE DEMOSTRACIÓN, en pesos.
 *
 * El placard se cobra por tamaño, en escalones: se toma el escalón que
 * contiene cada medida ("hasta 280 cm"). Incluye la estructura completa, dos
 * módulos con sus dos hojas corredizas lisas, rieles, zócalo y la terminación
 * elegida. Todo lo demás se suma por unidad, cada cosa en su renglón.
 *
 * En la tienda, cada escalón de tamaño es una variante del producto
 * "Placard a medida" y cada agregado es un producto: así el carrito y el pedido
 * muestran lo mismo que el configurador, con precios reales de la tienda.
 */
export const PRICES = {
  placard: {
    /** el más chico: hasta 130 × 220 × 55 cm */
    base: 590_000,
    /** escalones de ancho total, en cm */
    widths: [130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300],
    perWidthStep: 31_000,
    heights: [220, 250],
    perHeightStep: 84_000,
    depths: [55, 65],
    perDepthStep: 57_000,
  },
  items: {
    modulo: { name: "Módulo adicional (divisor y hoja corrediza)", unit: 118_000 },
    cajon: { name: "Cajón con correderas telescópicas", unit: 72_000 },
    bandeja: { name: "Bandeja extraíble", unit: 41_000 },
    estante: { name: "Estante", unit: 23_000 },
    barral: { name: "Barral para colgar", unit: 17_000 },
    espejo: { name: "Puerta espejada (recargo por hoja)", unit: 104_000 },
    vidrio: { name: "Puerta de vidrio y aluminio (recargo por hoja)", unit: 139_000 },
    ranurado: { name: "Puerta ranurada (recargo por hoja)", unit: 44_000 },
    led: { name: "Luz LED (por módulo iluminado)", unit: 61_000 },
  },
} as const;

export type ItemKey = keyof typeof PRICES.items;
export const ITEM_KEYS = Object.keys(PRICES.items) as ItemKey[];

export type PriceLine =
  | { kind: "placard"; name: string; detail: string; qty: 1; unit: number; total: number; variant: [string, string, string] }
  | { kind: "item"; key: ItemKey; name: string; detail: string; qty: number; unit: number; total: number };

export type DemoQuote = { price: number; lines: PriceLine[] };

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

/** con qué arranca el configurador: dos módulos, lo más simple, para ir sumando */
export const INITIAL: Partial<WardrobeConfig> = {
  shape: "straight",
  doors: "sliding",
  height: 2400,
  depth: 550,
  plinth: true,
  doorStyle: "flat",
  bodyMaterial: "blanco",
  doorMaterial: "roble",
  runs: [{ width: 1600, modules: [m("hanging"), m("drawers-shelves", { drawers: 2, shelves: 3 })] }],
};

let configured = false;
/** la marca, las terminaciones y las reglas de la demo. Se aplica una vez, antes de cotizar o dibujar */
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
export function enforce(input: Partial<WardrobeConfig> | null | undefined): WardrobeConfig {
  setupCatalog();
  const src: Partial<WardrobeConfig> = input && typeof input === "object" ? input : {};
  const run = Array.isArray(src.runs) && src.runs[0] && typeof src.runs[0] === "object" ? src.runs[0] : INITIAL.runs![0];
  const rawWidth = Number(run.width);
  const width = Math.round(Math.min(RULES.width.max, Math.max(RULES.width.min, Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : INITIAL.runs![0].width)));
  const fallback = INITIAL.runs![0].modules;
  const given = Array.isArray(run.modules) && run.modules.length ? run.modules : fallback;
  // la cantidad pedida, o la más cercana que entra en ese ancho
  const fits = modulesFor(width);
  const wanted = Math.min(RULES.modules.max, Math.max(RULES.modules.min, given.length));
  const count = fits.reduce((best, n) => (Math.abs(n - wanted) < Math.abs(best - wanted) ? n : best), fits[0] ?? wanted);
  const same = given.length === count;
  const modules = Array.from({ length: count }, (_, i) => ({ ...(given[i] ?? given[given.length - 1]), ...(same ? {} : { width: 0 }) }));
  return normalize({
    ...INITIAL,
    ...src,
    shape: "straight",
    doors: "sliding",
    slope: { enabled: false, low: 1800, side: "right" },
    curved: { left: false, right: false },
    // el altillo no está en la lista de precios de la demo
    topBox: { enabled: false, height: 450 },
    runs: [{ width, modules }],
  });
}

export const initialConfig = (): WardrobeConfig => enforce(INITIAL);

/** suma o saca módulos: el ancho acompaña, con cada módulo cerca de la medida que tenía */
export function withModules(config: WardrobeConfig, n: number): WardrobeConfig {
  const count = Math.min(RULES.modules.max, Math.max(RULES.modules.min, Math.round(n)));
  const current = config.runs[0].modules;
  const avg = current.reduce((s, x) => s + x.width, 0) / current.length;
  const range = widthRange(count);
  const width = Math.round(Math.min(range.max, Math.max(range.min, count * avg + (count + 1) * T())));
  // un módulo nuevo llega simple: para colgar
  const modules = Array.from({ length: count }, (_, i) => ({ ...(current[i] ?? m("hanging")), width: 0 }));
  const leaves = config.leaves ? Array.from({ length: count }, (_, i) => config.leaves![i] ?? null) : undefined;
  return enforce({ ...config, leaves, runs: [{ width, modules }] });
}

/** el escalón de la lista que contiene una medida: el primero que la cubre */
const step = (steps: readonly number[], mm: number): number => {
  const i = steps.findIndex((cm) => cm * 10 >= mm - 0.5);
  return i < 0 ? steps.length - 1 : i;
};

/** el nombre de un escalón, tal cual figura como variante en la tienda */
export const stepLabel = (cm: number) => `hasta ${cm} cm`;

/** todos los tamaños de la lista con su precio: son las variantes del producto de la tienda */
export function placardVariants(): { values: [string, string, string]; price: number }[] {
  const p = PRICES.placard;
  return p.widths.flatMap((w, wi) =>
    p.heights.flatMap((h, hi) => p.depths.map((d, di) => ({ values: [stepLabel(w), stepLabel(h), stepLabel(d)] as [string, string, string], price: p.base + wi * p.perWidthStep + hi * p.perHeightStep + di * p.perDepthStep }))),
  );
}

const STYLE_ITEM: Partial<Record<DoorStyle, ItemKey>> = { mirror: "espejo", glass: "vidrio", grooved: "ranurado" };

/**
 * El precio de una configuración ya validada, renglón por renglón. Las
 * cantidades salen del despiece (lo mismo que se ve en 3D): cada estante,
 * barral, cajón o bandeja que está dibujado está cobrado, y nada más.
 */
export function demoQuote(config: WardrobeConfig): DemoQuote {
  setupCatalog();
  const p = PRICES.placard;
  const wi = step(p.widths, config.runs[0].width);
  const hi = step(p.heights, config.height);
  const di = step(p.depths, config.depth);
  const unit = p.base + wi * p.perWidthStep + hi * p.perHeightStep + di * p.perDepthStep;
  const mods = config.runs[0].modules;
  const lines: PriceLine[] = [
    {
      kind: "placard",
      name: "Placard a medida",
      detail: `${dimensionsLabel(config)} · estructura, 2 módulos con sus hojas corredizas lisas, rieles y zócalo`,
      qty: 1,
      unit,
      total: unit,
      variant: [stepLabel(p.widths[wi]), stepLabel(p.heights[hi]), stepLabel(p.depths[di])],
    },
  ];

  const assembly = buildAssembly(config);
  const parts = allParts(assembly);
  const styles = mods.map((_, k) => leafLook(config, k).style);
  const qty: Record<ItemKey, number> = {
    modulo: mods.length - RULES.modules.min,
    cajon: assembly.counts.drawers,
    bandeja: assembly.counts.trays,
    estante: parts.filter((x) => x.kind === "shelf" || x.kind === "fixed-shelf").length,
    barral: parts.filter((x) => x.kind === "rod").length,
    espejo: styles.filter((s) => s === "mirror").length,
    vidrio: styles.filter((s) => s === "glass").length,
    ranurado: styles.filter((s) => s === "grooved").length,
    led: mods.filter((x) => x.ledShelves || x.ledSides).length,
  };
  const where = (test: (x: ModuleConfig, i: number) => boolean) =>
    mods
      .map((x, i) => (test(x, i) ? i + 1 : 0))
      .filter(Boolean)
      .join(", ");
  const detail: Record<ItemKey, string> = {
    modulo: `${mods.length} módulos en total`,
    cajon: `en módulo ${where((x) => x.drawers > 0)}`,
    bandeja: `en módulo ${where((x) => x.trays > 0)}`,
    estante: "maleteros, fijos y regulables",
    barral: "",
    espejo: `hoja ${where((_, i) => styles[i] === "mirror")}`,
    vidrio: `hoja ${where((_, i) => styles[i] === "glass")}`,
    ranurado: `hoja ${where((_, i) => styles[i] === "grooved")}`,
    led: `módulo ${where((x) => x.ledShelves || x.ledSides)}`,
  };
  for (const key of ITEM_KEYS) {
    if (qty[key] <= 0) continue;
    const item = PRICES.items[key];
    lines.push({ kind: "item", key, name: item.name, detail: detail[key], qty: qty[key], unit: item.unit, total: qty[key] * item.unit });
  }
  return { price: lines.reduce((s, l) => s + l.total, 0), lines };
}

const cm = (mm: number) => `${Math.round(mm / 10)} cm`;

/**
 * Lo que eligió la persona, en renglones cortos con nombre: es lo que viaja
 * con el ítem del carrito y lo que se ve en el resumen.
 */
export function configProperties(config: WardrobeConfig): { name: string; value: string }[] {
  setupCatalog();
  const mods = config.runs[0].modules;
  const leaves = mods.map((_, k) => {
    const look = leafLook(config, k);
    return look.style === "mirror" ? "espejo" : look.style === "glass" ? "vidrio" : `${DOOR_STYLE_LABELS[look.style].toLowerCase()} ${materialById(look.material).name.toLowerCase()}`;
  });
  const inside = (x: ModuleConfig) =>
    [LAYOUT_LABELS[x.layout].toLowerCase(), x.drawers ? `${x.drawers} cajones` : "", x.trays ? `${x.trays} bandejas` : "", x.ledShelves || x.ledSides ? "LED" : ""].filter(Boolean).join(", ");
  return [
    { name: "Medidas", value: `${dimensionsLabel(config)} (ancho × alto × prof.)` },
    { name: "Puertas", value: `${mods.length} corredizas: ${leaves.join(" + ")}` },
    ...mods.map((x, i) => ({ name: `Módulo ${i + 1}`, value: `${cm(x.width)} · ${inside(x)}` })),
    { name: "Cuerpo", value: materialById(config.bodyMaterial).name },
    ...(mods.some((x) => x.ledShelves || x.ledSides) ? [{ name: "Luz LED", value: config.led.color === "rgb" ? "RGB" : { warm: "cálida", neutral: "neutra", cool: "fría" }[config.led.color] }] : []),
  ];
}
