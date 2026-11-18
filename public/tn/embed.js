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
 *   <div data-rm-configurator="placard-2p"></div>
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
      "@media (max-width:1023px){.rm-wrap{padding:0;margin-bottom:18px}.rm-head{padding:0 14px}.rm-frame{border-radius:0}.rm-frame iframe{height:calc(100vh - 64px);height:calc(100svh - 64px)}}",
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
      ".rm-done{position:fixed;inset:0;z-index:2147483000;background:rgba(20,18,15,.55);display:flex;align-items:flex-end;justify-content:center;padding:0}",
      "@media (min-width:640px){.rm-done{align-items:center;padding:24px}}",
      ".rm-card{background:#fff;color:#1f1d1a;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:22px 20px 18px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);font-size:14px;line-height:1.5}",
      "@media (min-width:640px){.rm-card{border-radius:20px}}",
      ".rm-card h3{margin:0 0 4px;font-size:19px;line-height:1.25}.rm-card .rm-total{display:flex;justify-content:space-between;gap:12px;padding:10px 0 0;margin-top:10px;border-top:1px solid rgba(0,0,0,.1);font-weight:600}",
      ".rm-card .rm-rows{font-size:13px;margin-top:8px}.rm-card .rm-rows div{display:flex;justify-content:space-between;gap:12px}",
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
      if (line.role === "extras") {
        box.innerHTML = "Adicionales de la configuración <b class='rm-id'>" + esc(line.id) + "</b>. Se compran junto con el placard.";
      } else {
        box.innerHTML =
          (line.snapshotUrl ? "<img alt='' loading='lazy' src='" + esc(line.snapshotUrl) + "'>" : "") +
          "<b>Configuración</b> <span class='rm-id'>" + esc(line.id) + "</span>" +
          "<dl>" +
          line.properties
            .map(function (p) {
              return "<dt>" + esc(p.name) + "</dt><dd>" + esc(p.value) + "</dd>";
            })
            .join("") +
          "</dl>" +
          "<small>Precio de demostración: " + money(line.price) + " · <a target='_blank' rel='noopener' href='" + esc(line.viewUrl) + "'>ver en 3D</a></small>";
      }
      var host = el.querySelector(".cart-item-info-container") || el;
      host.appendChild(box);
    }
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

  function addToCart(productId, msg) {
    var saved = msg.saved;
    var props = [["properties[Configuración]", saved.id]].concat(
      saved.properties.map(function (p) {
        return ["properties[" + p.name + "]", p.value];
      }),
    );
    props.push(["properties[Precio DEMO]", money(saved.price)]);
    var lines = store.get(LINES_KEY) || {};
    return post([["add_to_cart", String(productId)], ["quantity", "1"]].concat(props))
      .then(function (j) {
        lines[j.item.id] = { id: saved.id, role: "main", properties: saved.properties, price: saved.price, snapshotUrl: msg.snapshotUrl, viewUrl: msg.viewUrl, at: Date.now() };
        store.set(LINES_KEY, lines);
        if (!saved.extraUnits || !saved.extrasProductId) return j;
        return post([["add_to_cart", String(saved.extrasProductId)], ["quantity", String(saved.extraUnits)], ["properties[Configuración]", saved.id]]).then(function (k) {
          lines[k.item.id] = { id: saved.id, role: "extras", at: Date.now() };
          store.set(LINES_KEY, lines);
          return k;
        });
      })
      .then(function (last) {
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

  function done(saved, productName) {
    var old = document.querySelector(".rm-done");
    if (old) old.remove();
    var extras = saved.extraUnits * saved.extraUnit;
    var wrap = document.createElement("div");
    wrap.className = "rm-done";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML =
      "<div class='rm-card'>" +
      "<h3>Agregado al carrito</h3>" +
      "<div>" + esc(productName) + " · configuración <b class='rm-id'>" + esc(saved.id) + "</b></div>" +
      "<div class='rm-cfg'><dl>" +
      saved.properties
        .map(function (p) {
          return "<dt>" + esc(p.name) + "</dt><dd>" + esc(p.value) + "</dd>";
        })
        .join("") +
      "</dl></div>" +
      "<div class='rm-rows'><div><span>Placard (precio base)</span><span>" + money(saved.base) + "</span></div>" +
      (extras ? "<div><span>Adicionales de personalización</span><span>" + money(extras) + "</span></div>" : "") +
      "</div>" +
      "<div class='rm-total'><span>Total de demostración</span><span>" + money(saved.price) + "</span></div>" +
      "<p class='rm-note' style='margin:10px 0 0'>" + esc(DISCLAIMER) + "</p>" +
      "<div class='rm-btns'><button type='button' class='rm-ghost' data-rm-close>Seguir configurando</button><a class='rm-primary' href='/comprar/'>Ver carrito</a></div>" +
      "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target && e.target.hasAttribute && e.target.hasAttribute("data-rm-close"))) wrap.remove();
    });
    document.body.appendChild(wrap);
  }

  /* ---------- 1. el configurador en la ficha del producto ---------- */

  function mount(anchor) {
    var model = anchor.getAttribute("data-rm-configurator");
    var product = (window.LS && LS.product) || {};
    var productId = product.id || anchor.getAttribute("data-rm-product") || "";
    if (!model || !productId) return;
    css();

    var draft = store.get(DRAFT_KEY + productId);
    var src = BASE + "/tn/?m=" + encodeURIComponent(model) + "&p=" + encodeURIComponent(productId) + (draft && draft.c ? "&c=" + encodeURIComponent(draft.c) : "");

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
      label.textContent = "Precio de demostración";
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
            say("added", { ok: true, message: "Listo: agregamos tu placard al carrito (configuración " + d.saved.id + ")." });
            done(d.saved, product.name || d.saved.modelName);
          })
          .catch(function () {
            busy(false);
            say("added", { ok: false, message: "No pudimos agregarlo al carrito. Probá de nuevo." });
          });
      }
    });
  }

  function start() {
    var anchor = document.querySelector("[data-rm-configurator]");
    if (anchor && !document.getElementById("rm-configurator")) mount(anchor);
    css();
    decorate();
    // el tema vuelve a dibujar el carrito cada vez que cambia
    var pending = null;
    new MutationObserver(function () {
      if (pending) return;
      pending = setTimeout(function () {
        pending = null;
        decorate();
      }, 120);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
