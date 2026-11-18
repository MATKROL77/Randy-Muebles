/**
 * El sitio estático (el configurador), servido desde la misma base KV.
 *
 * `scripts/deploy.mjs` sube cada archivo de `out/` con la clave `site:<ruta>` y
 * su tipo en los metadatos. Lo que no es HTML queda además en la caché del
 * borde de Cloudflare, así que KV se lee una vez por archivo y por zona.
 */

export type SiteStore = {
  getWithMetadata(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: unknown }>;
};

const DAY = 86_400;

function cacheControl(path: string): string {
  if (path.startsWith("/_next/static/")) return "public, max-age=31536000, immutable";
  if (/^\/(tex|models|env)\//.test(path)) return `public, max-age=${DAY}, stale-while-revalidate=${7 * DAY}`;
  if (path === "/tn/embed.js") return "public, max-age=300";
  if (path.endsWith(".html")) return "no-cache";
  return "public, max-age=3600";
}

/** las claves que pueden responder a una ruta, en orden */
export function candidates(pathname: string): string[] {
  const path = decodeURIComponent(pathname);
  if (path.endsWith("/")) return [`${path}index.html`];
  if (/\.[a-z0-9]+$/i.test(path)) return [path];
  return [`${path}/index.html`, `${path}.html`];
}

export async function serveSite(request: Request, store: SiteStore, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
  const url = new URL(request.url);
  const edge = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;
  const cacheKey = new Request(url.origin + url.pathname, { method: "GET" });
  if (edge) {
    const hit = await edge.match(cacheKey);
    if (hit) return request.method === "HEAD" ? new Response(null, hit) : hit;
  }

  let found: { path: string; value: ArrayBuffer; type: string } | null = null;
  let status = 200;
  for (const path of candidates(url.pathname)) {
    const { value, metadata } = await store.getWithMetadata(`site:${path}`, "arrayBuffer");
    if (value) {
      found = { path, value, type: (metadata as { type?: string } | null)?.type ?? "application/octet-stream" };
      break;
    }
  }
  if (!found) {
    const { value } = await store.getWithMetadata("site:/404.html", "arrayBuffer");
    if (!value) return new Response("No encontrado", { status: 404 });
    found = { path: "/404.html", value, type: "text/html; charset=utf-8" };
    status = 404;
  }

  const headers = new Headers({
    "Content-Type": found.type,
    "Cache-Control": status === 200 ? cacheControl(found.path) : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // es una propuesta privada: que no se indexe
    "X-Robots-Tag": "noindex",
  });
  if (found.path === "/tn/embed.js") headers.set("Access-Control-Allow-Origin", "*");
  const response = new Response(found.value, { status, headers });
  if (edge && status === 200 && !found.path.endsWith(".html")) {
    const put = edge.put(cacheKey, response.clone());
    if (ctx) ctx.waitUntil(put);
    else await put;
  }
  return request.method === "HEAD" ? new Response(null, response) : response;
}
