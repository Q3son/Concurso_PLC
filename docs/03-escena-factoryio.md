# 3. Escena de Factory I/O

## 3.0 Escena lista (recomendado)

La escena oficial es [`factoryio/SmartFactory_TapasBases.factoryio`](../factoryio/SmartFactory_TapasBases.factoryio),
probada con CODESYS Control Win y Factory I/O 2.5.10: la celda completa con sus **69 señales ya
asignadas** al driver Modbus TCP/IP Client en el mismo orden que `GVL_IO`.

1. Ábrela en Factory I/O (doble clic o *File > Open*).
2. **F4** → **Modbus TCP/IP Client**: Host `127.0.0.1`, Port `502`, Slave ID `1` → **Connect**.
3. **Play** → selector en **1** → **Reset** → **Start**.

Partió de una escena generada por código ([`tools/generar-escena-fio.mjs`](../tools/generar-escena-fio.mjs),
`cd hmi && npm run escena`, que escribe `SmartFactory_TapasBases_generada.factoryio` sin tocar la oficial)
y se ajustó a mano en Factory I/O:

| Ajuste | Por qué |
|---|---|
| Guías de ruedas (*Wheel Aligner*) en M3, antes del sorter | Centran la pieza para que S6.1/S6.2 la lean y entre recta al sorter |
| Guías de ruedas dobles al final de M4 y M5 | Encauzan la pieza hasta la bahía del robot (sin ellas chocaba con el marco) |
| Wheel sorter al ras de las fajas | La pieza no se traba al entrar ni al salir |
| Removedores sobre el final de M6 a M9 | Las fajas terminan contra la reja: el producto debe retirarse sobre la cinta |

Las guías son piezas pasivas (sin señales): no cuentan como sensores ni actuadores.

## Construirla a mano (alternativa)

Tiempo estimado: 90 a 120 minutos la primera vez. Sigue el [plano de distribución](img/plano-celda.png)
(1 cuadro = 1 m). Nombra cada elemento con su código para que el mapeo sea directo, por ejemplo
"S5 Caída en M3" o "Y03 Tapas verdes".

> La geometría de referencia está en [`hmi/public/js/layout.js`](../hmi/public/js/layout.js).
> No hace falta copiarla al centímetro: la lógica usa sensores, no posiciones. Si tu escena queda
> distinta, ajusta los tiempos de `GVL_Param` (sección 3.6).

## 3.1 Piezas (pestaña *Parts*)

| Cant. | Elemento de Factory I/O | Códigos | Configuración |
|---|---|---|---|
| 2 | **Emitter** | E1, E2 | E1: *Part* = **Green raw material**; E2: *Part* = **Blue raw material**. *Base* = None. Emisión por tag (`Emit`). Min/Max time 1 a 2 s |
| 9 | **Belt Conveyor** (digital) | M1 a M9 | M1, M2, M4, M5: 4 m · M3: 6 m · M6, M8: 6 m (+ 2 m con el mismo tag si quieres más pulmón) · M7, M9: 2 a 4 m |
| 4 | **Pusher** (monoestable, con *Front/Back Limit*) | Y01 a Y04 | Y01/Y02 al final de M1/M2, apuntando a M3. Y03/Y04 junto a M6/M8, apuntando a M7/M9 |
| 1 | **Pop Up Wheel Sorter** | WS1 | Al final de M3. *Left* hacia la rama de tapas (M4), *Right* hacia la de bases (M5) |
| 2 | **Machining Center** (*Stations*) | MC1, MC2 | MC1 para tapas, MC2 para bases. Su bahía de entrada al final de M4/M5 y la de salida al inicio de M6/M8 |
| 6 | **Diffuse Sensor** | S2, S4, S5, S7, S8, S9 | Ver posiciones |
| 4 | **Vision Sensor** (configuración de un solo tipo) | S6.1, S6.2, S10, S11 | S6.1 = *Green Raw Material* · S6.2 = *Blue Raw Material* · S10 = *Green Product Lid* · S11 = *Green Product Base* |
| 4 | **Capacitive Sensor** (digital) | S12 a S15 | Al final de M6, M7, M8 y M9 |
| 4 | **Remover** | R1 a R4 | Después de S12 a S15 |
| 1 | **Panel** + botones | PB1 a PB3, ES1, SW1, H4 a H6 | Start, Stop, Reset, Emergency Stop, selector de 2 posiciones |
| 1 | **Stack Light** | H1 a H3 | Verde, amarilla, roja |
| 1 | **Digital Display** | D1 | Productos terminados |

Las características de cada pieza (tags, tiempos, tipos de configuración) están en la documentación
oficial: [Stations](https://docs.factoryio.com/manual/parts/stations/),
[Light Load](https://docs.factoryio.com/manual/parts/light-load/),
[Sensors](https://docs.factoryio.com/manual/parts/sensors/) y
[Emitter](https://docs.factoryio.com/manual/parts/emitter/).

## 3.2 Posiciones de referencia

| Elemento | Dónde | Notas |
|---|---|---|
| S2 / S4 | Al final de M1 / M2, frente a la placa de Y01 / Y02 | La faja se detiene `tFeederCenter` (400 ms) después de que S2/S4 detectan |
| Y01 / Y02 | Al costado de M1 / M2, empujando hacia el **inicio** de M3 | Ambos empujan al mismo punto; la lógica nunca los activa a la vez |
| S5 | Sobre M3, en el punto donde caen las piezas empujadas | Confirma cada transferencia |
| S6.1 y S6.2 | Sobre M3, a ~0,5 m del final (punto de lectura), apuntando hacia abajo | Los dos miran el mismo punto |
| S7 | En el wheel sorter | Detecta la pieza mientras cruza WS1 |
| S8 / S9 | En la bahía de entrada de MC1 / MC2 (final de M4 / M5) | El robot retira la pieza: flanco de bajada = pieza cargada |
| S10 / S11 | Sobre M6 / M8, frente a Y03 / Y04 | Centrado de 300 ms antes de empujar |
| S12 a S15 | Al final de M6, M7, M8 y M9, antes del removedor | Cuentan y vigilan atascos |

## 3.3 Centros de mecanizado

Según la documentación de Factory I/O, el *Machining Center* tiene las salidas **Start**, **Stop**,
**Reset** y **Produce Lids** (TRUE = tapas, FALSE = bases) y las entradas **Is Busy**, **Has Error**,
**Opened** y **Progress** (0 a 100). Las tapas tardan unos 6 s y las bases unos 3 s.

- MC1: `xMC1_ProduceLids` = TRUE siempre. MC2: `xMC2_ProduceLids` = FALSE siempre.
- El PLC mantiene **Start** en TRUE mientras la celda está en automático y manda **Stop** ante
  emergencia o falla. **Reset** se envía con el botón Reset.
- Si llega una pieza inválida a la bahía, la máquina activa *Has Error* (alarmas 13 y 14).
- *Opened* es la puerta de la reja. En la escena queda abierta y el robot trabaja igual; solo genera las alarmas 15 y 16 si se abre con el mecanizado en curso (avance 1 a 99 %) más de 1 s.

> Verifica en tu versión que *Is Busy* baje cuando el producto ya está en la bahía de salida. Si
> baja antes (al terminar el CNC, sin esperar al robot), no cambia nada: el producto igual llega a
> M6/M8 y lo cuenta S12 a S15.

## 3.4 Driver: Modbus TCP/IP Client

1. **File > Drivers** (F4) y elige **Modbus TCP/IP Client**.
2. **Configuration**: Host `127.0.0.1`, Port `502`, Slave ID `1`, Scan Time `10 ms`.
3. **I/O Config**:
   - Digital Inputs (sensores): **34**, dirección inicial 0
   - Digital Outputs (actuadores): **32**, dirección inicial 0
   - Register Inputs: **2**, dirección inicial 0 (*Progress* de MC1 y MC2)
   - Register Outputs: **1**, dirección inicial 0 (display)
4. Arrastra cada tag a su casilla siguiendo [02-mapa-io.md](02-mapa-io.md). **El orden debe ser exacto.**
5. Pulsa **Connect**.

> Si tu versión permite elegir el área: sensores → **Coils** y **Holding Registers**;
> actuadores → **Discrete Inputs** e **Input Registers**.

## 3.5 Verificación rápida (antes de la lógica automática)

Con CODESYS en línea (Login + Run) y la celda en **Manual**:

1. Pulsa **Start** en Factory I/O y comprueba que `GVL_IO.xBtn_Start` pasa a TRUE.
2. Desde el tablero (modo manual) enciende M1 y emite con E1: la pieza debe llegar a S2.
3. Ciclo de Y01: la pieza cae en M3 y S5 se activa.
4. Mueve M3 hasta S6.1: debe activarse solo con crudo verde (repite con azul en S6.2).
5. WS1 (+) con Left y luego con Right: verifica que **Left lleve a tapas**. Si va a bases, cambia
   `GVL_Param.xLidsOnLeft` a FALSE (la escena está espejada).
6. MC1 marcha con una pieza en S8: debe salir una tapa por M6. Repite con MC2.
7. Ciclo de Y03 y Y04 con un producto verde frente a S10/S11.

## 3.6 Ajustes finos (`GVL_Param`)

| Parámetro | Valor | Cuándo ajustarlo |
|---|---|---|
| `tFeederCenter` | 400 ms | Y01/Y02 empujan la pieza de canto o fallan: sube o baja hasta que quede centrada |
| `tDiverterCenter` | 300 ms | Igual, para Y03/Y04 |
| `tMergeGap` | 1,5 s | Piezas muy juntas en M3: súbelo |
| `tSorterSettle` | 300 ms | Si la pieza entra al sorter antes de que las ruedas giren |
| `tSorterTimeout` | 6 s | Si el sorter tarda más en entregar (alarma 12 falsa) |
| `iMainCapacity` | 5 | Piezas máximas en M3 |
| `iBranchCapacity` | 3 | Piezas máximas en M4/M5 (pulmón de cada máquina) |
| `xLidsOnLeft` | TRUE | Escena espejada (paso 5 de 3.5) |
| `STOP_IS_NC`, `ESTOP_IS_NC` | TRUE | Si arranca en emergencia y no sale (botones configurados como NA) |

Guarda la escena en `factoryio/SmartFactory_TapasBases.factoryio`.
