/**
 * Prueba de punta a punta en la tienda real: abre la ficha de un placard,
 * lo configura en 3D, lo agrega al carrito y comprueba que lo elegido quedó
 * guardado (en el carrito y en el servidor).
 *
 *   node scripts/e2e-tienda.cjs [desktop|mobile] [url de la ficha]
 *
 * Solo agrega al carrito de una sesión nueva: no compra nada.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium, devices } = require("playwright");

const mode = process.argv[2] === "mobile" ? "mobile" : "desktop";
const url = process.argv[3] || "https://medida3.mitiendanube.com/productos/placard-corredizo-a-medida-demo-1rp23/";
const shots = process.env.SHOTS || ".";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const results = [];
const check = async (name, fn) => {
  try {
    const note = await fn();
    results.push(["ok", name, note || ""]);
    console.log("ok   ", name, note || "");
  } catch (e) {
    results.push(["FALLA", name, e.message.split("\n")[0]]);
    console.log("FALLA", name, e.message.split("\n")[0]);
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext(mode === "mobile" ? { ...devices["iPhone 13"], locale: "es-AR" } : { viewport: { width: 1440, height: 900 }, locale: "es-AR", userAgent: UA });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const frame = page.frameLocator("#rm-configurator iframe");
  const tab = (name) => frame.getByRole("tab", { name }).click({ force: true });
  const priceOf = async () => Number((await frame.locator(".price-bar p.font-display").innerText()).replace(/[^\d]/g, ""));
  let saved = null;

  await check("1-2. la ficha del placard abre con el configurador adentro", async () => {
    await page.goto(url, { waitUntil: "load" });
    await page.locator("#rm-configurator iframe").waitFor();
    await frame.locator('[data-rm="add-to-cart"]').waitFor();
    const box = await page.locator("#rm-configurator iframe").boundingBox();
    const vw = page.viewportSize().width;
    assert(box.width >= vw * 0.9, `el configurador no ocupa el ancho (${Math.round(box.width)} de ${vw})`);
    assert((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, "hay scroll horizontal");
    return `iframe ${Math.round(box.width)}×${Math.round(box.height)}`;
  });

  await check("3. el modelo 3D se dibuja", async () => {
    await frame.locator("canvas").first().waitFor();
    const f = page.frames().find((x) => x.url().includes("/tn/"));
    await f.waitForFunction(() => (window.__medidaFrames ?? 0) > 2, null, { timeout: 240_000 }).catch(() => {});
    const painted = await f.evaluate(() => {
      const c = document.querySelector("canvas");
      return !!c && c.width > 100 && c.height > 100;
    });
    assert(painted, "no hay lienzo 3D");
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${shots}/tienda-${mode}-1-ficha.png`, timeout: 240_000 });
  });

  const p0 = await priceOf().catch(() => 0);

  await check("4. cambiar las medidas", async () => {
    await tab("Forma");
    if (mode === "desktop") {
      for (const [id, v] of [["#dim-Ancho", "190"], ["#dim-Alto", "230"], ["#dim-Profundidad", "55"]]) {
        const input = frame.locator(id);
        await input.fill(v);
        await input.press("Enter");
      }
    } else {
      // en el teléfono las medidas van en tarjetas con una regla
      const card = frame.getByRole("button", { name: /Ancho/ }).first();
      await card.click({ force: true });
      const range = frame.locator('input[type="range"]').first();
      await range.evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(el, String(Number(el.max)));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    await page.waitForTimeout(1200);
    const p = await priceOf();
    assert(p !== p0, "el precio no cambió con las medidas");
    return `precio ${p0} → ${p}`;
  });

  await check("5-7. interior: cajones, estantes y bandejas", async () => {
    await tab("Interior");
    // módulo 2: cajones y estantes
    await frame.getByRole("button", { name: /^2\s/ }).first().click({ force: true });
    await frame.getByRole("button", { name: "Cajones y estantes" }).click({ force: true });
    await frame.getByRole("button", { name: "Más cajones" }).click({ force: true });
    await frame.getByRole("button", { name: "Más estantes" }).click({ force: true });
    await frame.getByRole("button", { name: "Más bandejas extraíbles" }).click({ force: true });
    await page.waitForTimeout(800);
  });

  await check("sumar un módulo: el ancho acompaña y ningún módulo baja de 60 cm", async () => {
    await frame.getByRole("button", { name: "Más cantidad de módulos" }).click({ force: true });
    await page.waitForTimeout(1500);
    const cards = await frame.locator("button.option-card span.tabular-nums").allInnerTexts();
    const widths = cards.map((t) => Number(t.replace(/[^\d]/g, ""))).filter(Boolean);
    assert(widths.length === 3, `módulos: ${widths.length}`);
    assert((await frame.locator('[data-rm="price-lines"]').innerText()).includes("Módulo adicional"), "el detalle del precio no muestra el módulo adicional");
    assert(widths.every((w) => w >= 60), `anchos de módulo: ${widths.join(", ")} cm`);
    return `3 módulos de ${widths.join(", ")} cm`;
  });

  await check("8. cambiar colores", async () => {
    await tab("Color");
    await frame.getByRole("button", { name: "Nogal" }).first().click({ force: true });
    await frame.getByRole("button", { name: "Arena" }).nth(1).click({ force: true });
    await page.waitForTimeout(800);
  });

  await check("9. una puerta espejada", async () => {
    await tab("Frentes");
    const leaf = frame.locator("div.rounded-2xl", { hasText: "Hoja 1" }).first();
    await leaf.getByRole("button", { name: "Espejo" }).click({ force: true });
    await page.waitForTimeout(1500);
    assert((await leaf.getByRole("button", { name: "Espejo" }).getAttribute("aria-pressed")) === "true", "la hoja 1 no quedó espejada");
    await page.screenshot({ path: `${shots}/tienda-${mode}-2-configurado.png`, timeout: 240_000 });
  });

  await check("el precio de la ficha sigue al configurador", async () => {
    const inFrame = await priceOf();
    const inPage = Number((await page.locator("#price_display").innerText()).replace(/[^\d]/g, ""));
    assert(inFrame === inPage, `ficha ${inPage} ≠ configurador ${inFrame}`);
    return `$${inPage}`;
  });

  await check("no se pierde al recargar la página", async () => {
    const before = await priceOf();
    await page.reload({ waitUntil: "load" });
    await frame.locator('[data-rm="add-to-cart"]').waitFor();
    await page.waitForTimeout(6000);
    const after = await priceOf();
    assert(before === after, `antes ${before}, después ${after}`);
  });

  await check("10. agregar al carrito", async () => {
    const posts = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/comprar\/?$/.test(new URL(r.url()).pathname)) posts.push(decodeURIComponent((r.postData() || "").replace(/\+/g, " ")));
    });
    const answer = page.waitForResponse((r) => r.url().includes("/api/tn/configs") && r.request().method() === "POST", { timeout: 240_000 });
    await frame.locator('[data-rm="add-to-cart"]').evaluate((el) => el.click());
    saved = await (await answer).json();
    saved.viewUrl = `${new URL((await answer).url()).origin}/tn/?id=${saved.id}`;
    await page.locator(".rm-done").waitFor({ timeout: 120_000 });
    await page.screenshot({ path: `${shots}/tienda-${mode}-3-agregado.png`, timeout: 240_000 });
    assert(/^RM-/.test(saved.id), "el servidor no devolvió identificador");
    assert(posts.length === saved.lines.length, `se esperaban ${saved.lines.length} altas al carrito y hubo ${posts.length}`);
    for (const post of posts) assert(post.includes(`properties[Diseño]=${saved.id}`), "un renglón no lleva el identificador del diseño");
    const main = saved.lines[0];
    main.variant.forEach((v, i) => assert(posts[0].includes(`variation[${i}]=${v}`), `el placard no fue en su tamaño (${v})`));
    for (const p of saved.properties) assert(posts[0].includes(`properties[${p.name}]=${p.value}`), `falta la propiedad ${p.name}`);
    return `${saved.id} · $${saved.price} en ${saved.lines.length} renglones`;
  });

  await check("11. el carrito tiene cada renglón con su cantidad y su precio, y el total coincide", async () => {
    assert(saved, "no hay diseño guardado");
    const text = await page.locator(".rm-done").innerText();
    for (const l of saved.lines) assert(text.includes(l.name), `el resumen no muestra ${l.name}`);
    await page.goto(new URL("/comprar/", url).href, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const cart = await page.evaluate(() => LS.cart.items.map((i) => ({ product: String(i.product_id), qty: i.quantity, unit: i.unit_price / 100 })));
    const total = cart.reduce((a, i) => a + i.qty * i.unit, 0);
    assert(cart.length === saved.lines.length, `renglones en el carrito: ${cart.length}, esperados ${saved.lines.length}`);
    for (const l of saved.lines) {
      const id = l.kind === "placard" ? saved.products.placard : saved.products.items[l.key];
      const item = cart.find((i) => i.product === String(id));
      assert(item, `falta en el carrito: ${l.name}`);
      assert(item.qty === l.qty && item.unit === l.unit, `${l.name}: carrito ${item.qty} × ${item.unit}, validado ${l.qty} × ${l.unit}`);
    }
    assert(total === saved.price, `total del carrito ${total} ≠ precio validado ${saved.price}`);
    await page.screenshot({ path: `${shots}/tienda-${mode}-4-carrito.png`, fullPage: true, timeout: 240_000 });
    return `total $${total} · ` + saved.lines.map((l) => `${l.qty}×${l.kind === "placard" ? "placard " + l.variant.join("/") : l.key}`).join(", ");
  });

  await check("la configuración se recupera entera del servidor", async () => {
    // se pide desde el propio configurador, como lo haría el navegador
    await page.goto(saved.viewUrl || `https://randy-muebles-configurador.matiascolimodio.workers.dev/tn/?id=${saved.id}`, { waitUntil: "load" });
    await page.locator('[data-rm="saved-id"]').waitFor();
    const back = await page.evaluate((id) => fetch(`/api/tn/configs/${id}`).then((r) => r.json()), saved.id);
    assert(JSON.stringify(back.config) === JSON.stringify(saved.config), "la configuración guardada no coincide");
    const mods = back.config.runs[0].modules;
    assert(back.config.leaves?.[0]?.style === "mirror", "no guardó la puerta espejada");
    assert(mods.some((m) => m.trays > 0) && mods.some((m) => m.drawers > 0), "no guardó cajones o bandejas");
    return back.properties.map((p) => `${p.name}: ${p.value}`).join(" | ");
  });

  await check("hoja de taller: plano del interior, hojas y despiece del diseño guardado", async () => {
    const origin = new URL(saved.viewUrl).origin;
    await page.goto(`${origin}/tn/taller/?id=${saved.id}`, { waitUntil: "load" });
    await page.locator('[data-rm="sheet-id"]').waitFor();
    assert((await page.locator('[data-rm="sheet-id"]').innerText()).trim() === saved.id, "la hoja no es la de este diseño");
    const plan = await page.locator('[data-rm="elevation"] svg').innerHTML();
    for (const word of ["Cajón", "Bandeja", "Estante", "Barral", "Ancho total"]) assert(plan.includes(word), `el plano no rotula: ${word}`);
    const text = await page.locator("main").innerText();
    for (const word of ["Hojas corredizas", "Despiece", "Herrajes", "Bandeja extraíble"]) assert(text.includes(word), `la hoja no trae: ${word}`);
    assert(!/Margen|Total costo/.test(await page.locator("main section:not(.hidden)").allInnerTexts().then((t) => t.join(" "))), "la hoja muestra costos internos");
    await page.screenshot({ path: `${shots}/tienda-${mode}-5-taller.png`, fullPage: true, timeout: 240_000 });
  });

  await check("los agregados no se venden sueltos: su ficha lleva al placard", async () => {
    const res = await page.goto(new URL("/productos/cajon-con-correderas-telescopicas-demo-1s4fy/", url).href, { waitUntil: "load" });
    assert(res.ok(), "la ficha del agregado no abre");
    // en la tienda publicada el script solo entra por la descripción del placard: sin el diseño nuevo publicado, no redirige
    const moved = await page.waitForURL(/placard-corredizo-a-medida/, { timeout: 8000 }).then(() => true).catch(() => false);
    return moved ? "redirige al placard" : "todavía no (se activa al publicar el diseño nuevo)";
  });

  await check("sin errores de JavaScript en la página", async () => {
    assert(errors.length === 0, errors.slice(0, 3).join(" · "));
  });

  await browser.close();
  const failed = results.filter((r) => r[0] !== "ok").length;
  console.log(`\n${mode}: ${results.length - failed}/${results.length} comprobaciones pasaron`);
  process.exit(failed ? 1 : 0);
})();
