import { DISCLAIMER, MODELS } from "@/lib/randy";

export default function Home() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-6 px-6 py-16">
      <p className="eyebrow">Propuesta privada · DEMO</p>
      <h1 className="display-md">Configurador 3D de placares corredizos</h1>
      <p className="text-ink-2">Este servidor aloja el configurador que se muestra dentro de la ficha de producto de la tienda. Cada modelo se puede abrir suelto:</p>
      <ul className="grid gap-2">
        {MODELS.map((m) => (
          <li key={m.id}>
            <a className="link-arrow" href={`/tn/?m=${m.id}`}>
              {m.name}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-ink-2">{DISCLAIMER}</p>
    </main>
  );
}
