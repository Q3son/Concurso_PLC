# 2. Mapa de entradas y salidas

> Archivo generado con `npm run mapa-io` desde [`hmi/public/js/iomap.js`](../hmi/public/js/iomap.js).
> `npm test` verifica que coincide, variable por variable y en el mismo orden, con
> [`GVL_IO.st`](../plc/codesys/02_GVL/GVL_IO.st). No lo edites a mano.

Todas las señales llegan al **mismo PLC**. Los códigos (S5, M3, Y02…) son los del
[plano de distribución](img/plano-celda.png) y del [plano de hardware](img/plano-hardware.png).
La columna **Modbus** es la dirección que usa Factory I/O y **PLC** la dirección IEC que CODESYS
asigna al **ModbusTCP Server Device** ([04-codesys.md](04-codesys.md)). `GVL_IO` fija cada variable a
su canal con `AT`, así que no hay que mapear canal por canal. Factory I/O **escribe** los sensores en
*Coils* y *Holding Registers* y **lee** los actuadores en *Discrete Inputs* e *Input Registers*.

## Entradas digitales: 34 (Coils 0 a 33)

| Modbus | PLC | Código | Variable `GVL_IO` | Tag en Factory I/O | Función | Zona |
|---|---|---|---|---|---|---|
| 0 | `%IX4.0` | — | `xFio_Running` | FACTORY I/O (Running) | Factory I/O en ejecución | Panel |
| 1 | `%IX4.1` | PB1 | `xBtn_Start` | Start Button | Botón Start (NA) | Panel |
| 2 | `%IX4.2` | PB2 | `xBtn_Stop` | Stop Button | Botón Stop (NC) | Panel |
| 3 | `%IX4.3` | PB3 | `xBtn_Reset` | Reset Button | Botón Reset (NA) | Panel |
| 4 | `%IX4.4` | ES1 | `xBtn_EStop` | Emergency Stop | Paro de emergencia (NC) | Panel |
| 5 | `%IX4.5` | SW1 | `xSel_Auto` | Selector Switch (Auto) | Selector en Auto | Panel |
| 6 | `%IX4.6` | S2 | `xS2_Feed1Ready` | Diffuse Sensor (fin de M1) | Pieza verde lista frente a Y01 | Alimentación |
| 7 | `%IX4.7` | LS1 | `xY01_Front` | Pusher Y01 (Front Limit) | Y01 adelante | Alimentación |
| 8 | `%IX5.0` | LS2 | `xY01_Back` | Pusher Y01 (Back Limit) | Y01 atrás | Alimentación |
| 9 | `%IX5.1` | S4 | `xS4_Feed2Ready` | Diffuse Sensor (fin de M2) | Pieza azul lista frente a Y02 | Alimentación |
| 10 | `%IX5.2` | LS3 | `xY02_Front` | Pusher Y02 (Front Limit) | Y02 adelante | Alimentación |
| 11 | `%IX5.3` | LS4 | `xY02_Back` | Pusher Y02 (Back Limit) | Y02 atrás | Alimentación |
| 12 | `%IX5.4` | S5 | `xS5_MainDrop` | Diffuse Sensor (inicio de M3) | Pieza cayó en la faja principal | Alimentación |
| 13 | `%IX5.5` | S6.1 | `xS61_GreenRaw` | Vision Sensor (Green Raw Material) | Visión: crudo verde | Identificación |
| 14 | `%IX5.6` | S6.2 | `xS62_BlueRaw` | Vision Sensor (Blue Raw Material) | Visión: crudo azul | Identificación |
| 15 | `%IX5.7` | S7 | `xS7_Sorter` | Diffuse Sensor (wheel sorter) | Presencia en el wheel sorter | Identificación |
| 16 | `%IX6.0` | S8 | `xS8_LidsEntry` | Diffuse Sensor (entrada MC1) | Pieza en la entrada de MC1 | Mecanizado |
| 17 | `%IX6.1` | S9 | `xS9_BasesEntry` | Diffuse Sensor (entrada MC2) | Pieza en la entrada de MC2 | Mecanizado |
| 18 | `%IX6.2` | MC1 | `xMC1_Busy` | Machining Center 1 (Is Busy) | MC1 ocupada | Mecanizado |
| 19 | `%IX6.3` | MC1 | `xMC1_Error` | Machining Center 1 (Has Error) | MC1 con error | Mecanizado |
| 20 | `%IX6.4` | MC1 | `xMC1_Opened` | Machining Center 1 (Opened) | MC1 puerta abierta | Mecanizado |
| 21 | `%IX6.5` | MC2 | `xMC2_Busy` | Machining Center 2 (Is Busy) | MC2 ocupada | Mecanizado |
| 22 | `%IX6.6` | MC2 | `xMC2_Error` | Machining Center 2 (Has Error) | MC2 con error | Mecanizado |
| 23 | `%IX6.7` | MC2 | `xMC2_Opened` | Machining Center 2 (Opened) | MC2 puerta abierta | Mecanizado |
| 24 | `%IX7.0` | S10 | `xS10_GreenLid` | Vision Sensor (Green Product Lid) | Visión: tapa verde | Segregación |
| 25 | `%IX7.1` | LS5 | `xY03_Front` | Pusher Y03 (Front Limit) | Y03 adelante | Segregación |
| 26 | `%IX7.2` | LS6 | `xY03_Back` | Pusher Y03 (Back Limit) | Y03 atrás | Segregación |
| 27 | `%IX7.3` | S11 | `xS11_GreenBase` | Vision Sensor (Green Product Base) | Visión: base verde | Segregación |
| 28 | `%IX7.4` | LS7 | `xY04_Front` | Pusher Y04 (Front Limit) | Y04 adelante | Segregación |
| 29 | `%IX7.5` | LS8 | `xY04_Back` | Pusher Y04 (Back Limit) | Y04 atrás | Segregación |
| 30 | `%IX7.6` | S12 | `xS12_BlueLids` | Capacitive Sensor (fin de M6) | Cuenta tapas azules | Segregación |
| 31 | `%IX7.7` | S13 | `xS13_GreenLids` | Capacitive Sensor (fin de M7) | Cuenta tapas verdes | Segregación |
| 32 | `%IX8.0` | S14 | `xS14_BlueBases` | Capacitive Sensor (fin de M8) | Cuenta bases azules | Segregación |
| 33 | `%IX8.1` | S15 | `xS15_GreenBases` | Capacitive Sensor (fin de M9) | Cuenta bases verdes | Segregación |

## Entradas de registro: 2 (Holding Registers)

| Modbus | PLC | Código | Variable `GVL_IO` | Tag en Factory I/O | Función | Zona |
|---|---|---|---|---|---|---|
| 0 | `%IW0` | MC1 | `iMC1_Progress` | Machining Center 1 (Progress) | Avance MC1 % | Panel |
| 1 | `%IW1` | MC2 | `iMC2_Progress` | Machining Center 2 (Progress) | Avance MC2 % | Panel |

## Salidas digitales: 32 (Discrete Inputs 0 a 31)

| Modbus | PLC | Código | Variable `GVL_IO` | Tag en Factory I/O | Función | Zona |
|---|---|---|---|---|---|---|
| 0 | `%QX4.0` | E1 | `xE1_EmitGreen` | Emitter 1 (Emit) | Emisor crudo verde | Alimentación |
| 1 | `%QX4.1` | E2 | `xE2_EmitBlue` | Emitter 2 (Emit) | Emisor crudo azul | Alimentación |
| 2 | `%QX4.2` | M1 | `xM1_Feed1` | Belt Conveyor (faja 1) | Faja alimentadora 1 | Alimentación |
| 3 | `%QX4.3` | M2 | `xM2_Feed2` | Belt Conveyor (faja 2) | Faja alimentadora 2 | Alimentación |
| 4 | `%QX4.4` | Y01 | `xY01_Push` | Pusher Y01 | Pusher faja 1 → principal | Alimentación |
| 5 | `%QX4.5` | Y02 | `xY02_Push` | Pusher Y02 | Pusher faja 2 → principal | Alimentación |
| 6 | `%QX4.6` | M3 | `xM3_Main` | Belt Conveyor (principal) | Faja alimentadora principal | Alimentación |
| 7 | `%QX4.7` | WS1+ | `xWS_Plus` | Pop Up Wheel Sorter 1 (+) | Wheel sorter: ruedas arriba | Identificación |
| 8 | `%QX5.0` | WS1L | `xWS_Left` | Pop Up Wheel Sorter 1 (Left) | Wheel sorter: izquierda (tapas) | Identificación |
| 9 | `%QX5.1` | WS1R | `xWS_Right` | Pop Up Wheel Sorter 1 (Right) | Wheel sorter: derecha (bases) | Identificación |
| 10 | `%QX5.2` | M4 | `xM4_LidsBranch` | Belt Conveyor (rama tapas) | Rama de tapas | Mecanizado |
| 11 | `%QX5.3` | M5 | `xM5_BasesBranch` | Belt Conveyor (rama bases) | Rama de bases | Mecanizado |
| 12 | `%QX5.4` | MC1 | `xMC1_Start` | Machining Center 1 (Start) | MC1 Start | Mecanizado |
| 13 | `%QX5.5` | MC1 | `xMC1_Stop` | Machining Center 1 (Stop) | MC1 Stop | Mecanizado |
| 14 | `%QX5.6` | MC1 | `xMC1_Reset` | Machining Center 1 (Reset) | MC1 Reset | Mecanizado |
| 15 | `%QX5.7` | MC1 | `xMC1_ProduceLids` | Machining Center 1 (Produce Lids) | MC1 produce tapas | Mecanizado |
| 16 | `%QX6.0` | MC2 | `xMC2_Start` | Machining Center 2 (Start) | MC2 Start | Mecanizado |
| 17 | `%QX6.1` | MC2 | `xMC2_Stop` | Machining Center 2 (Stop) | MC2 Stop | Mecanizado |
| 18 | `%QX6.2` | MC2 | `xMC2_Reset` | Machining Center 2 (Reset) | MC2 Reset | Mecanizado |
| 19 | `%QX6.3` | MC2 | `xMC2_ProduceLids` | Machining Center 2 (Produce Lids) | MC2 produce tapas (FALSE = bases) | Mecanizado |
| 20 | `%QX6.4` | M6 | `xM6_LidsOut` | Belt Conveyor (salida tapas) | Salida de tapas (azules) | Segregación |
| 21 | `%QX6.5` | Y03 | `xY03_Push` | Pusher Y03 | Pusher tapas verdes | Segregación |
| 22 | `%QX6.6` | M7 | `xM7_GreenLids` | Belt Conveyor (tapas verdes) | Salida tapas verdes | Segregación |
| 23 | `%QX6.7` | M8 | `xM8_BasesOut` | Belt Conveyor (salida bases) | Salida de bases (azules) | Segregación |
| 24 | `%QX7.0` | Y04 | `xY04_Push` | Pusher Y04 | Pusher bases verdes | Segregación |
| 25 | `%QX7.1` | M9 | `xM9_GreenBases` | Belt Conveyor (bases verdes) | Salida bases verdes | Segregación |
| 26 | `%QX7.2` | H1 | `xLamp_Green` | Stack Light (Green) | Torre: verde | Panel |
| 27 | `%QX7.3` | H2 | `xLamp_Yellow` | Stack Light (Yellow) | Torre: amarilla | Panel |
| 28 | `%QX7.4` | H3 | `xLamp_Red` | Stack Light (Red) | Torre: roja | Panel |
| 29 | `%QX7.5` | H4 | `xLamp_Start` | Start Button (Light) | Luz botón Start | Panel |
| 30 | `%QX7.6` | H5 | `xLamp_Reset` | Reset Button (Light) | Luz botón Reset | Panel |
| 31 | `%QX7.7` | H6 | `xLamp_Stop` | Stop Button (Light) | Luz botón Stop | Panel |

## Salida de registro: 1 (Input Register)

| Modbus | PLC | Código | Variable `GVL_IO` | Tag en Factory I/O | Función | Zona |
|---|---|---|---|---|---|---|
| 0 | `%QW0` | D1 | `iDisplay` | Digital Display | Display: productos terminados | Panel |

## Resumen frente a las bases

| | Mínimo exigido | Esta celda |
|---|---|---|
| Sensores | 6 | **28 de proceso**: 14 de presencia/visión/conteo (S2, S4, S5, S6.1, S6.2, S7 a S15), 8 finales de carrera (LS1 a LS8) y 6 estados de máquina; más 6 del panel |
| Actuadores | 4 | **26 de proceso**: 2 emisores, 9 fajas, 4 pushers, wheel sorter (3 señales) y 2 centros de mecanizado (4 señales cada uno); más 6 lámparas y el display |
| PLC | 1 | **1 solo PLC** para toda la celda |

## Correcciones aplicadas al mapa

| Antes (Rev. B) | Ahora (Rev. C) | Motivo |
|---|---|---|
| S1 y S3: inicio de cada alimentador | **Eliminados** | Observación: no son necesarios. El emisor de Factory I/O no emite si su volumen está ocupado, así que basta con S2/S4 |
| S2 y S4: fin del alimentador | **Pieza lista para empujar** con Y01 / Y02 | Observación |
| S5: zona de unión | **Pieza cayó en la faja principal** (confirma cada empuje) | Observación |
| S6: visión numérica (0..9) | **S6.1 y S6.2**: visión digital crudo verde / crudo azul | Observación |
| Pushers A, B, C y salida 4 de rechazo | **Wheel sorter WS1** + 2 centros de mecanizado + segregación por color | Observación: nuevo proceso de tapas y bases |
