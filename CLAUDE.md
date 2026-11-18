# Contexto del proyecto

**Configurador 3D de placares para Randy Muebles (DEMO)**, integrado en una
tienda Tiendanube de prueba. Es una propuesta privada de Matías Colimodio;
no es un producto oficial de Randy Muebles. Nace de **MEDIDA**
(`MATKROL77/MEDIDA`), cuyo motor reutiliza; MEDIDA sigue en su repositorio y
este proyecto no lo toca.

Next.js 15 + TypeScript + Tailwind v4 + react-three-fiber (export estático) y
un Worker de Cloudflare. Leé el `README.md` antes de tocar código.

## Reglas

- **Todo lo comercial es DEMO.** Modelos, colores, precios y reglas de
  fabricación son ilustrativos hasta que el comercio pase los suyos, y la
  leyenda de demostración se ve siempre.
- **No se presenta como terminado lo que no existe**, ni se simula como real
  una integración que no anda. Lo que falta se dice (ver "Límites" en el README).
- **El precio lo pone el servidor.** El navegador nunca manda un precio que se
  use: el Worker vuelve a validar y cotizar con el mismo motor.
- Lo que se ve en 3D y el despiece salen de `buildAssembly`: no dibujar piezas
  que no estén en el despiece ni al revés.
- Español rioplatense, con voseo.
- No se guardan claves ni credenciales en Git. No se tocan la tienda real de
  Randy ni el Worker `medida`.

## Antes de dar algo por terminado

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Si tocaste algo visual, verificalo a 390 px y a 1440 px, y corré
`node scripts/e2e-tienda.cjs desktop` y `mobile` contra la tienda.
