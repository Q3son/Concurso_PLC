# 8. Planos y diagramas

Todos los diagramas describen **la misma celda**: dos fajas alimentadoras (verde y azul), una faja
principal con identificación por visión, un wheel sorter, dos centros de mecanizado (tapas y bases)
y segregación del producto por color, controlados por **un solo PLC**.

- Los planos se generan desde la geometría y el mapa de E/S del código: `cd hmi && npm run plano`.
- Los diagramas de flujo son Mermaid (`docs/diagramas/*.mmd`): GitHub los dibuja solos y en VS Code se ven
  con la extensión *Markdown Preview Mermaid Support*. Para regenerar las imágenes: `npm run diagramas`.

| Diagrama | Qué muestra | Imagen | Fuente |
|---|---|---|---|
| Plano de distribución | Vista superior a escala, códigos de cada equipo, lista de dispositivos y observaciones aplicadas | [PNG](img/plano-celda.png) · [SVG](img/plano-celda.svg) | `tools/generar-plano.mjs` |
| Plano de hardware | Arquitectura de control y red, y asignación de E/S del PLC | [PNG](img/plano-hardware.png) · [SVG](img/plano-hardware.svg) | `tools/generar-plano.mjs` |
| Componentes | Qué partes tiene el sistema y por qué protocolo se comunican | [PNG](img/diagrama-componentes.png) | `diagramas/componentes.mmd` |
| Flujo general del proceso | El recorrido de una pieza por las cuatro zonas (versión limpia del borrador del equipo) | [PNG](img/diagrama-flujo-general.png) | `diagramas/flujo-general.mmd` |
| Flujo de la alimentación | Cómo decide el PLC qué faja empuja (Y01/Y02), la confirmación con S5 y el lote | [PNG](img/diagrama-flujo-alimentacion.png) | `diagramas/flujo-alimentacion.mmd` |
| Flujo del wheel sorter | Identificación con S6.1/S6.2 y regla de alternancia por color | [PNG](img/diagrama-flujo-wheel-sorter.png) | `diagramas/flujo-wheel-sorter.mmd` |
| Flujo de mecanizado y segregación | Rama, centro de mecanizado, desvío del verde y conteo | [PNG](img/diagrama-flujo-mecanizado.png) | `diagramas/flujo-mecanizado.mmd` |
| Ciclo del PLC | El orden en que se ejecuta PLC_PRG cada 10 ms | [PNG](img/diagrama-ciclo-plc.png) | `diagramas/ciclo-plc.mmd` |
| Estados de la celda | Modos de la máquina y qué los cambia | [PNG](img/diagrama-estados.png) | `diagramas/estados.mmd` |
| Estados del wheel sorter | Secuencia interna de FB_WheelSorter | [PNG](img/diagrama-estados-sorter.png) | `diagramas/estados-sorter.mmd` |
| Secuencia de una pieza | Intercambio de señales entre la planta y los bloques para un crudo verde | [PNG](img/diagrama-secuencia-pieza.png) | `diagramas/secuencia-pieza.mmd` |
| Gestión de alarmas | Clases de alarma, efecto y recuperación | [PNG](img/diagrama-flujo-alarmas.png) | `diagramas/flujo-alarmas.mmd` |

## 8.1 Plano de distribución

![Plano de distribución](img/plano-celda.png)

## 8.2 Plano de hardware y asignación de E/S

![Plano de hardware](img/plano-hardware.png)

## 8.3 Componentes

Qué partes tiene el sistema y por qué protocolo se comunican.

![Componentes](img/diagrama-componentes.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TB
  subgraph CAMPO["Planta virtual: Factory I/O"]
    direction LR
    SEN["Sensores<br/>S2, S4, S5, S7, S8, S9 difusos<br/>S6.1, S6.2, S10, S11 visión<br/>S12 a S15 capacitivos<br/>LS1 a LS8 finales de carrera"]
    ACT["Actuadores<br/>E1, E2 · M1 a M9<br/>Y01 a Y04 · WS1 (+, L, R)<br/>MC1, MC2 (Start, Stop, Reset, Lids)"]
    PAN["Panel del operador<br/>PB1 a PB3, ES1, SW1<br/>H1 a H6, D1"]
  end
  subgraph PLC["PLC único: CODESYS Control Win V3"]
    direction LR
    IO["GVL_IO<br/>34 DI · 32 DO · 3 registros"]
    PRG["PLC_PRG<br/>máquina de estados + 4 zonas"]
    FB["Bloques reutilizables<br/>FB_FeederStation ×2 · FB_WheelSorter<br/>FB_MachiningCenter ×2 · FB_ColorDiverter ×2<br/>FB_Conveyor ×7 · FB_Pusher ×4<br/>FB_AlarmManager · FB_Kpi"]
    Q["Seguimiento<br/>FIFO de colores por rama"]
    HMIV["GVL_HMI / GVL_Param<br/>comandos, estado, lote, KPI"]
    IO <--> PRG
    PRG --> FB
    PRG --> Q
    PRG <--> HMIV
  end
  subgraph SUP["Supervisión"]
    direction LR
    SRV["server.js<br/>cliente OPC UA"]
    WEB["Tablero web<br/>sinóptico 2D, gemelo 3D,<br/>alarmas, lote, KPI"]
    ARD["Arduino opcional<br/>botonera física"]
    SRV <-- "WebSocket" --> WEB
    ARD -. "USB serie" .-> SRV
  end
  CAMPO <-- "Modbus TCP :502" --> PLC
  PLC <-- "OPC UA :4840" --> SUP
```
</details>

## 8.4 Flujo general del proceso

El recorrido de una pieza por las cuatro zonas (versión limpia del borrador del equipo).

![Flujo general del proceso](img/diagrama-flujo-general.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TB
  subgraph Z1["Zona 1 · Alimentación"]
    direction LR
    E1["E1 crudo verde"] --> M1["M1 faja 1"] --> S2{"S2<br/>¿pieza lista?"}
    E2["E2 crudo azul"] --> M2["M2 faja 2"] --> S4{"S4<br/>¿pieza lista?"}
    S2 -- "sí y turno" --> Y01["Y01 empuja"]
    S4 -- "sí y turno" --> Y02["Y02 empuja"]
    Y01 --> S5{"S5<br/>¿cayó en M3?"}
    Y02 --> S5
  end
  subgraph Z2["Zona 2 · Identificación"]
    direction LR
    M3["M3 faja principal<br/>se mueve si hay piezas"] --> V{"S6.1 / S6.2<br/>¿verde o azul?"}
    V --> R{"Regla por color<br/>¿1.ª, 3.ª, 5.ª…?"}
    R -- "impar" --> WL["WS1 Left"]
    R -- "par" --> WR["WS1 Right"]
  end
  subgraph Z3["Zona 3 · Mecanizado"]
    direction LR
    M4["M4 rama de tapas"] --> MC1["MC1 tapas · 6 s"]
    M5["M5 rama de bases"] --> MC2["MC2 bases · 3 s"]
  end
  subgraph Z4["Zona 4 · Segregación y conteo"]
    direction LR
    MC1o["M6 salida tapas"] --> V1{"S10<br/>¿tapa verde?"}
    V1 -- "sí" --> Y03["Y03 → M7"] --> C13["S13 cuenta<br/>tapas verdes"]
    V1 -- "no, azul" --> C12["S12 cuenta<br/>tapas azules"]
    MC2o["M8 salida bases"] --> V2{"S11<br/>¿base verde?"}
    V2 -- "sí" --> Y04["Y04 → M9"] --> C15["S15 cuenta<br/>bases verdes"]
    V2 -- "no, azul" --> C14["S14 cuenta<br/>bases azules"]
  end
  S5 -- "sí" --> M3
  WL --> M4
  WR --> M5
  MC1 --> MC1o
  MC2 --> MC2o
  classDef verde fill:#e3f1e8,stroke:#3d8a55,color:#1d2227
  classDef azul fill:#e2eaf7,stroke:#2f63b0,color:#1d2227
  classDef maq fill:#fff4e5,stroke:#c77a1a,color:#1d2227
  class E1,M1,S2,Y01,Y03,C13,Y04,C15 verde
  class E2,M2,S4,Y02,C12,C14 azul
  class MC1,MC2 maq
```
</details>

## 8.5 Flujo de la alimentación

Cómo decide el PLC qué faja empuja (Y01/Y02), la confirmación con S5 y el lote.

![Flujo de la alimentación](img/diagrama-flujo-alimentacion.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TD
  A(["Cada ciclo del PLC (10 ms)"]) --> B{"¿AUTO_RUN?"}
  B -- "no" --> X["Emisores, M1, M2, Y01 e Y02 en reposo<br/>(en AUTO_STOP no entra material nuevo)"]
  B -- "sí" --> L{"¿El lote permite<br/>este color?"}
  L -- "no" --> X2["Ese emisor y su faja se detienen"]
  L -- "sí" --> F["M1 / M2 avanzan hasta que S2 / S4 ve una pieza<br/>y la centran frente al pusher (tFeederCenter)"]
  F --> G{"¿Unión libre?<br/>S5 libre · M3 avanzó tMergeGap<br/>· cupo en M3 · ningún empuje pendiente"}
  G -- "no" --> W["La pieza espera centrada"]
  G -- "sí" --> T{"¿Las dos fajas<br/>tienen pieza lista?"}
  T -- "solo una" --> P["Empuja la que está lista"]
  T -- "las dos" --> TU{"¿De quién es el turno?"}
  TU -- "faja 1" --> P1["Y01 empuja el crudo verde"]
  TU -- "faja 2" --> P2["Y02 empuja el crudo azul"]
  P --> C
  P1 --> C
  P2 --> C
  C["El turno pasa a la otra faja<br/>se cuenta la pieza del lote<br/>se espera la confirmación"] --> S5{"¿S5 ve la pieza<br/>antes de 4 s?"}
  S5 -- "sí" --> OK["iOnMain + 1 · M3 marcha<br/>empieza la separación"]
  S5 -- "no" --> AL["Alarma 10: transferencia no confirmada<br/>estado FAULT"]
```
</details>

## 8.6 Flujo del wheel sorter

Identificación con S6.1/S6.2 y regla de alternancia por color.

![Flujo del wheel sorter](img/diagrama-flujo-wheel-sorter.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TD
  A(["Pieza llega al punto de lectura de M3"]) --> V{"S6.1 / S6.2"}
  V -- "solo S6.1" --> G["Color = VERDE"]
  V -- "solo S6.2" --> B["Color = AZUL"]
  V -- "ninguno" --> U["La pieza sigue hasta WS1 sin clasificar"] --> E11["S7 la detecta en IDLE<br/>Alarma 11: pieza no identificada"]
  G --> RG{"¿El verde anterior<br/>fue a tapas?"}
  B --> RB{"¿El azul anterior<br/>fue a tapas?"}
  RG -- "no (o es el primero)" --> DT["Destino: TAPAS"]
  RG -- "sí" --> DB["Destino: BASES"]
  RB -- "no (o es el primero)" --> DT
  RB -- "sí" --> DB
  DT --> CAP{"¿Cupo en la rama destino?<br/>(iBranchCapacity)"}
  DB --> CAP
  CAP -- "no" --> H["M3 se retiene con la pieza en lectura<br/>aviso 22 si pasa de 30 s"]
  H --> CAP
  CAP -- "sí" --> P["PREPARE: WS1 (+) y Left/Right<br/>M3 espera tSorterSettle"]
  P --> TR["TRANSFER: M3 avanza<br/>la pieza pasa por S7"]
  TR --> D{"¿S7 sube y baja<br/>antes de 6 s?"}
  D -- "sí" --> DONE["DONE: la pieza entra a su rama (FIFO)<br/>se invierte la regla de ese color"]
  D -- "no" --> E12["Alarma 12: tiempo de transferencia excedido"]
```
</details>

## 8.7 Flujo de mecanizado y segregación

Rama, centro de mecanizado, desvío del verde y conteo.

![Flujo de mecanizado y segregación](img/diagrama-flujo-mecanizado.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TD
  A(["Pieza en la rama M4 / M5 (FIFO de colores)"]) --> B{"¿S8 / S9 ocupado?"}
  B -- "sí" --> H["La rama se detiene: la bahía de entrada tiene pieza"]
  B -- "no" --> R["La rama avanza (solo si su FIFO tiene piezas)"]
  H --> C{"¿MC libre y en marcha?<br/>Start = TRUE · Is Busy = FALSE"}
  C -- "sí" --> L["El robot toma la pieza: S8 / S9 baja<br/>color = FIFO.pop → pieza dentro de la máquina"]
  L --> M["Mecanizado: tapa 6 s en MC1 · base 3 s en MC2<br/>Progress 0 → 100 %"]
  M --> F["Is Busy baja: producto en la bahía de salida<br/>contador de M6 / M8 + 1"]
  F --> O["M6 / M8 avanzan (producto azul sigue de largo)"]
  O --> V{"¿S10 / S11 ve<br/>producto verde?"}
  V -- "sí" --> CE["Centrado tDiverterCenter · M6 / M8 se detienen"] --> P["Y03 / Y04 empujan a M7 / M9"] --> CG["S13 / S15 cuentan el verde"]
  V -- "no" --> CB["S12 / S14 cuentan el azul"]
  CG --> K["KPI: productos/min, conteo por tipo, ocupación de MC1 y MC2"]
  CB --> K
  C -- "error o puerta abierta" --> AL["Alarmas 13 a 16 · estado FAULT · MC recibe Stop"]
```
</details>

## 8.8 Ciclo del PLC

El orden en que se ejecuta PLC_PRG cada 10 ms.

![Ciclo del PLC](img/diagrama-ciclo-plc.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TD
  A["1. Entradas y comandos<br/>panel de Factory I/O + tablero (handshake)"] --> B["2. Modo y lote<br/>Auto / Manual · X verdes, Y azules"]
  B --> C["3. Alarmas<br/>24 condiciones → FB_AlarmManager"]
  C --> D{"4. ¿Emergencia o falla?"}
  D -- "sí" --> E["EMERGENCY / FAULT<br/>se quitan todos los permisos"]
  D -- "no" --> F["Máquina de estados<br/>IDLE · AUTO_RUN · AUTO_STOP · MANUAL"]
  E --> G["5. Permisivos y vaciado de seguimiento"]
  F --> G
  G --> H["6. Zona 1: alimentación y unión<br/>FB_FeederStation ×2 · turno · S5"]
  H --> I["7. Zona 2: M3 + identificación + WS1<br/>FB_WheelSorter (regla por color)"]
  I --> J["8. Zonas 3 y 4 (FOR k := 1 TO 2)<br/>rama · FB_MachiningCenter · FB_ColorDiverter · conteo"]
  J --> K["9. Salidas físicas y torre de luces"]
  K --> L["10. KPI y estado para el HMI"]
  L -- "se repite cada 10 ms" --> A
```
</details>

## 8.9 Estados de la celda

Modos de la máquina y qué los cambia.

![Estados de la celda](img/diagrama-estados.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
stateDiagram-v2
  direction LR
  [*] --> OPERACION
  state "En operación (con permisos)" as OPERACION {
    direction LR
    [*] --> IDLE
    IDLE --> AUTO_RUN: Start, pushers en reposo
    AUTO_RUN --> AUTO_STOP: Stop o lote completo
    AUTO_STOP --> AUTO_RUN: Start (si el lote no terminó)
    AUTO_STOP --> IDLE: línea vacía o 90 s
    IDLE --> MANUAL: selector en Manual
    MANUAL --> IDLE: selector en Auto (vacía seguimiento)
  }
  OPERACION --> FAULT: alarma de falla
  FAULT --> OPERACION: causa resuelta y Reset
  OPERACION --> EMERGENCY: seta ES1 o HMI
  FAULT --> EMERGENCY: seta ES1 o HMI
  EMERGENCY --> OPERACION: seta liberada y Reset
```
</details>

## 8.10 Estados del wheel sorter

Secuencia interna de FB_WheelSorter.

![Estados del wheel sorter](img/diagrama-estados-sorter.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
stateDiagram-v2
  direction LR
  [*] --> IDLE
  IDLE --> PREPARE: color leído y cupo en la rama destino
  IDLE --> IDLE: rama llena (M3 retenida)
  IDLE --> ERROR: S7 sin color leído (alarma 11)
  PREPARE --> TRANSFER: tSorterSettle (ruedas orientadas)
  TRANSFER --> DONE: S7 sube y baja
  TRANSFER --> ERROR: más de tSorterTimeout (alarma 12)
  DONE --> IDLE: FIFO de la rama + 1, alterna la regla del color
  ERROR --> IDLE: Reset
```
</details>

## 8.11 Secuencia de una pieza

Intercambio de señales entre la planta y los bloques para un crudo verde.

![Secuencia de una pieza](img/diagrama-secuencia-pieza.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
sequenceDiagram
  autonumber
  participant P as Planta (Factory I/O)
  participant F as FB_FeederStation 1
  participant U as PLC_PRG (unión)
  participant W as FB_WheelSorter
  participant M as FB_MachiningCenter 1
  participant D as FB_ColorDiverter 1
  P->>F: S2 = TRUE (crudo verde al final de M1)
  F->>F: centra tFeederCenter, detiene M1
  U->>F: xPushPermit (S5 libre, separación, turno = 1)
  F->>P: Y01 extiende hasta LS1 y retrae hasta LS2
  P->>U: S5 flanco ↑ (confirmación antes de 4 s)
  U->>P: M3 marcha (hay piezas en la faja)
  P->>W: S6.1 = TRUE en el punto de lectura
  W->>W: 1.er verde → destino TAPAS
  W->>P: WS1 (+) y Left, luego M3 avanza
  P->>W: S7 ↑ y ↓ (pieza entregada a M4)
  W->>U: xDone → FIFO tapas + VERDE, regla verde → bases
  P->>M: S8 = TRUE, robot la toma (S8 ↓), Is Busy = TRUE
  M->>U: xLoaded → color en MC1 = VERDE
  P->>M: Is Busy ↓ (tapa terminada en la bahía de salida)
  M->>U: xFinished → piezas en M6 + 1
  P->>D: S10 = TRUE (Green Product Lid)
  D->>P: detiene M6, Y03 empuja a M7
  P->>U: S13 ↑ → tapas verdes + 1, KPI
```
</details>

## 8.12 Gestión de alarmas

Clases de alarma, efecto y recuperación.

![Gestión de alarmas](img/diagrama-flujo-alarmas.png)

<details><summary>Fuente Mermaid</summary>

```mermaid
flowchart TD
  A(["Condición de alarma (24 en GVL_Alarm)"]) --> B{"Clase"}
  B -- "EMERGENCY (1)" --> E["Estado EMERGENCY<br/>todas las salidas en reposo<br/>MC1 y MC2 reciben Stop"]
  B -- "FAULT (2 a 21)" --> F["Estado FAULT<br/>torre roja intermitente"]
  B -- "WARNING (22 a 24)" --> W["Aviso: la celda sigue<br/>torre amarilla intermitente"]
  E --> R{"¿Seta liberada<br/>y Reset?"}
  F --> R2{"¿Causa resuelta<br/>y Reset?"}
  R -- "sí" --> I["IDLE: lista para Start"]
  R2 -- "sí" --> I
  R -- "no" --> E
  R2 -- "no" --> F
  W --> RW["Reset la reconoce cuando la causa desaparece"]
```
</details>

## 8.13 Borrador original del equipo

El diagrama de flujo del proceso parte de este borrador, que se respetó en la solución (zonas,
sensores capacitivos de conteo, regla del wheel sorter y alimentación por cantidades).

![Borrador del equipo](img/borrador-equipo.png)

Referencia visual de una celda en Factory I/O usada como modelo para el gemelo 3D:

![Referencia Factory I/O](img/referencia-factoryio.png)
