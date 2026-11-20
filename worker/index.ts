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
    const path = new URL(request.url).pathname;
    // link corto para mandar la demo: la tienda de prueba con el diseño nuevo (sin publicar)
    if (path === "/demo" || path === "/demo/") {
      return new Response(null, { status: 302, headers: { Location: "https://medida3.mitiendanube.com/?theme_installation_id=14921583", "Cache-Control": "no-store" } });
    }
    if (path.startsWith("/api/")) return handle(request, env);
    return serveSite(request, env.CONFIGS, ctx);
  },
} satisfies ExportedHandler<Env & { CONFIGS: SiteStore }>;
