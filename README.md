# Configurador 3D de placares · Randy Muebles (DEMO)

Demostración comercial de un configurador 3D de placares con puertas
corredizas, integrado dentro de la ficha de producto de una tienda
**Tiendanube**. Propuesta privada, no oficial.

> Demostración de configurador 3D. Modelos, colores, opciones y precios
> ilustrativos, sujetos a adaptación al catálogo y las condiciones de
> fabricación del comercio.

- Tienda de prueba: <https://medida3.mitiendanube.com>
- Servidor (producción): <https://randy-muebles-configurador.matiascolimodio.workers.dev>
- Pruebas: `randy-muebles-configurador-staging` · desarrollo: `randy-muebles-configurador-dev`

## Cómo funciona

```
Ficha de producto (Tiendanube)
 └─ descripción del producto:  <div data-rm-configurator="placard-2p"> + <script src=".../tn/embed.js">
     └─ embed.js monta un iframe con /tn/  (el configurador 3D, React + three.js)
         1. cada cambio → el precio de la ficha se actualiza y el borrador queda guardado
         2. "Agregar al carrito" → POST /api/tn/configs  (el Worker valida, cotiza y guarda: RM-XXXXXXXX)
         3. embed.js agrega al carrito de la tienda (POST /comprar/) el producto con la
            configuración como propiedades del ítem + los "Adicionales de personalización"
```

| Parte | Dónde | Qué hace |
| --- | --- | --- |
| Motor (de MEDIDA) | `src/lib/model.ts`, `assembly.ts`, `quote.ts` | Valida, arma el despiece pieza por pieza y cotiza |
| Catálogo de Randy | `src/lib/randy.ts` | **Lo único que hay que editar** para adaptar la demo: modelos, reglas, colores, precios |
| Configurador | `src/components/Configurator.tsx`, `StoreConfigurator.tsx`, `src/app/tn/` | La interfaz 3D en "modo tienda" |
| Script de tienda | `public/tn/embed.js` | Monta el configurador en la ficha, agrega al carrito y muestra el resumen |
| Servidor | `worker/api.ts`, `worker/site.ts` | API de validación y guardado; sirve el sitio desde KV |

### Reutilizado de MEDIDA

El motor 3D, el despiece, el cálculo de precio, los materiales y los controles
vienen de MEDIDA sin cambios de fondo. Lo nuevo de este proyecto: bandejas
extraíbles, combinación de frentes por hoja (una espejada y otra lisa), el modo
tienda con "Agregar al carrito", el servidor de validación y la integración con
Tiendanube. Se quitaron las páginas, cuentas y paneles propios de MEDIDA.
Texturas y modelos de ambientación: Poly Haven, CC0 (`public/tex/CREDITOS.md`,
`public/models/CREDITOS.md`).

## Reglas de fabricación (provisionales)

En `RULES` de `src/lib/randy.ts`:

- cada módulo mide **como mínimo 60 cm** de ancho interior libre;
- el placard completo mide **hasta 3 m**;
- se pueden **sumar módulos** mientras entren: el ancho total cuenta las placas
  (18 mm por lateral y por divisor), así que cuatro módulos de 60 cm ocupan
  4 × 600 + 5 × 18 = 2490 mm y el quinto ya no entra en 3 m;
- cada módulo lleva su hoja corrediza; cajones y bandejas descuentan sus
  correderas y solo se hacen del ancho que las hojas dejan libre.

No se aceptan configuraciones imposibles: lo que se sale de regla se corrige,
en el navegador y otra vez en el servidor.

## Carrito y precio

- La configuración viaja como **propiedades del ítem** (`properties[...]`), el
  mecanismo de Tiendanube para datos por línea. Dos configuraciones distintas
  del mismo producto quedan en líneas separadas (verificado en la tienda).
- Cada configuración tiene un **identificador único** (`RM-XXXXXXXX`). Con él se
  recupera entera: `GET /api/tn/configs/<id>` o, para verla en 3D,
  `/tn/?id=<id>`. Se guarda 180 días.
- **El precio lo calcula el servidor.** Tiendanube no permite cambiar el precio
  de una línea desde la tienda, así que el total se arma con dos líneas reales:
  el producto a su precio base (la configuración más económica del modelo) y
  "Adicionales de personalización (DEMO)" a $1.000 por unidad. La suma es el
  precio validado, redondeado a $1.000.
- El borrador de cada producto queda en el navegador: recargar o navegar no lo
  pierde.

## Vincular un producto de la tienda con un modelo

1. En la descripción del producto (modo HTML):
   ```html
   <div data-rm-configurator="placard-2p"></div>
   <script src="https://randy-muebles-configurador.matiascolimodio.workers.dev/tn/embed.js" async></script>
   ```
2. En `wrangler.jsonc`, sumar el id del producto a `TN_PRODUCT_MODELS` (el
   servidor rechaza un modelo que no corresponde al producto).
3. Poner como precio del producto el `basePrice` que informa `/api/tn/catalog`.

Modelos de la demo: `placard-2p`, `placard-3p`, `placard-espejo`.

## Entornos y despliegue

Tres Workers con su propia base KV: `dev`, `staging` y `production`.

```bash
npm ci
npm test && npm run typecheck && npm run lint
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npm run deploy -- staging
```

`npm run deploy` compila, sube el sitio a KV y publica el Worker. No hay
despliegue automático en cada push.

## Pruebas

- `npm test`: motor, catálogo, reglas y API (116 pruebas).
- `node scripts/e2e-tienda.cjs desktop|mobile`: recorre la tienda real — abre un
  placard, cambia medidas, suma un módulo, cajones, estantes y bandejas, colores,
  una puerta espejada, agrega al carrito y comprueba que el total del carrito es
  el precio validado y que la configuración se recupera entera del servidor. No
  compra nada.

## Límites conocidos

- **El resumen dentro del carrito necesita publicar el diseño.** En la ficha el
  script entra por la descripción del producto; para que también corra en la
  página del carrito hay un borrador del tema ("Randy Muebles · configurador 3D
  (DEMO)") con un bloque de código en el pie. Hasta publicarlo, el carrito
  muestra las dos líneas y el total correctos, pero sin el detalle.
- **La cantidad de "Adicionales" se puede editar a mano en el carrito.** El
  servidor guarda el precio validado con cada configuración, pero hoy nadie lo
  compara contra el pedido. La versión comercial lo resuelve con una aplicación
  de Tiendanube (ver abajo).
- **No se probó un pedido de punta a punta.** La tienda tiene Pago Nube real:
  no se generaron pedidos. Falta confirmar que las propiedades del ítem llegan
  al pedido en el administrador.
- El resumen por ítem se guarda en el navegador del comprador; en otro
  dispositivo el carrito muestra las líneas sin el detalle (el identificador
  permite recuperarlo).
- Precios, colores, modelos y reglas son de demostración.
- El repositorio pedido (`randy-muebles-configurador`, privado) no se pudo
  crear desde esta sesión: el código está en `MATKROL77/Randy-Muebles`.

## De prototipo a solución comercial

1. **Datos de Randy**: modelos, medidas, colores y terminaciones reales, costos
   y recargos, reglas de fabricación → `src/lib/randy.ts` y `src/lib/catalog.ts`.
2. **Aplicación de Tiendanube** (portal de socios) instalada en la tienda de
   Randy, para:
   - cargar el script con la API de Scripts/NubeSDK en vez de la descripción y
     el bloque del tema;
   - precio exacto por configuración (pedido borrador o variante creada por el
     servidor), sin la línea de adicionales;
   - webhook de pedido creado: comparar el pedido con la configuración guardada
     y adjuntarla (nota del pedido / despiece en PDF para el taller).
3. **Dominio propio** para el servidor y repositorio privado.
4. **Panel simple** para que Randy edite modelos, colores y precios sin tocar
   código (hoy es un archivo).
5. Renders con fotos y marca reales, con autorización.
