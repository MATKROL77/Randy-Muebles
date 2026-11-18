/**
 * Publica un entorno: sube el sitio compilado (out/) a la base KV del entorno
 * y después el Worker.
 *
 *   npm run deploy -- staging      (dev | staging | production)
 *
 * Necesita CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en el entorno. No
 * guarda ni imprime la clave.
 *
 * Solo sube los archivos que cambiaron desde la publicación anterior: el plan
 * gratuito de KV admite 1.000 escrituras por día y el sitio tiene unos cien
 * archivos, así que reescribirlo entero en cada publicación agota el cupo.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const env = process.argv[2];
if (!["dev", "staging", "production"].includes(env)) {
  console.error("Uso: npm run deploy -- <dev|staging|production>");
  process.exit(1);
}
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) {
  console.error("Faltan CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID.");
  process.exit(1);
}

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
const namespace = config.env[env].kv_namespaces[0].id;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".hdr": "application/octet-stream",
  ".map": "application/json",
};

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const all = walk("out").map((file) => {
  const bytes = readFileSync(file);
  return {
    key: `site:/${relative("out", file).split("\\").join("/")}`,
    value: bytes.toString("base64"),
    base64: true,
    metadata: { type: TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" },
    hash: createHash("sha1").update(bytes).digest("hex"),
  };
});

// qué se publicó la última vez: una sola lectura
const api = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}`;
const MANIFEST = "site:__manifest";
const previous = await fetch(`${api}/values/${encodeURIComponent(MANIFEST)}`, { headers: { Authorization: `Bearer ${token}` } })
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}));
const files = all.filter((f) => previous[f.key] !== f.hash).map(({ hash, ...f }) => f);
console.log(`Sitio: ${all.length} archivos, ${files.length} cambiaron.`);

// KV acepta hasta 100 MB por pedido: se manda en tandas de ~20 MB
const batches = files.length ? [[]] : [];
let size = 0;
for (const f of files) {
  if (size + f.value.length > 20_000_000 && batches.at(-1).length) {
    batches.push([]);
    size = 0;
  }
  batches.at(-1).push(f);
  size += f.value.length;
}
for (const [i, batch] of batches.entries()) {
  const res = await fetch(`${api}/bulk`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    console.error(`La tanda ${i + 1} no se pudo subir:`, res.status, JSON.stringify(body?.errors ?? null));
    process.exit(1);
  }
  console.log(`Sitio: tanda ${i + 1}/${batches.length} (${batch.length} archivos)`);
}
if (files.length) {
  // el registro de lo publicado, para la próxima vez
  const manifest = Object.fromEntries(all.map((f) => [f.key, f.hash]));
  const res = await fetch(`${api}/bulk`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ key: MANIFEST, value: JSON.stringify(manifest) }]),
  });
  if (!res.ok) console.error("No se pudo guardar el registro de lo publicado:", res.status);
}
console.log(`Sitio: ${files.length} archivos subidos a la base de ${env}.`);

execFileSync("npx", ["wrangler", "deploy", "--env", env], { stdio: "inherit" });
