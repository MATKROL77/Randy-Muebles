"use client";

import { useEffect, useRef, useState } from "react";

import Configurator, { type StoreMode } from "@/components/Configurator";
import type { WardrobeConfig } from "@/lib/model";
import { BRAND, DISCLAIMER, MODELS, basePrice, demoQuote, enforce, initialConfig, modelById, setupCatalog, type RandyModel } from "@/lib/randy";
import { decodeConfig, encodeConfig } from "@/lib/share";

/** lo que el servidor devuelve al guardar una configuración */
type Saved = { id: string; price: number; base: number; extraUnits: number; properties: { name: string; value: string }[]; modelName: string; extrasProductId: string | null; hasSnapshot: boolean };

const SOURCE = "rm-configurator";
const embedded = () => typeof window !== "undefined" && window.parent !== window;

/** le habla a la página de la tienda que contiene al configurador */
function tell(type: string, data: Record<string, unknown> = {}) {
  if (embedded()) window.parent.postMessage({ source: SOURCE, type, ...data }, "*");
}

/**
 * El configurador dentro de la ficha de un producto de Tiendanube.
 *
 *   /tn/?m=<modelo>&p=<id de producto>&c=<configuración guardada en la sesión>
 *   /tn/?id=RM-XXXXXXXX   abre una configuración guardada (carrito, pedido, taller)
 *
 * No toca el carrito: valida y guarda en el servidor, y le pasa el resultado a
 * la página de la tienda, que es la que agrega al carrito con sus mecanismos.
 */
export default function StoreConfigurator() {
  const [state, setState] = useState<{ model: RandyModel; initial: WardrobeConfig; productId: string | null; savedId: string | null } | "cargando" | "no_disponible">("cargando");
  const addRef = useRef<(() => void) | null>(null);
  const pending = useRef<((r: { ok: boolean; message: string }) => void) | null>(null);

  useEffect(() => {
    setupCatalog();
    const q = new URLSearchParams(window.location.search);
    const productId = q.get("p");
    const id = q.get("id");
    const open = (model: RandyModel | undefined, config: Partial<WardrobeConfig> | null, savedId: string | null) => {
      if (!model) return setState("no_disponible");
      setState({ model, initial: config ? enforce(model, config) : initialConfig(model), productId, savedId });
    };
    if (id) {
      fetch(`/api/tn/configs/${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((saved: { model: string; config: Partial<WardrobeConfig>; id: string }) => open(modelById(saved.model), saved.config, saved.id))
        .catch(() => setState("no_disponible"));
    } else {
      open(modelById(q.get("m")) ?? (q.get("m") ? undefined : MODELS[0]), decodeConfig(q.get("c")), null);
    }

    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; ok?: boolean; message?: string } | null;
      if (!d || d.source !== "rm-store") return;
      if (d.type === "request-add") addRef.current?.();
      if (d.type === "added" && pending.current) {
        pending.current({ ok: !!d.ok, message: String(d.message ?? "") });
        pending.current = null;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (state === "cargando") return <div className="shimmer h-dvh" role="status" aria-label="Cargando el configurador" />;
  if (state === "no_disponible") {
    return (
      <main className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="display-md">Este configurador no está disponible.</h1>
          <p className="mt-3 text-ink-2">Puede que el enlace esté mal escrito o que la configuración haya vencido.</p>
        </div>
      </main>
    );
  }

  const { model, productId, savedId } = state;
  const store: StoreMode = {
    disclaimer: DISCLAIMER,
    fit: (c) => enforce(model, c),
    width: model.width,
    lockModules: true,
    addRef,
    onChange: (config) => {
      const q = demoQuote(model, config);
      tell("change", { c: encodeConfig(config), price: q.price, base: q.base, model: model.id });
    },
    onAddToCart: async (config, snapshot) => {
      tell("adding");
      const res = await fetch("/api/tn/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.id, config, productId, snapshot: snapshot && snapshot.length < 200_000 ? snapshot : null }),
      });
      if (!res.ok) {
        tell("add-failed");
        return { ok: false, message: "No pudimos validar la configuración. Probá de nuevo." };
      }
      const saved = (await res.json()) as Saved;
      if (!embedded()) return { ok: true, message: `Configuración ${saved.id} guardada. Para agregarla al carrito, abrila desde la ficha del producto en la tienda.` };
      // la tienda agrega al carrito y avisa cómo le fue
      const answer = new Promise<{ ok: boolean; message: string }>((resolve) => {
        pending.current = resolve;
        setTimeout(() => {
          if (pending.current === resolve) {
            pending.current = null;
            resolve({ ok: false, message: "La tienda no respondió. Revisá el carrito antes de volver a intentar." });
          }
        }, 25_000);
      });
      tell("add", { saved, snapshotUrl: saved.hasSnapshot ? `${window.location.origin}/api/tn/configs/${saved.id}/snapshot` : null, viewUrl: `${window.location.origin}/tn/?id=${saved.id}` });
      return answer;
    },
  };

  return (
    <>
      {savedId && (
        <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-on-dark shadow-lg" data-rm="saved-id">
          Configuración {savedId}
        </div>
      )}
      <Configurator workshop={{ name: BRAND.name, whatsapp: "" }} initial={state.initial} store={store} />
      <span hidden data-rm="base-price">{basePrice(model)}</span>
    </>
  );
}
