(* Interfaz con el HMI (WebVisu y tablero web via OPC UA).
   Los comandos xCmd* los pone en TRUE el HMI y el PLC los devuelve a FALSE al consumirlos (handshake). *)
{attribute 'qualified_only'}
VAR_GLOBAL
    (* ---------- Comandos HMI -> PLC ---------- *)
    xCmdStart         : BOOL;
    xCmdStop          : BOOL;
    xCmdReset         : BOOL;
    xCmdEStop         : BOOL;   (* Mantenido: TRUE mientras la seta del HMI este enclavada *)
    xCmdModeAuto      : BOOL;
    xCmdModeManual    : BOOL;
    xCmdClearTracking : BOOL;
    xCmdResetCounters : BOOL;
    xCmdApplyLot      : BOOL;   (* Aplica uiSetLotGreen/uiSetLotBlue (solo con la celda detenida) *)
    uiSetLotGreen     : UINT;
    uiSetLotBlue      : UINT;
    (* Operacion manual (solo en estado MANUAL). Mantenidos: *)
    xManE1            : BOOL;
    xManE2            : BOOL;
    xManM1            : BOOL;
    xManM2            : BOOL;
    xManM3            : BOOL;
    xManM4            : BOOL;
    xManM5            : BOOL;
    xManM6            : BOOL;
    xManM7            : BOOL;
    xManM8            : BOOL;
    xManM9            : BOOL;
    xManWSPlus        : BOOL;
    xManWSLeft        : BOOL;
    xManWSRight       : BOOL;
    xManMC1           : BOOL;   (* Arranca el centro de mecanizado de tapas *)
    xManMC2           : BOOL;   (* Arranca el centro de mecanizado de bases *)
    (* Pulsos: ejecutan un ciclo completo del pusher *)
    xManPushY01       : BOOL;
    xManPushY02       : BOOL;
    xManPushY03       : BOOL;
    xManPushY04       : BOOL;

    (* ---------- Estado PLC -> HMI ---------- *)
    iState            : INT;    (* E_MachineState *)
    xModeAuto         : BOOL;
    xTurnBlue         : BOOL;   (* Turno en la union: FALSE = faja 1 (verde), TRUE = faja 2 (azul) *)
    iSorterStep       : INT;    (* E_SorterStep *)
    iSorterNext       : INT;    (* E_Branch previsto para la pieza en lectura *)
    iLastColor        : INT;    (* E_Color de la ultima pieza clasificada *)
    xNextGreenToBases : BOOL;   (* Alternancia: el proximo verde va a bases *)
    xNextBlueToBases  : BOOL;   (* Alternancia: el proximo azul va a bases *)
    iOnMain           : INT;    (* Piezas en M3 *)
    iLidsQueue        : INT;    (* Piezas en la rama de tapas (M4) *)
    iBasesQueue       : INT;    (* Piezas en la rama de bases (M5) *)
    wLidsQueue        : WORD;   (* Colores en cola, 2 bits por pieza (01 verde, 10 azul), pieza 1 en bits 0-1 *)
    wBasesQueue       : WORD;
    iMC1Color         : INT;    (* E_Color de la pieza dentro de MC1 *)
    iMC2Color         : INT;
    iOnLidsOut        : INT;    (* Piezas en M6 *)
    iOnGreenLids      : INT;    (* Piezas en M7 *)
    iOnBasesOut       : INT;    (* Piezas en M8 *)
    iOnGreenBases     : INT;    (* Piezas en M9 *)
    iY01Step          : INT;    (* E_PusherStep *)
    iY02Step          : INT;
    iY03Step          : INT;
    iY04Step          : INT;
    xLotMode          : BOOL;
    xLotCompleted     : BOOL;
    udiLotFedGreen    : UDINT;  (* Verdes enviadas en el lote actual *)
    udiLotFedBlue     : UDINT;
    dwAlarmActive     : DWORD;  (* bit n-1 = alarma n activa *)
    dwAlarmUnack      : DWORD;
    udiHeartbeat      : UDINT;

    (* ---------- KPI ---------- *)
    udiTotal          : UDINT;  (* Productos terminados (S12 + S13 + S14 + S15) *)
    udiBlueLids       : UDINT;  (* S12 *)
    udiGreenLids      : UDINT;  (* S13 *)
    udiBlueBases      : UDINT;  (* S14 *)
    udiGreenBases     : UDINT;  (* S15 *)
    udiFedGreen       : UDINT;  (* Crudos verdes confirmados en M3 por S5 *)
    udiFedBlue        : UDINT;
    rPPM              : REAL;   (* Productos por minuto, ventana movil de 60 s *)
    rPPMInst          : REAL;
    rCycleTime_s      : REAL;   (* Tiempo entre dos productos terminados *)
    rAvailability     : REAL;
    rUtilMC1          : REAL;   (* % del tiempo en automatico que MC1 estuvo mecanizando *)
    rUtilMC2          : REAL;
    rCycleMC1_s       : REAL;   (* Duracion del ultimo ciclo de cada maquina *)
    rCycleMC2_s       : REAL;
    udiRunTime_s      : UDINT;
    udiFaultTime_s    : UDINT;
END_VAR
