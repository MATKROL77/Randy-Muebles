# Configurador 3D de placares · Randy Muebles (DEMO)

Demostración comercial de un configurador 3D de placares con puertas
corredizas, integrado dentro de la ficha de producto de una tienda
**Tiendanube**. Propuesta privada, no oficial.

> Demostración de configurador 3D. Modelos, colores, opciones y precios
> ilustrativos, sujetos a adaptación al catálogo y las condiciones de
> fabricación del comercio.

- Tienda de prueba: <https://medida3.mitiendanube.com>
- Producto: <https://medida3.mitiendanube.com/productos/placard-corredizo-a-medida-demo-1rp23/>
- Servidor (producción): <https://randy-muebles-configurador.matiascolimodio.workers.dev>
- Pruebas: `randy-muebles-configurador-staging` · desarrollo: `randy-muebles-configurador-dev`

## Cómo funciona

```
Ficha del producto "Placard corredizo a medida" (Tiendanube)
 └─ descripción:  <div data-rm-configurator="placard"> + <script src=".../tn/embed.js">
     └─ embed.js monta un iframe con /tn/  (el configurador 3D, React + three.js)
         1. cada cambio → el precio de la ficha se actualiza y el borrador queda guardado
         2. "Agregar al carrito" → POST /api/tn/configs
            (el Worker valida, cotiza renglón por renglón y guarda: RM-XXXXXXXX)
         3. embed.js agrega al carrito de la tienda (POST /comprar/) un renglón por cada
            renglón del precio, todos con el código del diseño
```

| Parte | Dónde | Qué hace |
| --- | --- | --- |
| Motor (de MEDIDA) | `src/lib/model.ts`, `assembly.ts`, `quote.ts` | Valida y arma el despiece pieza por pieza |
| Catálogo de Randy | `src/lib/randy.ts` | **Lo único que hay que editar**: reglas, lista de precios, arranque |
| Configurador | `src/components/Configurator.tsx`, `StoreConfigurator.tsx`, `src/app/tn/` | La interfaz 3D en "modo tienda" |
| Hoja de taller | `src/components/Workshop.tsx`, `ElevationDrawing.tsx`, `src/app/tn/taller/` | Plano, hojas y despiece de un diseño guardado |
| Script de tienda | `public/tn/embed.js` | Monta el configurador, agrega al carrito, resume y oculta los agregados |
| Servidor | `worker/api.ts`, `worker/site.ts` | API de validación y guardado; sirve el sitio desde KV |

### Reutilizado de MEDIDA

El motor 3D, el despiece, los materiales, los controles, la vista de taller y el
PDF vienen de MEDIDA (`MATKROL77/MEDIDA`), que no se toca. Lo nuevo: bandejas
extraíbles, frente y color por hoja, modo tienda, lista de precios por
renglones, plano del interior para el taller, servidor de validación e
integración con Tiendanube. Texturas y modelos de ambientación: Poly Haven, CC0
(`public/tex/CREDITOS.md`, `public/models/CREDITOS.md`).

## Un solo producto, a gusto

La tienda tiene **un producto**: "Placard corredizo a medida". Arranca con dos
módulos y la persona lo arma: medidas, más módulos, el interior de cada uno
(barral, doble barral, estantes, cajones, bandejas), el frente y el color de
cada hoja (lisa, ranurada, espejo, vidrio) y luz LED. En el 3D se gira, se hace
zoom, se toca una hoja para correrla y se abren los cajones.

## Reglas de fabricación (provisionales)

En `RULES` de `src/lib/randy.ts`:

- cada módulo mide **como mínimo 60 cm** de ancho interior libre;
- el placard completo mide **hasta 3 m**;
- se pueden **sumar módulos** mientras entren. El ancho total cuenta las placas
  (18 mm por lateral y por divisor): cuatro módulos de 60 cm ocupan
  4 × 600 + 5 × 18 = 2490 mm y el quinto ya no entra en 3 m;
- cada módulo lleva su hoja corrediza; cajones y bandejas descuentan sus
  correderas y solo se hacen del ancho que las hojas dejan libre.

Lo que se sale de regla se corrige, en el navegador y otra vez en el servidor.

## Precio: el placard por tamaño, y cada agregado en su renglón

Lista de precios de demostración en `PRICES` de `src/lib/randy.ts`.

- **Placard a medida**: su precio depende del tamaño. Se cobra por escalones
  ("hasta 280 cm" de ancho, "hasta 250 cm" de alto, "hasta 65 cm" de
  profundidad) e incluye estructura, dos módulos con sus hojas corredizas lisas,
  rieles, zócalo y la terminación. En la tienda cada escalón es una **variante**
  del producto (72 en total), así que el precio del renglón es real.
- **Agregados**, cada uno con su precio unitario y su renglón: módulo adicional,
  cajón, bandeja extraíble, estante, barral, puerta espejada, puerta de vidrio,
  puerta ranurada y luz LED por módulo. En la tienda cada uno es un producto.
- Las cantidades salen del despiece (lo mismo que se ve en 3D): lo que está
  dibujado está cobrado, y nada más.
- **El precio lo calcula el servidor.** Lo que manda el navegador se ignora.

El mismo detalle se ve en el configurador ("Detalle del precio"), al agregar al
carrito, en el carrito de la tienda y en la hoja de taller.

## Carrito

- Un renglón del carrito por cada renglón del precio, con su cantidad y su
  precio de tienda. La suma es exactamente el precio validado.
- Todos los renglones llevan el **código del diseño** (`RM-XXXXXXXX`) como
  propiedad del ítem; el del placard lleva además el resumen (medidas, puertas,
  módulo por módulo, cuerpo) y el enlace a su hoja de taller.
- El borrador queda en el navegador: recargar o navegar no lo pierde.
- Con el diseño nuevo publicado (ver "Publicar el diseño"), en el carrito: el
  resumen del diseño junto al placard, las cantidades de los agregados no se
  pueden cambiar ni quitar sueltas, y quitar el placard quita sus agregados.

## Hoja de taller

`/tn/taller/?id=RM-XXXXXXXX` — lo que necesita la carpintería para armarlo:

- lo que pidió el cliente y el precio validado;
- la imagen del diseño tal como lo vio (cuando se pudo capturar);
- **plano del interior**, de frente y sin hojas, con el ancho de cada módulo y
  la altura desde el piso de cada estante, barral, cajón y bandeja;
- las **hojas corredizas**: frente, terminación, medida y riel de cada una;
- piezas con su dibujo, despiece, plano de corte por placa y herrajes;
- descarga en PDF y CSV, e impresión.

`/tn/?id=RM-XXXXXXXX` abre ese mismo diseño en 3D. Los diseños se guardan 180
días.

## Los agregados no se venden sueltos

Tienen que existir como productos (son los renglones del carrito), pero no se
ofrecen: el script los saca de los listados y, si alguien entra a la ficha de
uno, lo lleva al placard. Funciona en toda la tienda cuando el diseño nuevo
está publicado. Complemento recomendado: marcarlos como ocultos del catálogo
desde el administrador de Tiendanube.

## Publicar el diseño

En el administrador de la tienda, sección de diseño, hay un borrador llamado
**"Randy Muebles · configurador 3D (DEMO)"**. Publicarlo activa:

- la estética de MEDIDA (beige y azul tinta, títulos serif) y la portada propia,
  con el placard como producto destacado "configurable a tu gusto";
- el script en todas las páginas: resumen en el carrito, cantidades de agregados
  bloqueadas y agregados fuera de los listados.

Vista previa sin publicar: <https://medida3.mitiendanube.com/?theme_installation_id=14921583>

## Vincular la tienda

`TN_PRODUCTS` en `wrangler.jsonc`: el id del producto placard, su dirección y el
id de cada agregado. El servidor solo acepta diseños para ese producto.
`GET /api/tn/catalog` informa reglas, lista de precios y las 72 variantes de
tamaño con su precio, para cargarlas en otra tienda.

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

- `npm test`: motor, reglas, lista de precios y API (117 pruebas).
- `node scripts/e2e-tienda.cjs desktop|mobile`: recorre la tienda real — abre el
  placard, cambia medidas, suma un módulo, cajones, estantes y bandejas, colores
  y una puerta espejada, recarga, agrega al carrito y comprueba que cada renglón
  del carrito tiene la cantidad y el precio validados, que el total coincide,
  que el diseño se recupera entero y que la hoja de taller trae el plano y el
  despiece. No compra nada.

## Límites conocidos

- **Hay que publicar el borrador del diseño** para que el resumen, el bloqueo de
  cantidades y el ocultamiento de agregados funcionen fuera de la ficha.
- **El bloqueo de cantidades es de la interfaz.** Sin una aplicación de
  Tiendanube, el servidor no puede impedir que alguien arme un carrito a mano.
  El precio validado queda guardado con cada diseño para compararlo.
- **No se probó un pedido de punta a punta.** La tienda tiene Pago Nube real:
  no se generaron pedidos. Falta confirmar que las propiedades del ítem (código
  del diseño, hoja de taller) se ven en el pedido dentro del administrador.
- El tamaño se cobra por escalones, no al centímetro (72 variantes).
- El color no cambia el precio en esta lista de demostración.
- La imagen del diseño depende de que el navegador pueda capturar el 3D.
- El resumen por ítem en el carrito se guarda en el navegador del comprador.
- Precios, colores y reglas son de demostración.
- El repositorio pedido (`randy-muebles-configurador`, privado) no se pudo
  crear desde esta sesión: el código está en `MATKROL77/Randy-Muebles`.

## De prototipo a solución comercial

1. **Datos de Randy**: medidas y reglas reales, lista de precios, colores y
   terminaciones → `src/lib/randy.ts` y `src/lib/catalog.ts`.
2. **Aplicación de Tiendanube** (portal de socios) instalada en su tienda, para:
   cargar el script sin depender de la descripción ni del tema; precio exacto al
   centímetro (pedido borrador o variante creada por el servidor); y un webhook
   de pedido creado que compare el pedido con el diseño guardado y adjunte la
   hoja de taller.
3. **Dominio propio** para el servidor y repositorio privado.
4. **Panel simple** para que Randy edite reglas y precios sin tocar código.
5. Fotos y marca reales, con autorización.
