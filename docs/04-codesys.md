# 4. Proyecto en CODESYS V3.5

## 4.1 Instalación

1. Descarga **CODESYS Development System V3.5** (SP19 o posterior) desde la CODESYS Store
   (gratuito, requiere cuenta).
2. Incluye **CODESYS Control Win V3 x64** (PLC virtual). Al terminar, en la bandeja de Windows
   aparece *CODESYS Control Win SysTray*: clic derecho > **Start PLC**.
3. Si te pide usuario al conectar por primera vez, crea uno (ej. `admin`). Anótalo: lo usarás
   también para OPC UA.

## 4.2 Crear el proyecto

1. **File > New Project > Standard project**, nombre `SmartFactory`, guárdalo en `plc/codesys/project/`.
2. Device: **CODESYS Control Win V3 x64**. Lenguaje de PLC_PRG: **Structured Text (ST)**.
3. En *Task Configuration > MainTask*: tipo cíclico, **10 ms**.

## 4.3 Modbus TCP con Factory I/O (opción A, recomendada)

1. Clic derecho en **Device > Add Device > Ethernet Adapter > Ethernet**. Elige la interfaz
   (para todo en la misma PC sirve loopback `127.0.0.1` o tu adaptador real).
2. Clic derecho en **Ethernet > Add Device > Modbus > Modbus TCP Slave Device**.
3. En su configuración:
   - Puerto **502**, Unit ID **1**
   - Áreas de bits (*Discrete bit areas*): **Coils = 34**, **Discrete Inputs = 32**
   - **Holding Registers = 2**, **Input Registers = 1**
4. En **Modbus TCP Slave Device I/O Mapping** enlaza cada canal a su variable con el botón `…`
   (*mapear a variable existente*), por ejemplo `Coils bit 6 → GVL_IO.xS2_Feed1Ready`.
   **Todas** las señales van a este mismo dispositivo: hay un solo PLC.
   La tabla completa, en orden, está en [02-mapa-io.md](02-mapa-io.md).
5. Activa **Always update variables** (*Enabled 2: always in bus cycle task*).

### Opción B (si tu versión no tiene áreas de bits)

Invierte los roles: Factory I/O como **Modbus TCP/IP Server** y en CODESYS
**Modbus TCP Master > Modbus TCP Slave** (IP de Factory I/O, puerto 502):

| Canal | Función | Offset | Longitud | Mapear a |
|---|---|---|---|---|
| Sensores | Read Discrete Inputs (FC02) | 0 | 34 | `GVL_IO.xFio_Running … xS15_GreenBases` |
| Avance MC | Read Input Registers (FC04) | 0 | 2 | `GVL_IO.iMC1_Progress`, `iMC2_Progress` |
| Actuadores | Write Multiple Coils (FC15) | 0 | 32 | `GVL_IO.xE1_EmitGreen … xLamp_Stop` |
| Display | Write Multiple Registers (FC16) | 0 | 1 | `GVL_IO.iDisplay` |

El programa no cambia: solo cambia el mapeo hacia `GVL_IO`.

## 4.4 Importar el código

El código fuente está en `plc/codesys/`. Crea los objetos **en este orden** (clic derecho en
*Application > Add Object*) y pega el contenido de cada archivo:

| Orden | Carpeta | Tipo de objeto | Archivos |
|---|---|---|---|
| 1 | `01_DUT` | DUT (Enumeration) | `E_MachineState`, `E_Color`, `E_Branch`, `E_SorterStep`, `E_PusherStep`, `E_AlarmClass` |
| 2 | `01_DUT` | DUT (Structure) | `ST_Alarm`, `ST_Fifo` |
| 3 | `02_GVL` | Global Variable List | `GVL_Param` (primero: lo usan los demás), `GVL_IO`, `GVL_HMI`, `GVL_Alarm` |
| 4 | `03_FUN` | POU > Function | `FC_ColorFromSensors`, `FC_FifoPush`, `FC_FifoPop`, `FC_FifoClear`, `FC_FifoPack` |
| 5 | `04_FB` | POU > Function Block | `FB_Pusher`, `FB_Conveyor`, `FB_FeederStation`, `FB_WheelSorter`, `FB_MachiningCenter`, `FB_ColorDiverter`, `FB_AlarmManager`, `FB_Kpi` |
| 6 | `05_PRG` | Reemplaza el contenido de `PLC_PRG` | `PLC_PRG` |

En POUs y FBs el editor tiene dos partes: **todo hasta el último `END_VAR` va arriba**
(declaración) y **el resto va abajo** (implementación). En DUTs y GVLs se pega todo en un panel.

Compila con **F11**: debe quedar con 0 errores. `FB_FeederStation` y `FB_ColorDiverter` usan
`FB_Pusher`, por eso este va primero.

## 4.5 OPC UA para el tablero

1. Clic derecho en *Application > Add Object > Symbol Configuration*.
2. Marca **Support OPC UA features**.
3. Pulsa **Build** y marca `GVL_IO`, `GVL_HMI`, `GVL_Param` y `GVL_Alarm`
   (acceso lectura/escritura en `GVL_HMI`).
4. Compila y descarga. El servidor OPC UA queda en `opc.tcp://localhost:4840`.
5. Si el runtime exige usuario, pon las credenciales en `hmi/.env` (`OPCUA_USER`, `OPCUA_PASSWORD`).

## 4.6 Ejecutar

1. Inicia el PLC virtual (SysTray > Start PLC).
2. En CODESYS: **Online > Login** (Alt+F8), acepta la descarga y luego **Start** (F5).
3. En Factory I/O: Play y Connect en el driver.
4. Selector en **Auto**, pulsa **Reset** si hay alarmas y luego **Start**.
5. En otra terminal: `cd hmi && npm start` y abre <http://localhost:3000>.

## 4.7 WebVisu (HMI integrado, opcional)

Además del tablero web puedes crear una pantalla nativa: *Application > Add Object > Visualization*.
Enlaza botones a `GVL_HMI.xCmdStart`, `xCmdStop`, `xCmdReset` (tipo *Tap*, valor TRUE), lámparas a
`GVL_IO.xLamp_*` y textos a `GVL_HMI.udiTotal`, `udiGreenLids`, `rPPM`, `rUtilMC1`. Se abre en
`http://localhost:8080/webvisu.htm`. Así cumples el requisito de HMI incluso sin Node.js.

## 4.8 Qué mirar en línea durante el video

| Variable | Qué demuestra |
|---|---|
| `PLC_PRG.eState` | Máquina de estados |
| `PLC_PRG.iTurn`, `afbFeed[k].xReady`, `axAwaitDrop` | Unión de las dos fajas y confirmación con S5 |
| `PLC_PRG.fbSorter.eStep`, `fbSorter.axNextToBases` | Secuencia del sorter y regla por color |
| `PLC_PRG.aBranch[1].iCount`, `aeMcColor` | Seguimiento de colores por rama y en cada máquina |
| `PLC_PRG.afbMC[1].rUtilization` | Cuello de botella (MC1 cerca del 100 %) |
| `GVL_Alarm.aAlarm` | Alarmas enclavadas y conteo de ocurrencias |

## 4.9 Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Arranca en emergencia y no sale | Emergencia o Stop configurados como NA | Cambia `ESTOP_IS_NC` / `STOP_IS_NC` en `GVL_Param` |
| Factory I/O no conecta | PLC detenido o firewall | Start PLC en la bandeja; permite el puerto 502 |
| Las tapas van a la rama de bases | Escena espejada | `GVL_Param.xLidsOnLeft := FALSE` |
| Alarma 10 (S5 no confirma) | S5 mal ubicado o pusher corto | Ubica S5 donde cae la pieza; revisa `tFeederCenter` |
| Alarma 11 (pieza no identificada) | Emisor con otro tipo de pieza, o S6.1/S6.2 mal configurados | E1 solo *Green raw material*, E2 solo *Blue raw material*; visión en *Green/Blue Raw Material* |
| Alarma 12 (sorter) | La rama destino no avanza o S7 mal ubicado | Revisa M4/M5 y S7; sube `tSorterTimeout` |
| Y03/Y04 no empujan el verde | Visión en el tipo equivocado | S10 = *Green Product Lid*, S11 = *Green Product Base* |
| Error de compilación en `TO_INT(eState)` | Versión antigua con enums estrictos | Quita `{attribute 'strict'}` de los DUT de enumeración |
| El tablero no encuentra `GVL_HMI` | Falta Symbol Configuration con OPC UA | Paso 4.5 y `npm run browse` |
