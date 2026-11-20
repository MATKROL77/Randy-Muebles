/*!
 * Configurador 3D de placares — integración con Tiendanube (DEMO).
 *
 * Se carga desde la descripción del producto (o desde un bloque de código del
 * tema) y hace tres cosas, todas con mecanismos propios de la tienda:
 *
 *  1. En la ficha de un producto vinculado, monta el configurador 3D.
 *  2. Al confirmar, agrega el producto al carrito de la tienda con la
 *     configuración como propiedades del ítem (el servidor ya la validó y le
 *     puso precio e identificador).
 *  3. Donde haya ítems de carrito a la vista, muestra el resumen de cada
 *     configuración.
 *
 * Vincular un producto: en su descripción (modo HTML) va
 *   <div data-rm-configurator="placard"></div>
 *   <script src="https://<servidor>/tn/embed.js" async></script>
 */
(function () {
  "use strict";
  if (window.__rmConfigurator) return;
  window.__rmConfigurator = true;

  var script = document.currentScript || document.querySelector('script[src*="/tn/embed.js"]');
  var BASE = script ? new URL(script.src).origin : "";
  var DISCLAIMER =
    "Demostración de configurador 3D. Modelos, colores, opciones y precios ilustrativos, sujetos a adaptación al catálogo y las condiciones de fabricación del comercio.";
  var LINES_KEY = "rm.cart.lines.v1";
  /** lo que se muestra donde iría un precio fijo: el placard se cotiza según cómo se arme */
  var OPEN_PRICE = "Precio según tu diseño";
  var COVER = BASE + "/img/randy/placard-a-tu-medida.jpg";
  var DRAFT_KEY = "rm.draft.v1.";

  var money = function (n) {
    return "$" + Math.round(n).toLocaleString("es-AR");
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var store = {
    get: function (k) {
      try {
        return JSON.parse(localStorage.getItem(k) || "null");
      } catch (e) {
        return null;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  function css() {
    if (document.getElementById("rm-style")) return;
    var s = document.createElement("style");
    s.id = "rm-style";
    s.textContent = [
      ".rm-wrap{margin:0 auto 28px;max-width:1500px;padding:0 16px;box-sizing:border-box}",
      ".rm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;flex-wrap:wrap}",
      ".rm-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.75}",
      ".rm-badge i{width:8px;height:8px;border-radius:50%;background:#2e7d5b;display:inline-block}",
      ".rm-frame{position:relative;border-radius:18px;overflow:hidden;background:#ece5d8;box-shadow:0 1px 0 rgba(0,0,0,.06),0 18px 50px -22px rgba(0,0,0,.35)}",
      ".rm-frame iframe{display:block;width:100%;border:0;height:min(820px,max(620px,calc(100vh - 150px)))}",
      "@media (max-width:1023px){.rm-wrap{padding:0;margin-bottom:18px;width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}.rm-head{padding:0 14px}.rm-frame{border-radius:0}.rm-frame iframe{height:calc(100vh - 64px);height:calc(100svh - 64px)}}",
      ".rm-note{font-size:11.5px;line-height:1.45;opacity:.7;margin:10px 2px 0}",
      "@media (max-width:1023px){.rm-note{margin:10px 14px 0}}",
      ".rm-price-label{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.65;margin-bottom:2px}",
      ".rm-hide{display:none!important}",
      ".rm-solo{display:block!important;max-width:760px;margin-left:auto;margin-right:auto}",
      ".rm-cfg{margin:8px 0 2px;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.045);font-size:12.5px;line-height:1.5;text-align:left;clear:both;width:100%;box-sizing:border-box}",
      ".rm-cfg b{font-weight:600}.rm-cfg .rm-id{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.04em}",
      ".rm-cfg dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;gap:1px 10px}.rm-cfg dt{opacity:.65}.rm-cfg dd{margin:0}",
      ".rm-cfg a{text-decoration:underline}.rm-cfg img{float:right;width:84px;height:84px;object-fit:cover;border-radius:8px;margin:0 0 6px 10px}",
      ".rm-cfg small{display:block;opacity:.65;margin-top:6px}",
      ".cart-item-info-container>.rm-cfg{grid-column:1/-1;max-width:640px}.js-cart-item.rm-extras{align-items:start}.rm-extras .cart-item-image-container img{aspect-ratio:1/1;object-fit:cover;border-radius:8px}",
      ".rm-extras .js-cart-quantity-btn{visibility:hidden;pointer-events:none}.rm-extras .js-cart-quantity-input{pointer-events:none;width:5ch;background:transparent;border:0}.rm-part .js-cart-item-remove{display:none!important}",
      ".rm-done{position:fixed;inset:0;z-index:2147483000;background:rgba(20,18,15,.55);display:flex;align-items:flex-end;justify-content:center;padding:0}",
      "@media (min-width:640px){.rm-done{align-items:center;padding:24px}}",
      ".rm-card{background:#fff;color:#1f1d1a;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:22px 20px 18px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);font-size:14px;line-height:1.5}",
      "@media (min-width:640px){.rm-card{border-radius:20px}}",
      ".rm-card h3{margin:0 0 4px;font-size:19px;line-height:1.25}.rm-card .rm-total{display:flex;justify-content:space-between;gap:12px;padding:10px 0 0;margin-top:10px;border-top:1px solid rgba(0,0,0,.1);font-weight:600}",
      ".rm-card .rm-rows{font-size:13.5px;margin-top:14px}.rm-card .rm-rows div{display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-top:1px solid rgba(0,0,0,.07)}.rm-card .rm-rows div:first-child{border-top:0}.rm-card .rm-rows small{display:block;opacity:.6;font-size:12px}.rm-card .rm-rows span:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}",
      ".rm-btns{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.rm-btns a,.rm-btns button{flex:1 1 150px;text-align:center;border-radius:999px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid #1f1d1a;text-decoration:none}",
      ".rm-btns .rm-primary{background:#1f1d1a;color:#fff}.rm-btns .rm-ghost{background:transparent;color:#1f1d1a}",
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ---------- 3. el resumen de cada configuración, junto a su ítem de carrito ---------- */

  function decorate() {
    var lines = store.get(LINES_KEY) || {};
    var items = document.querySelectorAll(".js-cart-item[data-item-id]");
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      var line = lines[el.getAttribute("data-item-id")];
      if (!line || el.querySelector(".rm-cfg")) continue;
      var box = document.createElement("div");
      box.className = "rm-cfg";
      box.setAttribute("data-rm-config", line.id);
      if (line.role === "item") {
        box.innerHTML = "Parte del placard <b class='rm-id'>" + esc(line.id) + "</b>" + (line.detail ? " · " + esc(line.detail) : "") + ".";
        // la cantidad sale del diseño: se cambia desde el configurador, no desde el carrito
        el.classList.add("rm-extras");
        el.classList.add("rm-part");
        var q = el.querySelector(".js-cart-quantity-input");
        if (q) q.readOnly = true;
      } else {
        box.innerHTML =
          (line.snapshotUrl ? "<img alt='' loading='lazy' src='" + esc(line.snapshotUrl) + "'>" : "") +
          "<b>Tu diseño</b> <span class='rm-id'>" + esc(line.id) + "</span>" +
          "<dl>" +
          line.properties
            .map(function (p) {
              return "<dt>" + esc(p.name) + "</dt><dd>" + esc(p.value) + "</dd>";
            })
            .join("") +
          "</dl>" +
          "<small>Total de demostración con sus agregados: " + money(line.price) + " · <a target='_blank' rel='noopener' href='" + esc(line.viewUrl) + "'>ver en 3D</a>" + (line.sheetUrl ? " · <a target='_blank' rel='noopener' href='" + esc(line.sheetUrl) + "'>hoja de taller</a>" : "") + "</small>";
        el.classList.add("rm-extras");
        var thumb = el.querySelector(".cart-item-image-container img");
        if (thumb) {
          thumb.removeAttribute("srcset");
          thumb.removeAttribute("data-srcset");
          thumb.src = line.snapshotUrl || COVER;
          thumb.style.objectFit = "cover";
          thumb.classList.remove("lazyload");
          thumb.classList.add("lazyloaded");
        }
        var mq = el.querySelector(".js-cart-quantity-input");
        if (mq) mq.readOnly = true;
        // quitar el placard quita también sus agregados
        var rm = el.querySelectorAll(".js-cart-item-remove");
        for (var r = 0; r < rm.length; r++) {
          if (rm[r].getAttribute("data-rm-bound")) continue;
          rm[r].setAttribute("data-rm-bound", "1");
          rm[r].addEventListener("click", (function (designId) {
            return function () {
              removeParts(designId);
            };
          })(line.id));
        }
      }
      var host = el.querySelector(".cart-item-info-container") || el;
      host.appendChild(box);
    }
    // agregados cuyo placard ya no está (se salió a mitad del borrado): se terminan de quitar
    var present = {};
    for (var o = 0; o < items.length; o++) {
      var mine = lines[items[o].getAttribute("data-item-id")];
      if (mine && mine.role !== "item") present[mine.id] = 1;
    }
    for (var u = 0; u < items.length; u++) {
      var orphan = lines[items[u].getAttribute("data-item-id")];
      if (orphan && orphan.role === "item" && !present[orphan.id] && !removing[orphan.id]) {
        removing[orphan.id] = 1;
        removeParts(orphan.id, 300);
      }
    }
    // el placard va arriba de sus agregados, ordene como ordene la tienda
    for (var k = 0; k < items.length; k++) {
      var main = lines[items[k].getAttribute("data-item-id")];
      if (!main || main.role === "item") continue;
      var first = null;
      for (var j = 0; j < items.length && !first; j++) {
        var part = lines[items[j].getAttribute("data-item-id")];
        if (part && part.role === "item" && part.id === main.id && items[j].parentNode === items[k].parentNode) first = items[j];
      }
      if (first && first.compareDocumentPosition(items[k]) & Node.DOCUMENT_POSITION_FOLLOWING) first.parentNode.insertBefore(items[k], first);
    }
  }

  var removing = {};
  /** saca del carrito, de a uno, los agregados de un diseño cuyo placard se quitó */
  function removeParts(designId, wait) {
    removing[designId] = 1;
    var lines = store.get(LINES_KEY) || {};
    var ids = Object.keys(lines).filter(function (k) {
      return lines[k].id === designId && lines[k].role === "item";
    });
    var next = function () {
      var id = ids.shift();
      if (!id) return;
      var el = document.querySelector('.js-cart-item[data-item-id="' + id + '"]');
      var btn = el && el.querySelector(".js-cart-item-remove");
      if (btn) {
        // el tema pide confirmación al quitar: acá ya la dio al quitar el placard
        var ask = window.confirm;
        window.confirm = function () {
          return true;
        };
        btn.click();
        window.confirm = ask;
      }
      delete lines[id];
      store.set(LINES_KEY, lines);
      setTimeout(next, 900);
    };
    setTimeout(next, wait || 1200);
  }

  /* ---------- 3b. la compra termina en el carrito: es una demostración ---------- */

  function blockCheckout() {
    var GO = '[name="go_to_checkout"], .js-cart-submit, .js-ajax-cart-submit, a[href*="/checkout"]';
    var stop = function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var lines = store.get(LINES_KEY) || {};
      var main = Object.keys(lines)
        .map(function (k) {
          return lines[k];
        })
        .filter(function (l) {
          return l.role !== "item";
        })
        .pop();
      var old = document.querySelector(".rm-done");
      if (old) old.remove();
      var wrap = document.createElement("div");
      wrap.className = "rm-done";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.innerHTML =
        "<div class='rm-card'><h3>Hasta acá llega la demostración</h3>" +
        "<p style='margin:8px 0 0'>En la tienda real, acá empieza el pago. En esta demo no se cobra nada ni se generan pedidos.</p>" +
        (main ? "<p style='margin:12px 0 0'>Tu diseño quedó guardado con el código <b class='rm-id'>" + esc(main.id) + "</b>" + (main.sheetUrl ? ": <a target='_blank' rel='noopener' style='text-decoration:underline' href='" + esc(main.sheetUrl) + "'>ver la hoja de taller</a> que recibiría la carpintería." : ".") + "</p>" : "") +
        "<p class='rm-note' style='margin:12px 0 0'>" + esc(DISCLAIMER) + "</p>" +
        "<div class='rm-btns'><button type='button' class='rm-primary' data-rm-close>Entendido</button></div></div>";
      wrap.addEventListener("click", function (ev) {
        if (ev.target === wrap || (ev.target && ev.target.hasAttribute && ev.target.hasAttribute("data-rm-close"))) wrap.remove();
      });
      document.body.appendChild(wrap);
    };
    document.addEventListener(
      "click",
      function (e) {
        var t = e.target && e.target.closest ? e.target.closest(GO) : null;
        if (t) stop(e);
      },
      true,
    );
    document.addEventListener(
      "submit",
      function (e) {
        var f = e.target;
        if (f && ((f.action || "").indexOf("checkout") >= 0 || (f.querySelector && f.querySelector('[name="go_to_checkout"]')))) stop(e);
      },
      true,
    );
  }

  /* ---------- 5. vista previa: recorrer toda la tienda con el diseño en borrador ---------- */

  /**
   * Tiendanube muestra un diseño sin publicar si la dirección lleva
   * ?theme_installation_id=<id>. Quien entra con ese enlace sigue viendo ese
   * diseño en toda la visita: el parámetro se recuerda en la pestaña y se
   * agrega a cada página de la tienda que se abre.
   */
  var PREVIEW_KEY = "rm.preview.theme";
  function keepPreview() {
    var param = "theme_installation_id";
    var here = new URLSearchParams(location.search).get(param);
    var theme = null;
    try {
      if (here) sessionStorage.setItem(PREVIEW_KEY, here);
      theme = here || sessionStorage.getItem(PREVIEW_KEY);
    } catch (e) {
      theme = here;
    }
    if (!theme || !/^[0-9]+$/.test(theme)) return;
    var withTheme = function (href) {
      try {
        var u = new URL(href, location.href);
        if (u.origin !== location.origin || u.searchParams.get(param)) return null;
        if (/^\/(admin|checkout)/.test(u.pathname)) return null;
        u.searchParams.set(param, theme);
        return u.pathname + u.search + u.hash;
      } catch (e) {
        return null;
      }
    };
    // esta página se abrió sin el parámetro: se vuelve a pedir con el diseño en borrador
    if (!here) {
      var again = withTheme(location.href);
      if (again) {
        location.replace(again);
        return;
      }
    }
    document.addEventListener(
      "click",
      function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!a || a.target === "_blank") return;
        var raw = a.getAttribute("href") || "";
        if (!raw || raw.charAt(0) === "#" || /^(javascript|mailto|tel):/i.test(raw)) return;
        var next = withTheme(a.href);
        if (next) a.setAttribute("href", next);
      },
      true,
    );
    // los formularios que navegan (buscar) también
    document.addEventListener(
      "submit",
      function (e) {
        var f = e.target;
        if (!f || !f.action || (f.method || "get").toLowerCase() !== "get") return;
        if (f.querySelector('input[name="' + param + '"]')) return;
        var i = document.createElement("input");
        i.type = "hidden";
        i.name = param;
        i.value = theme;
        f.appendChild(i);
      },
      true,
    );
  }

  /* ---------- 4. los agregados existen en la tienda, pero no se venden sueltos ---------- */

  var CATALOG_KEY = "rm.catalog.v2";

  /** saca de los listados las tarjetas de los agregados y manda sus fichas al placard */
  function hideParts(products) {
    if (!products || !products.items) return;
    var ids = Object.keys(products.items).map(function (k) {
      return String(products.items[k]);
    });
    if (!ids.length) return;
    if (!document.getElementById("rm-hide-parts")) {
      var st = document.createElement("style");
      st.id = "rm-hide-parts";
      st.textContent = ids
        .map(function (id) {
          return '[data-product-id="' + id + '"]:not(.js-cart-item)';
        })
        .join(",") + "{display:none!important}";
      document.head.appendChild(st);
    }
    // la celda de la grilla que contenía solo esa tarjeta tampoco tiene que ocupar lugar
    ids.forEach(function (id) {
      var cards = document.querySelectorAll('[data-product-id="' + id + '"]');
      for (var i = 0; i < cards.length; i++) {
        var cell = cards[i].parentNode;
        if (cell && cell.children.length === 1 && cell !== document.body && !cell.classList.contains("js-product-table")) cell.style.display = "none";
      }
    });
    if (products.placard) {
      var mine = document.querySelectorAll('.js-item-product[data-product-id="' + products.placard + '"]');
      for (var m = 0; m < mine.length; m++) {
        var prices = mine[m].querySelectorAll(".js-price-display");
        for (var q = 0; q < prices.length; q++) {
          if (prices[q].getAttribute("data-rm-open")) continue;
          prices[q].setAttribute("data-rm-open", "1");
          prices[q].textContent = OPEN_PRICE;
          prices[q].style.display = "";
        }
        var extra = mine[m].querySelectorAll(".js-compare-price-display, .js-item-installments, .js-max-installments-container, .js-installments-container");
        for (var x = 0; x < extra.length; x++) extra[x].style.display = "none";
      }
    }
    var here = window.LS && LS.product && String(LS.product.id);
    if (here && ids.indexOf(here) >= 0 && products.url) location.replace(products.url);
  }

  function loadCatalog() {
    var cached = store.get(CATALOG_KEY);
    if (cached && cached.products) hideParts(cached.products);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return;
    fetch(BASE + "/api/tn/catalog")
      .then(function (r) {
        return r.json();
      })
      .then(function (c) {
        store.set(CATALOG_KEY, { products: c.products, at: Date.now() });
        hideParts(c.products);
      })
      .catch(function () {});
  }

  /* ---------- 2. agregar al carrito de la tienda ---------- */

  function post(fields) {
    var body = new URLSearchParams();
    fields.forEach(function (f) {
      body.append(f[0], f[1]);
    });
    body.append("add_to_cart_enhanced", "1");
    return fetch("/comprar/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      body: body.toString(),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !j.success || !j.item) throw new Error("cart");
        return j;
      });
    });
  }

  /**
   * Un renglón del carrito por cada renglón del precio: el placard en la
   * variante de su tamaño y cada agregado como su propio producto, todos con el
   * identificador del diseño. Van de a uno: el carrito de la tienda no admite
   * altas en paralelo.
   */
  function addToCart(productId, msg) {
    var saved = msg.saved;
    var lines = store.get(LINES_KEY) || {};
    var tag = ["properties[Diseño]", saved.id];
    var last = null;
    var chain = Promise.resolve();
    // la tienda muestra primero lo último que se agregó: el placard va al final para quedar arriba
    var ordered = saved.lines.filter(function (l) {
      return l.kind !== "placard";
    }).concat(saved.lines.filter(function (l) {
      return l.kind === "placard";
    }));
    ordered.forEach(function (line) {
      chain = chain.then(function () {
        var fields;
        if (line.kind === "placard") {
          fields = [["add_to_cart", String(productId)], ["quantity", "1"]];
          line.variant.forEach(function (v, i) {
            fields.push(["variation[" + i + "]", v]);
          });
          fields.push(tag);
          saved.properties.forEach(function (p) {
            fields.push(["properties[" + p.name + "]", p.value]);
          });
          // para la carpintería: el plano y el despiece de este diseño
          if (msg.sheetUrl) fields.push(["properties[Hoja de taller]", msg.sheetUrl]);
        } else {
          var id = saved.products && saved.products.items && saved.products.items[line.key];
          if (!id) throw new Error("producto sin vincular: " + line.key);
          fields = [["add_to_cart", String(id)], ["quantity", String(line.qty)], tag];
        }
        return post(fields).then(function (j) {
          last = j;
          lines[j.item.id] =
            line.kind === "placard"
              ? { id: saved.id, role: "main", properties: saved.properties, price: saved.price, snapshotUrl: msg.snapshotUrl, viewUrl: msg.viewUrl, sheetUrl: msg.sheetUrl, at: Date.now() }
              : { id: saved.id, role: "item", detail: line.detail, at: Date.now() };
          store.set(LINES_KEY, lines);
        });
      });
    });
    return chain.then(function () {
      refreshCart(last);
      return last;
    });
  }

  /** deja al día lo que el tema muestra del carrito, hasta donde se puede sin tocar el tema */
  function refreshCart(resp) {
    try {
      var cart = resp.cart || {};
      if (window.LS && LS.cart) LS.cart = Object.assign(LS.cart, cart);
      var n = (cart.items || []).reduce(function (a, it) {
        return a + (Number(it.quantity) || 0);
      }, 0);
      var badges = document.querySelectorAll(".js-cart-widget-amount");
      for (var i = 0; i < badges.length; i++) {
        badges[i].textContent = String(n);
        badges[i].style.display = "";
      }
      var list = document.querySelector(".js-ajax-cart-list");
      if (list && resp.html_cart_items) {
        list.innerHTML = resp.html_cart_items;
        var empty = document.querySelectorAll(".js-empty-ajax-cart");
        for (var e = 0; e < empty.length; e++) empty[e].style.display = "none";
        var filled = document.querySelectorAll(".js-visible-on-cart-filled");
        for (var f = 0; f < filled.length; f++) filled[f].style.display = "";
      }
      if (window.LS && typeof LS.refreshTotals === "function") LS.refreshTotals(resp);
    } catch (e) {}
    decorate();
  }

  function done(saved, productName, sheetUrl) {
    var old = document.querySelector(".rm-done");
    if (old) old.remove();
    var wrap = document.createElement("div");
    wrap.className = "rm-done";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML =
      "<div class='rm-card'>" +
      "<h3>Agregado al carrito</h3>" +
      "<div>" + esc(productName) + " · diseño <b class='rm-id'>" + esc(saved.id) + "</b></div>" +
      "<div class='rm-rows'>" +
      saved.lines
        .map(function (l) {
          return (
            "<div><span>" + (l.qty > 1 ? l.qty + " × " : "") + esc(l.name) +
            (l.detail ? "<small>" + esc(l.detail) + (l.qty > 1 ? " · " + money(l.unit) + " c/u" : "") + "</small>" : "") +
            "</span><span>" + money(l.total) + "</span></div>"
          );
        })
        .join("") +
      "</div>" +
      "<div class='rm-total'><span>Total de demostración</span><span>" + money(saved.price) + "</span></div>" +
      "<p class='rm-note' style='margin:10px 0 0'>" + esc(DISCLAIMER) + "</p>" +
      (sheetUrl ? "<p style='margin:12px 0 0;font-size:13px'><a target='_blank' rel='noopener' style='text-decoration:underline' href='" + esc(sheetUrl) + "'>Ver la hoja de taller de este diseño</a> (plano, medidas y despiece)</p>" : "") +
      "<div class='rm-btns'><button type='button' class='rm-ghost' data-rm-close>Seguir diseñando</button><a class='rm-primary' href='/comprar/'>Ver carrito</a></div>" +
      "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target && e.target.hasAttribute && e.target.hasAttribute("data-rm-close"))) wrap.remove();
    });
    document.body.appendChild(wrap);
  }

  /* ---------- 1. el configurador en la ficha del producto ---------- */

  function mount(anchor) {
    var product = (window.LS && LS.product) || {};
    var productId = product.id || anchor.getAttribute("data-rm-product") || "";
    if (!productId) return;
    css();

    var draft = store.get(DRAFT_KEY + productId);
    var src = BASE + "/tn/?p=" + encodeURIComponent(productId) + (draft && draft.c ? "&c=" + encodeURIComponent(draft.c) : "");

    var wrap = document.createElement("div");
    wrap.className = "rm-wrap";
    wrap.id = "rm-configurator";
    wrap.innerHTML =
      "<div class='rm-head'><span class='rm-badge'><i></i>Configurador 3D · armalo a tu medida</span></div>" +
      "<div class='rm-frame'><iframe title='Configurador 3D' allow='fullscreen; xr-spatial-tracking' loading='eager' src='" + esc(src) + "'></iframe></div>" +
      "<p class='rm-note'>" + esc(DISCLAIMER) + "</p>";
    var frame = wrap.querySelector("iframe");

    // arriba de la ficha, a todo el ancho; la galería de fotos deja su lugar al 3D
    var section = document.getElementById("single-product") || document.querySelector(".js-product-detail");
    var columns = section && section.querySelector(".product-columns");
    if (section && columns) {
      section.insertBefore(wrap, section.firstChild);
      var info = columns.querySelector(".js-product-info");
      for (var i = 0; i < columns.children.length; i++) {
        var child = columns.children[i];
        if (info && child !== info && !child.contains(info)) child.classList.add("rm-hide");
      }
      columns.classList.add("rm-solo");
    } else {
      anchor.parentNode.insertBefore(wrap, anchor);
    }

    // el precio de la ficha sigue a la configuración
    var priceEl = document.getElementById("price_display") || document.querySelector(".js-price-display");
    if (priceEl && !document.querySelector(".rm-price-label")) {
      var label = document.createElement("span");
      label.className = "rm-price-label";
      label.textContent = "Tu diseño · precio de demostración";
      priceEl.parentNode.insertBefore(label, priceEl);
    }

    // el botón de compra de la tienda agrega la configuración que se ve
    var form = document.getElementById("product_form") || document.querySelector(".js-product-form");
    var button = form && form.querySelector(".js-addtocart:not(.js-addtocart-placeholder)");
    var say = function (type, extra) {
      frame.contentWindow.postMessage(Object.assign({ source: "rm-store", type: type }, extra || {}), BASE);
    };
    if (form) {
      var qty = form.querySelector(".js-quantity, .form-quantity");
      if (qty) (qty.closest(".form-group") || qty).classList.add("rm-hide");
      // el tamaño lo elige el configurador: los selectores de variante de la tienda no hacen falta
      var selects = form.querySelectorAll(".js-variation-option");
      for (var v = 0; v < selects.length; v++) (selects[v].closest(".form-group") || selects[v].parentNode).classList.add("rm-hide");
      var groups = form.querySelectorAll(".js-product-variants, .product-variants");
      for (var g = 0; g < groups.length; g++) groups[g].classList.add("rm-hide");
      form.addEventListener(
        "submit",
        function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          say("request-add");
        },
        true,
      );
      if (button)
        button.addEventListener(
          "click",
          function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            say("request-add");
          },
          true,
        );
    }
    var busy = function (on) {
      if (!button) return;
      if (on) {
        button.setAttribute("data-rm-label", button.value);
        button.value = "Agregando…";
        button.disabled = true;
      } else {
        button.value = button.getAttribute("data-rm-label") || "Agregar al carrito";
        button.disabled = false;
      }
    };

    window.addEventListener("message", function (e) {
      if (e.origin !== BASE || !e.data || e.data.source !== "rm-configurator") return;
      var d = e.data;
      if (d.type === "change") {
        store.set(DRAFT_KEY + productId, { c: d.c, at: Date.now() });
        if (priceEl) {
          priceEl.textContent = money(d.price);
          priceEl.style.display = "";
        }
      }
      if (d.type === "adding") busy(true);
      if (d.type === "add-failed") busy(false);
      if (d.type === "add") {
        addToCart(productId, d)
          .then(function () {
            busy(false);
            say("added", { ok: true, message: "Listo: agregamos tu placard al carrito (diseño " + d.saved.id + ")." });
            done(d.saved, product.name || "Placard a medida", d.sheetUrl);
          })
          .catch(function () {
            busy(false);
            say("added", { ok: false, message: "No pudimos agregarlo al carrito. Probá de nuevo." });
          });
      }
    });
  }

  /**
   * El diseño nuevo de la tienda de prueba no está publicado: se ve con
   * ?theme_installation_id. Si la ficha se abrió sin eso (con el diseño viejo,
   * que no trae el bloque de código del pie), se vuelve a pedir con el diseño nuevo.
   */
  var PREVIEW_THEME = "14921583";
  function previewFallback() {
    if (location.hostname !== "medida3.mitiendanube.com") return false;
    if (document.querySelector('[data-store^="code-block"]')) return false;
    var u = new URL(location.href);
    if (u.searchParams.get("theme_installation_id")) return false;
    u.searchParams.set("theme_installation_id", PREVIEW_THEME);
    location.replace(u.pathname + u.search + u.hash);
    return true;
  }

  function start() {
    if (previewFallback()) return;
    keepPreview();
    var anchor = document.querySelector("[data-rm-configurator]");
    if (anchor && !document.getElementById("rm-configurator")) mount(anchor);
    css();
    blockCheckout();
    decorate();
    loadCatalog();
    // el tema vuelve a dibujar el carrito cada vez que cambia
    var pending = null;
    new MutationObserver(function () {
      if (pending) return;
      pending = setTimeout(function () {
        pending = null;
        decorate();
        var c = store.get(CATALOG_KEY);
        if (c) hideParts(c.products);
      }, 120);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
