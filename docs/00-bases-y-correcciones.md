# 0. Bases del reto y correcciones aplicadas

Este documento es la **matriz de trazabilidad** del proyecto: cada requisito de las bases del
*Smart Factory Challenge* (HRFEST 2026) y cada observación del jurado tiene una respuesta concreta,
con el archivo donde se implementa y la prueba que lo verifica.

## 0.1 Bases del reto (resumen)

| Bloque | Requisito |
|---|---|
| Desafío | Solución de automatización integral para una celda de manufactura virtual que resuelva un proceso industrial |
| Reto | Diseño libre de celda en **Factory I/O** con un mínimo de **6 sensores y 4 actuadores** |
| Control | PLC virtual: **CODESYS V3.5** (recomendado), OpenPLC o TIA Portal |
| Protocolo | **OPC UA o Modbus TCP/IP** |
| Obligatorio | Operación **manual/automática**, gestión de alarmas (**paro de emergencia y Reset**) y **tablero de control en tiempo real** |
| Clasificación | Video de máximo 5 minutos por Zoom (cámara encendida en miniatura), código activo y simulación corriendo, **sin cortes de edición** |
| Final | El Top 8 resuelve una **"Escena Secreta" presencial de 2 horas** con su propia laptop configurada |

### Evaluación

| Criterio | Peso | Qué se mira |
|---|---|---|
| Funcionalidad y lógica | 30 % | Cumplimiento de la secuencia y respuesta perfecta a alarmas |
| Complejidad y HMI | 20 % | Uso correcto del hardware requerido y claridad de la interfaz de control |
| Calidad del código | 20 % | Código estructurado y uso correcto del estándar IEC 61131-3 |
| Optimización | 15 % | Eficiencia de ciclo (piezas procesadas por minuto) |
| Sustentación (video) | 15 % | Claridad de la explicación y dominio técnico |

## 0.2 Observaciones del jurado y cómo se corrigieron

| # | Observación | Implementación | Dónde | Verificación |
|---|---|---|---|---|
| O1 | **M1** es la faja (alimentadora 1) | `xM1_Feed1`, controlada por `FB_FeederStation` instancia 1 | `GVL_IO` DO 2 · `PLC_PRG` §6 | Prueba *la unión alterna las fajas…* |
| O2 | **Y01** es un pusher que empuja de la faja alimentadora 1 a la principal | `xY01_Push` con finales de carrera LS1/LS2 y vigilancia de tiempo | `FB_FeederStation` → `FB_Pusher` | Prueba *pusher Y01 trabado* |
| O3 | **M2** es la faja (alimentadora 2) | `xM2_Feed2`, `FB_FeederStation` instancia 2 | `GVL_IO` DO 3 | Prueba de la unión |
| O4 | **Y02** empuja de la faja 2 a la principal | `xY02_Push` con LS3/LS4 | `FB_FeederStation` | Prueba de la unión |
| O5 | **S1 no es necesario** | Eliminado del mapa de E/S y de la lógica. El emisor de Factory I/O no emite mientras su volumen está ocupado, y E1 solo emite con M1 en marcha | `GVL_IO`, [02-mapa-io.md](02-mapa-io.md) | `npm test` (coherencia GVL ↔ tablero) |
| O6 | **S3 no es necesario** | Eliminado, igual que S1 | `GVL_IO` | Idem |
| O7 | **S2** detecta material listo para empujar de la faja 1 a la principal | `xS2_Feed1Ready`: M1 avanza hasta S2, centra la pieza (`tFeederCenter`) y se detiene; Y01 empuja cuando la unión concede el turno | `FB_FeederStation` | Prueba de la unión |
| O8 | **S4** detecta material listo de la faja 2 | `xS4_Feed2Ready`, misma lógica | `FB_FeederStation` | Idem |
| O9 | **M3** es la faja (alimentadora principal) | `xM3_Main`, **solo marcha si hay piezas** ("si hay objeto en la línea, mover la faja") | `PLC_PRG` §7, `FB_Conveyor` | Prueba *las fajas solo marchan cuando tienen piezas* |
| O10 | **S5** detecta que cayó un objeto a la alimentadora principal | Cada empuje de Y01/Y02 espera el flanco de S5 antes de 4 s; si no llega → **alarma 10** | `PLC_PRG` §6 | Prueba de la unión (0 choques) |
| O11 | **S6.1 y S6.2** son sensores digitales que identifican crudo verde (1) y azul (2) | Vision Sensor en configuración digital *Green Raw Material* / *Blue Raw Material*. `FC_ColorFromSensors` → `E_Color.GREEN = 1`, `E_Color.BLUE = 2` | `03_FUN`, `01_DUT/E_Color` | Prueba de la regla del wheel sorter |
| O12 | Después de la faja principal hay un **wheel sorter con sensor de presencia** | Pop Up Wheel Sorter `WS1` (+, Left, Right) y sensor **S7**. Secuencia IDLE → PREPARE → TRANSFER → DONE | `FB_WheelSorter` | Pruebas de regla, robustez y pieza no identificada |
| O13 | Crudo **verde**: va a **tapas** si es el primer verde, o a **bases** si el anterior ya fue a tapas | Alternancia independiente por color `axNextToBases[1]` | `FB_WheelSorter` | Prueba *cada color alterna tapas, bases, tapas…* (verifica la secuencia exacta) |
| O14 | Crudo **azul**: misma regla | `axNextToBases[2]` | `FB_WheelSorter` | Idem |
| O15 | La máquina de **tapas/bases** trabaja | Dos *Machining Center*: MC1 con *Produce Lids* = TRUE (tapas) y MC2 con FALSE (bases). Start/Stop/Reset, *Is Busy*, *Has Error*, *Opened* | `FB_MachiningCenter` | Prueba *error y puerta abierta…* |
| O16 | La salida se segrega por color: la faja de salida es **azul** y un **pusher** empuja los **verdes** a otra faja | M6/M8 llevan el producto azul de largo; S10/S11 (visión *Green Product Lid/Base*) detectan el verde, la faja se detiene y Y03/Y04 lo empujan a M7/M9 | `FB_ColorDiverter` | Prueba *produce tapas y bases… sin errores de segregación* |
| O17 | Al final de cada faja hay un **sensor capacitivo** para contar las salidas | S12 tapas azules, S13 tapas verdes, S14 bases azules, S15 bases verdes; además vigilan atascos | `PLC_PRG` §8, `FB_Kpi` | Pruebas de conteo y de atasco |
| O18 | Borrador: "se alimenta **X** cantidad de verde y **Y** de azul" | **Lote de producción** configurable desde el tablero (`uiLotGreen`, `uiLotBlue`); al completarse, la celda termina lo que está en proceso y queda en IDLE | `PLC_PRG` §2 y §4 | Prueba *lote: exactamente X verdes e Y azules* |
| O19 | Borrador: "un sensor para anotar la parte verde/azul" | El color se registra en el seguimiento (FIFO por rama) al pasar por el sorter y se muestra en el tablero hasta que entra a la máquina | `ST_Fifo`, `FC_FifoPack`, `GVL_HMI.wLidsQueue` | Panel *Estado del proceso* del HMI |

## 0.3 Cumplimiento de las bases

| Requisito | Cómo se cumple | Evidencia |
|---|---|---|
| Mínimo 6 sensores y 4 actuadores | **28 sensores** y **26 actuadores** de proceso, más panel | [02-mapa-io.md](02-mapa-io.md) |
| PLC virtual | CODESYS Control Win V3, 100 % Structured Text | [`plc/codesys`](../plc/codesys) |
| OPC UA o Modbus TCP | **Ambos**: Modbus TCP con Factory I/O y OPC UA con el tablero | [01-arquitectura.md](01-arquitectura.md), [plano de hardware](img/plano-hardware.png) |
| Operación manual / automática | Selector SW1 y tablero, con permisivos por estado; los mandos manuales se apagan al salir | Prueba *modo manual* |
| Paro de emergencia y Reset | ES1 y Stop en NC (fail-safe), alarmas enclavadas, Reset solo sin causa | Prueba *paro de emergencia* |
| Tablero en tiempo real | HMI web con sinóptico 2D, gemelo 3D, alarmas, lote, KPI; WebVisu opcional | [`hmi/`](../hmi) |
| Video sin cortes | Guion de 5 minutos alineado con la rúbrica | [05-video-y-final.md](05-video-y-final.md) |
| Final presencial | Bloques reutilizables y plantilla de 2 horas | [05-video-y-final.md](05-video-y-final.md#53-la-final-escena-secreta-de-2-horas) |

## 0.4 Qué cambió respecto de la versión anterior

La versión anterior (Rev. B) clasificaba azul, verde y metal en cuatro salidas con tres pushers.
Las observaciones redefinen el proceso: ahora la celda **transforma** crudos en tapas y bases y
**segrega** el producto terminado por color. Se conservaron las piezas que ya funcionaban
(gestor de alarmas, pusher con vigilancia, KPI, emergencia fail-safe, handshake de comandos,
tablero OPC UA) y se reescribió la secuencia. El detalle está en [CHANGELOG.md](../CHANGELOG.md).
