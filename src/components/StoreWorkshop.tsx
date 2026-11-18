"use client";

import { useEffect, useState } from "react";

import Workshop from "@/components/Workshop";
import type { WardrobeConfig } from "@/lib/model";
import { enforce, setupCatalog, type PriceLine } from "@/lib/randy";

type Saved = { id: string; config: Partial<WardrobeConfig>; createdAt: string; price: number; lines: PriceLine[]; properties: { name: string; value: string }[] };

/**
 * La hoja de taller de un diseño guardado: /tn/taller/?id=RM-XXXXXXXX.
 * Es lo que le llega a la carpintería con el pedido: la imagen del diseño, el
 * plano con qué va en cada módulo y a qué altura, las hojas, y el despiece.
 */
export default function StoreWorkshop() {
  const [state, setState] = useState<{ saved: Saved; config: WardrobeConfig; snapshot: string | null } | "cargando" | "no_disponible">("cargando");

  useEffect(() => {
    setupCatalog();
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    fetch(`/api/tn/configs/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (saved: Saved) => {
        const img = await fetch(`/api/tn/configs/${saved.id}/snapshot`, { method: "HEAD" }).catch(() => null);
        setState({ saved, config: enforce(saved.config), snapshot: img?.ok ? `/api/tn/configs/${saved.id}/snapshot` : null });
      })
      .catch(() => setState("no_disponible"));
  }, []);

  if (state === "cargando") return <div className="shimmer h-dvh" role="status" aria-label="Cargando la hoja de taller" />;
  if (state === "no_disponible") {
    return (
      <main className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="display-md">Esta hoja de taller no está disponible.</h1>
          <p className="mt-3 text-ink-2">Revisá el código del diseño (RM-XXXXXXXX) que figura en el pedido.</p>
        </div>
      </main>
    );
  }
  const { saved, config, snapshot } = state;
  return <Workshop config={config} sheet={{ id: saved.id, createdAt: saved.createdAt, snapshot, price: saved.price, lines: saved.lines, properties: saved.properties }} />;
}
