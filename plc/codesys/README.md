# Código del PLC (IEC 61131-3, Structured Text)

| Carpeta | Contenido |
|---|---|
| `01_DUT` | Enumeraciones `E_MachineState`, `E_Color`, `E_Branch`, `E_SorterStep`, `E_PusherStep`, `E_AlarmClass`; estructuras `ST_Alarm`, `ST_Fifo` |
| `02_GVL` | `GVL_IO` (imagen de E/S), `GVL_HMI` (comandos y estado), `GVL_Param` (parámetros y lote), `GVL_Alarm` |
| `03_FUN` | `FC_ColorFromSensors` y operaciones de cola FIFO (`Push`, `Pop`, `Clear`, `Pack`) |
| `04_FB` | `FB_Pusher`, `FB_Conveyor`, `FB_FeederStation`, `FB_WheelSorter`, `FB_MachiningCenter`, `FB_ColorDiverter`, `FB_AlarmManager`, `FB_Kpi` |
| `05_PRG` | `PLC_PRG`: entradas, modo y lote, alarmas, máquina de estados, permisivos, zonas 1 a 4, salidas y KPI |
| `project` | Proyecto `.project` de CODESYS |

Convenciones (notación húngara habitual en CODESYS): `x` BOOL, `i` INT, `ui` UINT, `udi` UDINT,
`r` REAL, `w` WORD, `dw` DWORD, `t` TIME, `e` enumeración, `st` estructura, `a` arreglo, `fb`
instancia de bloque, `ton`/`tof`/`tp` temporizadores, `rt`/`ft` detectores de flanco.

Las dos fajas alimentadoras y las dos líneas (tapas, bases) son arreglos de instancias indexados
con `k := 1 TO 2`: misma lógica, cero duplicación.

La lógica tiene un espejo 1:1 en [`hmi/public/js/control.js`](../../hmi/public/js/control.js) que
se prueba automáticamente; si cambias un archivo `.st`, replica el cambio allí.

Cómo importarlo: [docs/04-codesys.md](../../docs/04-codesys.md#44-importar-el-código).
