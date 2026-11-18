import { DISCLAIMER } from "@/lib/randy";

export default function Home() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-6 px-6 py-16">
      <p className="eyebrow">Propuesta privada · DEMO</p>
      <h1 className="display-md">Configurador 3D de placares corredizos</h1>
      <p className="text-ink-2">Este servidor aloja el configurador que se muestra dentro de la ficha de producto de la tienda.</p>
      <a className="link-arrow" href="/tn/">
        Abrir el configurador suelto
      </a>
      <p className="text-xs leading-relaxed text-ink-2">{DISCLAIMER}</p>
    </main>
  );
}
