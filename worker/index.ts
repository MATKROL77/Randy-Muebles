/**
 * Servidor del configurador de Randy Muebles (DEMO).
 *
 * /api  valida cada configuración con el mismo motor que usa el navegador,
 *       calcula el precio del lado del servidor y la guarda con un
 *       identificador único.
 * resto el sitio estático (el configurador 3D y el script de la tienda).
 */

import { handle, type Env } from "./api.ts";
import { serveSite, type SiteStore } from "./site.ts";

export default {
  async fetch(request: Request, env: Env & { CONFIGS: SiteStore }, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/")) return handle(request, env);
    return serveSite(request, env.CONFIGS, ctx);
  },
} satisfies ExportedHandler<Env & { CONFIGS: SiteStore }>;
