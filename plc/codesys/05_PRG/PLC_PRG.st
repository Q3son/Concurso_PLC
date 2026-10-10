(* =====================================================================
   SMART FACTORY CHALLENGE - HRFEST 2026            Revision C (correcciones del jurado)
   Celda de manufactura: crudos verde/azul -> tapas y bases segregadas por color. Un solo PLC.

     ZONA 1 ALIMENTACION        ZONA 2 IDENTIFICACION     ZONA 3 MECANIZADO         ZONA 4 SEGREGACION
     E1 -> M1 -> S2 -> Y01 --+                          +-> M4 -> S8 -> MC1 (tapas) -> M6 -> S10/Y03 -> S12 tapas azules
                             +-> S5 -> M3 -> S6.1/S6.2 -> WS1 (S7)                              \-> M7 -> S13 tapas verdes
     E2 -> M2 -> S4 -> Y02 --+                          +-> M5 -> S9 -> MC2 (bases) -> M8 -> S11/Y04 -> S14 bases azules
                                                                                               \-> M9 -> S15 bases verdes
   Regla del wheel sorter (por color): 1er verde -> tapas, 2do verde -> bases, 3ro -> tapas...
                                        idem para azul, de forma independiente.
   Planta: Factory I/O  |  Control: CODESYS V3.5 (IEC 61131-3, ST)
   Protocolos: Modbus TCP (planta)  +  OPC UA (HMI/SCADA)
   Indices de arreglos:  feeders  k = 1 verde (M1/Y01/S2), 2 azul (M2/Y02/S4)
                         lineas   k = 1 tapas (M4/MC1/M6/Y03/M7), 2 bases (M5/MC2/M8/Y04/M9)
   ===================================================================== *)
PROGRAM PLC_PRG
VAR
    eState           : E_MachineState := E_MachineState.IDLE;
    xFirstScan       : BOOL := TRUE;
    xModeAuto        : BOOL;
    i                : INT;
    k                : INT;
    j                : INT;

    (* --- Senales acondicionadas y comandos --- *)
    xEStopActive     : BOOL;
    xStopPressed     : BOOL;
    xStartReq        : BOOL;
    xStopReq         : BOOL;
    xResetReq        : BOOL;
    xModeAutoReq     : BOOL;
    xModeManualReq   : BOOL;
    xClearTracking   : BOOL;
    xResetCounters   : BOOL;
    rtBtnStart       : R_TRIG;
    rtBtnStop        : R_TRIG;
    rtBtnReset       : R_TRIG;
    rtSelAuto        : R_TRIG;
    xSelAutoPrev     : BOOL;
    xSelPendAuto     : BOOL;          (* Selector girado a Auto: se aplica al quedar detenida la celda *)
    xSelPendMan      : BOOL;          (* Selector girado a Manual: idem *)
    tpReset          : TP;            (* Estira el pulso de Reset a 200 ms *)

    (* --- Permisivos --- *)
    xEnable          : BOOL;          (* Sin emergencia ni falla *)
    xAutoActive      : BOOL;          (* AUTO_RUN o AUTO_STOP *)
    xAutoRun         : BOOL;          (* Solo AUTO_RUN: se permite alimentar *)
    xManualMode      : BOOL;
    xAllHome         : BOOL;
    xDrained         : BOOL;

    (* --- Lote de produccion --- *)
    xLotMode         : BOOL;
    xLotDone         : BOOL;
    xLotCompleted    : BOOL;
    audiLotFed       : ARRAY[1..GVL_Param.N_FEEDERS] OF UDINT;   (* Empujes iniciados en el lote *)
    audiFed          : ARRAY[1..GVL_Param.N_FEEDERS] OF UDINT;   (* Transferencias confirmadas por S5 *)
    axAllow          : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;    (* Ese color aun se puede alimentar *)

    (* --- ZONA 1: alimentacion y union --- *)
    afbFeed          : ARRAY[1..GVL_Param.N_FEEDERS] OF FB_FeederStation;
    axPartAtEnd      : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axFeedFront      : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axFeedBack       : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axManFeedBelt    : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axManFeedPush    : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axManEmit        : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axEmit           : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    xBaysFull        : BOOL;          (* Una rama tiene iBranchCapacity piezas: se deja de alimentar *)
    iWip             : INT;           (* Crudos en proceso: en camino a M3, en M3, en las ramas y en las maquinas *)
    axPermit         : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;
    axAwaitDrop      : ARRAY[1..GVL_Param.N_FEEDERS] OF BOOL;    (* Empujo y espera ver la pieza en S5 *)
    atonAwait        : ARRAY[1..GVL_Param.N_FEEDERS] OF TON;
    iTurn            : INT := 1;      (* Turno de la union: 1 = verde, 2 = azul *)
    xMergeFree       : BOOL;
    xGapReq          : BOOL;          (* Esperar separacion tras la ultima pieza en M3 *)
    tonGap           : TON;
    rtS5             : R_TRIG;

    (* --- ZONA 2: faja principal, identificacion y wheel sorter --- *)
    iOnMain          : INT;           (* Piezas en M3 entre S5 y el sorter *)
    fbM3             : FB_Conveyor;
    eColorRead       : E_Color;
    fbSorter         : FB_WheelSorter;
    tonSorterWait    : TON;

    (* --- ZONAS 3 y 4: ramas, mecanizado, segregacion y conteo --- *)
    aBranch          : ARRAY[1..GVL_Param.N_LINES] OF ST_Fifo;            (* Colores en M4 / M5 *)
    aeMcColor        : ARRAY[1..GVL_Param.N_LINES] OF E_Color;            (* Pieza dentro de MC1 / MC2 *)
    aiOnOut          : ARRAY[1..GVL_Param.N_LINES] OF INT;                (* Piezas en M6 / M8 *)
    aiOnGreen        : ARRAY[1..GVL_Param.N_LINES] OF INT;                (* Piezas en M7 / M9 *)
    afbBranch        : ARRAY[1..GVL_Param.N_LINES] OF FB_Conveyor;        (* M4 / M5 *)
    afbMC            : ARRAY[1..GVL_Param.N_LINES] OF FB_MachiningCenter; (* MC1 / MC2 *)
    afbDiv           : ARRAY[1..GVL_Param.N_LINES] OF FB_ColorDiverter;   (* S10+Y03 / S11+Y04 *)
    afbOut           : ARRAY[1..GVL_Param.N_LINES] OF FB_Conveyor;        (* M6 / M8 (producto azul) *)
    afbGreen         : ARRAY[1..GVL_Param.N_LINES] OF FB_Conveyor;        (* M7 / M9 (producto verde) *)
    axEntry          : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axMcBusy         : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axMcError        : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axMcOpened       : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    aiMcProgress     : ARRAY[1..GVL_Param.N_LINES] OF INT;
    atonDoor         : ARRAY[1..GVL_Param.N_LINES] OF TON;   (* Puerta abierta con el mecanizado en curso *)
    axGreenVision    : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axDivFront       : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axDivBack        : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axExitBlue       : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axExitGreen      : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axManBranch      : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axManMC          : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axManDivPush     : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axManOut         : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    axManGreen       : ARRAY[1..GVL_Param.N_LINES] OF BOOL;
    artExitBlue      : ARRAY[1..GVL_Param.N_LINES] OF R_TRIG;
    artExitGreen     : ARRAY[1..GVL_Param.N_LINES] OF R_TRIG;
    atonJamBlue      : ARRAY[1..GVL_Param.N_LINES] OF TON;
    atonJamGreen     : ARRAY[1..GVL_Param.N_LINES] OF TON;
    xPushOk          : BOOL;

    (* --- Eventos (pulsos) que alimentan alarmas en el ciclo siguiente --- *)
    xEvtStartBlocked : BOOL;
    xEvtQueueFull    : BOOL;
    xEvtMainLost     : BOOL;
    tonMainLost      : TON;
    atonBranchLost   : ARRAY[1..GVL_Param.N_LINES] OF TON;   (* Rama con piezas contadas que nunca llegan a S8/S9 *)
    axBranchLost     : ARRAY[1..GVL_Param.N_LINES] OF BOOL;  (* Enclavado hasta Reset *)
    axBayWait        : ARRAY[1..GVL_Param.N_LINES] OF BOOL;  (* Pieza paso S8/S9 y espera al robot en la bahia *)
    aftEntry         : ARRAY[1..GVL_Param.N_LINES] OF F_TRIG;
    artMcBusy        : ARRAY[1..GVL_Param.N_LINES] OF R_TRIG;
    atonBayWait      : ARRAY[1..GVL_Param.N_LINES] OF TON;

    (* --- Gestion y KPI --- *)
    fbAlarm          : FB_AlarmManager;
    fbKpi            : FB_Kpi;
    axKpiExit        : ARRAY[1..4] OF BOOL;
    tonDrain         : TON;
    tonBlink         : TON;
    xBlink           : BOOL;
END_VAR

(* =====================================================================
   0. INICIALIZACION (primer ciclo): textos y clases de alarma
   ===================================================================== *)
IF xFirstScan THEN
    xFirstScan   := FALSE;
    xModeAuto    := GVL_IO.xSel_Auto;
    xSelAutoPrev := GVL_IO.xSel_Auto;

    GVL_Alarm.aAlarm[1].sText  := 'Paro de emergencia activado';
    GVL_Alarm.aAlarm[2].sText  := 'Y01 (faja verde): tiempo excedido al extender';
    GVL_Alarm.aAlarm[3].sText  := 'Y01 (faja verde): tiempo excedido al retraer';
    GVL_Alarm.aAlarm[4].sText  := 'Y02 (faja azul): tiempo excedido al extender';
    GVL_Alarm.aAlarm[5].sText  := 'Y02 (faja azul): tiempo excedido al retraer';
    GVL_Alarm.aAlarm[6].sText  := 'Y03 (tapas verdes): tiempo excedido al extender';
    GVL_Alarm.aAlarm[7].sText  := 'Y03 (tapas verdes): tiempo excedido al retraer';
    GVL_Alarm.aAlarm[8].sText  := 'Y04 (bases verdes): tiempo excedido al extender';
    GVL_Alarm.aAlarm[9].sText  := 'Y04 (bases verdes): tiempo excedido al retraer';
    GVL_Alarm.aAlarm[10].sText := 'Transferencia a la faja principal no confirmada por S5';
    GVL_Alarm.aAlarm[11].sText := 'Pieza no identificada en el wheel sorter';
    GVL_Alarm.aAlarm[12].sText := 'Wheel sorter: tiempo de transferencia excedido';
    GVL_Alarm.aAlarm[13].sText := 'MC1 (tapas) reporta error';
    GVL_Alarm.aAlarm[14].sText := 'MC2 (bases) reporta error';
    GVL_Alarm.aAlarm[15].sText := 'MC1 (tapas): puerta abierta durante el mecanizado';
    GVL_Alarm.aAlarm[16].sText := 'MC2 (bases): puerta abierta durante el mecanizado';
    GVL_Alarm.aAlarm[17].sText := 'Atasco en la salida de tapas azules (S12)';
    GVL_Alarm.aAlarm[18].sText := 'Atasco en la salida de tapas verdes (S13)';
    GVL_Alarm.aAlarm[19].sText := 'Atasco en la salida de bases azules (S14)';
    GVL_Alarm.aAlarm[20].sText := 'Atasco en la salida de bases verdes (S15)';
    GVL_Alarm.aAlarm[21].sText := 'Arranque bloqueado: pusher fuera de posicion';
    GVL_Alarm.aAlarm[22].sText := 'Faja principal esperando cupo en una rama';
    GVL_Alarm.aAlarm[23].sText := 'Cola de seguimiento llena';
    GVL_Alarm.aAlarm[24].sText := 'Factory I/O detenido o sin comunicacion';
    GVL_Alarm.aAlarm[25].sText := 'Piezas perdidas en M3 o en una rama (seguimiento corregido)';
    FOR i := 1 TO GVL_Param.ALARM_COUNT DO
        GVL_Alarm.aAlarm[i].eClass := E_AlarmClass.FAULT;
    END_FOR
    GVL_Alarm.aAlarm[1].eClass  := E_AlarmClass.EMERGENCY;
    GVL_Alarm.aAlarm[22].eClass := E_AlarmClass.WARNING;
    GVL_Alarm.aAlarm[23].eClass := E_AlarmClass.WARNING;
    GVL_Alarm.aAlarm[24].eClass := E_AlarmClass.WARNING;
    GVL_Alarm.aAlarm[25].eClass := E_AlarmClass.WARNING;
END_IF

(* =====================================================================
   1. ENTRADAS Y COMANDOS (panel de Factory I/O + HMI)
   ===================================================================== *)
(* XOR con la constante NC: funciona igual con contacto NA o NC.
   Con NC, un cable cortado o la planta desconectada = EMERGENCIA (fail-safe). *)
xEStopActive := (GVL_IO.xBtn_EStop XOR GVL_Param.ESTOP_IS_NC) OR GVL_HMI.xCmdEStop;
xStopPressed := GVL_IO.xBtn_Stop XOR GVL_Param.STOP_IS_NC;

rtBtnStart(CLK := GVL_IO.xBtn_Start);
rtBtnStop (CLK := xStopPressed);
rtBtnReset(CLK := GVL_IO.xBtn_Reset);
rtSelAuto (CLK := GVL_IO.xSel_Auto);

xStartReq      := rtBtnStart.Q OR GVL_HMI.xCmdStart;
xStopReq       := rtBtnStop.Q  OR GVL_HMI.xCmdStop;
xResetReq      := rtBtnReset.Q OR GVL_HMI.xCmdReset;
(* El giro del selector queda pendiente hasta que la celda este detenida (IDLE o MANUAL):
   asi no se pierde si se gira durante una emergencia o una falla. *)
IF rtSelAuto.Q THEN
    xSelPendAuto := TRUE;
    xSelPendMan  := FALSE;
ELSIF xSelAutoPrev AND NOT GVL_IO.xSel_Auto THEN
    xSelPendMan  := TRUE;
    xSelPendAuto := FALSE;
END_IF
xModeAutoReq   := xSelPendAuto OR GVL_HMI.xCmdModeAuto;
xModeManualReq := xSelPendMan  OR GVL_HMI.xCmdModeManual;
xSelAutoPrev   := GVL_IO.xSel_Auto;
xClearTracking := GVL_HMI.xCmdClearTracking;
xResetCounters := GVL_HMI.xCmdResetCounters;

(* Handshake: el PLC consume los comandos del HMI *)
GVL_HMI.xCmdStart         := FALSE;
GVL_HMI.xCmdStop          := FALSE;
GVL_HMI.xCmdReset         := FALSE;
GVL_HMI.xCmdModeAuto      := FALSE;
GVL_HMI.xCmdModeManual    := FALSE;
GVL_HMI.xCmdClearTracking := FALSE;
GVL_HMI.xCmdResetCounters := FALSE;

tpReset(IN := xResetReq, PT := T#200MS);

(* Copia de E/S a arreglos: una sola logica para las dos fajas y para las dos lineas *)
axPartAtEnd[1]   := GVL_IO.xS2_Feed1Ready;   axPartAtEnd[2]   := GVL_IO.xS4_Feed2Ready;
axFeedFront[1]   := GVL_IO.xY01_Front;       axFeedFront[2]   := GVL_IO.xY02_Front;
axFeedBack[1]    := GVL_IO.xY01_Back;        axFeedBack[2]    := GVL_IO.xY02_Back;
axManFeedBelt[1] := GVL_HMI.xManM1;          axManFeedBelt[2] := GVL_HMI.xManM2;
axManFeedPush[1] := GVL_HMI.xManPushY01;     axManFeedPush[2] := GVL_HMI.xManPushY02;
axManEmit[1]     := GVL_HMI.xManE1;          axManEmit[2]     := GVL_HMI.xManE2;

axEntry[1]       := GVL_IO.xS8_LidsEntry;    axEntry[2]       := GVL_IO.xS9_BasesEntry;
axMcBusy[1]      := GVL_IO.xMC1_Busy;        axMcBusy[2]      := GVL_IO.xMC2_Busy;
axMcError[1]     := GVL_IO.xMC1_Error;       axMcError[2]     := GVL_IO.xMC2_Error;
axMcOpened[1]    := GVL_IO.xMC1_Opened;      axMcOpened[2]    := GVL_IO.xMC2_Opened;
aiMcProgress[1]  := GVL_IO.iMC1_Progress;    aiMcProgress[2]  := GVL_IO.iMC2_Progress;
axGreenVision[1] := GVL_IO.xS10_GreenLid;    axGreenVision[2] := GVL_IO.xS11_GreenBase;
axDivFront[1]    := GVL_IO.xY03_Front;       axDivFront[2]    := GVL_IO.xY04_Front;
axDivBack[1]     := GVL_IO.xY03_Back;        axDivBack[2]     := GVL_IO.xY04_Back;
axExitBlue[1]    := GVL_IO.xS12_BlueLids;    axExitBlue[2]    := GVL_IO.xS14_BlueBases;
axExitGreen[1]   := GVL_IO.xS13_GreenLids;   axExitGreen[2]   := GVL_IO.xS15_GreenBases;
axManBranch[1]   := GVL_HMI.xManM4;          axManBranch[2]   := GVL_HMI.xManM5;
axManMC[1]       := GVL_HMI.xManMC1;         axManMC[2]       := GVL_HMI.xManMC2;
axManDivPush[1]  := GVL_HMI.xManPushY03;     axManDivPush[2]  := GVL_HMI.xManPushY04;
axManOut[1]      := GVL_HMI.xManM6;          axManOut[2]      := GVL_HMI.xManM8;
axManGreen[1]    := GVL_HMI.xManM7;          axManGreen[2]    := GVL_HMI.xManM9;

(* =====================================================================
   2. SELECCION DE MODO Y LOTE (solo con la celda detenida)
   ===================================================================== *)
IF (eState = E_MachineState.IDLE) OR (eState = E_MachineState.MANUAL) THEN
    IF xModeAutoReq THEN
        xModeAuto := TRUE;
    ELSIF xModeManualReq THEN
        xModeAuto := FALSE;
    END_IF
    xSelPendAuto := FALSE;
    xSelPendMan  := FALSE;
    IF GVL_HMI.xCmdApplyLot THEN
        GVL_Param.uiLotGreen := GVL_HMI.uiSetLotGreen;
        GVL_Param.uiLotBlue  := GVL_HMI.uiSetLotBlue;
        audiLotFed[1] := 0;
        audiLotFed[2] := 0;
        xLotCompleted := FALSE;
    END_IF
END_IF
GVL_HMI.xCmdApplyLot := FALSE;

(* Lote: "se alimentan X verdes e Y azules". Con ambos en 0 la produccion es continua. *)
xLotMode   := (GVL_Param.uiLotGreen > 0) OR (GVL_Param.uiLotBlue > 0);
axAllow[1] := NOT xLotMode OR (audiLotFed[1] < UINT_TO_UDINT(GVL_Param.uiLotGreen));
axAllow[2] := NOT xLotMode OR (audiLotFed[2] < UINT_TO_UDINT(GVL_Param.uiLotBlue));
xLotDone   := xLotMode AND NOT axAllow[1] AND NOT axAllow[2];

(* =====================================================================
   3. ALARMAS (condiciones -> gestor -> limpieza de eventos)
   ===================================================================== *)
GVL_Alarm.aAlarm[1].xCondition := xEStopActive;
FOR k := 1 TO GVL_Param.N_LINES DO
    GVL_Alarm.aAlarm[2 * k].xCondition      := afbFeed[k].xErrExtend;    (* 2 Y01, 4 Y02 *)
    GVL_Alarm.aAlarm[2 * k + 1].xCondition  := afbFeed[k].xErrRetract;   (* 3 Y01, 5 Y02 *)
    GVL_Alarm.aAlarm[4 + 2 * k].xCondition  := afbDiv[k].xErrExtend;     (* 6 Y03, 8 Y04 *)
    GVL_Alarm.aAlarm[5 + 2 * k].xCondition  := afbDiv[k].xErrRetract;    (* 7 Y03, 9 Y04 *)
    GVL_Alarm.aAlarm[12 + k].xCondition     := axMcError[k];             (* 13 MC1, 14 MC2 *)
    (* En la escena la puerta de la reja queda abierta y el robot trabaja igual: solo es falla
       si se abre con el mecanizado en curso (avance entre 1 y 99 %) durante mas de 1 s. *)
    atonDoor[k](IN := axMcOpened[k] AND (aiMcProgress[k] > 0) AND (aiMcProgress[k] < 100), PT := T#1S);
    GVL_Alarm.aAlarm[14 + k].xCondition     := atonDoor[k].Q;            (* 15 MC1, 16 MC2 *)
    GVL_Alarm.aAlarm[15 + 2 * k].xCondition := atonJamBlue[k].Q;         (* 17 S12, 19 S14 *)
    GVL_Alarm.aAlarm[16 + 2 * k].xCondition := atonJamGreen[k].Q;        (* 18 S13, 20 S15 *)
END_FOR
GVL_Alarm.aAlarm[10].xCondition := atonAwait[1].Q OR atonAwait[2].Q;
GVL_Alarm.aAlarm[11].xCondition := fbSorter.xErrUnknown;
GVL_Alarm.aAlarm[12].xCondition := fbSorter.xErrTimeout;
GVL_Alarm.aAlarm[21].xCondition := xEvtStartBlocked;
GVL_Alarm.aAlarm[22].xCondition := tonSorterWait.Q;
GVL_Alarm.aAlarm[23].xCondition := xEvtQueueFull;
GVL_Alarm.aAlarm[24].xCondition := NOT GVL_IO.xFio_Running;
GVL_Alarm.aAlarm[25].xCondition := xEvtMainLost;

fbAlarm(xReset := tpReset.Q, aAlarm := GVL_Alarm.aAlarm);

xEvtStartBlocked := FALSE;
xEvtQueueFull    := FALSE;
xEvtMainLost     := FALSE;

(* =====================================================================
   4. MAQUINA DE ESTADOS
   ===================================================================== *)
IF xEStopActive THEN
    eState := E_MachineState.EMERGENCY;
ELSIF fbAlarm.xAnyFault AND (eState <> E_MachineState.EMERGENCY) THEN
    eState := E_MachineState.FAULT;
END_IF

xAllHome := (fbSorter.eStep <> E_SorterStep.ERROR);
xDrained := (iOnMain = 0) AND (fbSorter.eStep = E_SorterStep.IDLE);
FOR k := 1 TO GVL_Param.N_LINES DO
    xAllHome := xAllHome AND afbFeed[k].xHome AND afbDiv[k].xHome;
    xDrained := xDrained AND (aBranch[k].iCount = 0) AND (aeMcColor[k] = E_Color.NONE)
                AND NOT axMcBusy[k] AND (aiOnOut[k] = 0) AND (aiOnGreen[k] = 0)
                AND NOT afbFeed[k].xBusy AND NOT axAwaitDrop[k];
END_FOR

CASE eState OF
    E_MachineState.IDLE:
        IF NOT xModeAuto THEN
            eState := E_MachineState.MANUAL;
        ELSIF xStartReq AND NOT xStopPressed THEN
            IF xAllHome THEN
                IF xLotCompleted THEN          (* Nuevo lote con los mismos parametros *)
                    audiLotFed[1] := 0;
                    audiLotFed[2] := 0;
                    xLotCompleted := FALSE;
                END_IF
                eState := E_MachineState.AUTO_RUN;
            ELSE
                xEvtStartBlocked := TRUE;
            END_IF
        END_IF

    E_MachineState.AUTO_RUN:
        IF xStopReq THEN
            eState := E_MachineState.AUTO_STOP;     (* Parada controlada *)
        ELSIF xLotDone THEN
            xLotCompleted := TRUE;
            eState := E_MachineState.AUTO_STOP;     (* Lote alimentado: terminar lo que esta en proceso *)
        END_IF

    E_MachineState.AUTO_STOP:
        IF xStartReq AND NOT xStopPressed AND NOT xLotDone THEN
            eState := E_MachineState.AUTO_RUN;
        ELSIF xDrained OR tonDrain.Q THEN
            eState := E_MachineState.IDLE;
        END_IF

    E_MachineState.MANUAL:
        IF xModeAuto THEN
            eState := E_MachineState.IDLE;
            xClearTracking := TRUE;                 (* En manual las piezas pudieron moverse *)
        END_IF

    E_MachineState.FAULT:
        IF NOT fbAlarm.xAnyFault AND NOT fbAlarm.xAnyEmergency THEN
            eState := E_MachineState.IDLE;
        END_IF

    E_MachineState.EMERGENCY:
        IF NOT xEStopActive AND NOT fbAlarm.xAnyEmergency THEN
            eState := E_MachineState.IDLE;
        END_IF
END_CASE

tonDrain(IN := (eState = E_MachineState.AUTO_STOP), PT := GVL_Param.tDrainTimeout);

(* =====================================================================
   5. PERMISIVOS
   ===================================================================== *)
xEnable     := (eState <> E_MachineState.FAULT) AND (eState <> E_MachineState.EMERGENCY);
xAutoRun    := (eState = E_MachineState.AUTO_RUN);
xAutoActive := xAutoRun OR (eState = E_MachineState.AUTO_STOP);
xManualMode := (eState = E_MachineState.MANUAL);

IF NOT xManualMode THEN
    GVL_HMI.xManE1 := FALSE;      GVL_HMI.xManE2 := FALSE;
    GVL_HMI.xManM1 := FALSE;      GVL_HMI.xManM2 := FALSE;      GVL_HMI.xManM3 := FALSE;
    GVL_HMI.xManM4 := FALSE;      GVL_HMI.xManM5 := FALSE;      GVL_HMI.xManM6 := FALSE;
    GVL_HMI.xManM7 := FALSE;      GVL_HMI.xManM8 := FALSE;      GVL_HMI.xManM9 := FALSE;
    GVL_HMI.xManWSPlus := FALSE;  GVL_HMI.xManWSLeft := FALSE;  GVL_HMI.xManWSRight := FALSE;
    GVL_HMI.xManMC1 := FALSE;     GVL_HMI.xManMC2 := FALSE;
    FOR k := 1 TO GVL_Param.N_LINES DO
        axManFeedBelt[k] := FALSE;  axManFeedPush[k] := FALSE;  axManEmit[k]  := FALSE;
        axManBranch[k]   := FALSE;  axManMC[k]       := FALSE;  axManDivPush[k] := FALSE;
        axManOut[k]      := FALSE;  axManGreen[k]    := FALSE;
    END_FOR
END_IF

(* Vaciar seguimiento: tras manual o a pedido del operador (nunca en automatico) *)
IF xClearTracking AND NOT xAutoActive THEN
    iOnMain := 0;
    xGapReq := FALSE;
    FOR k := 1 TO GVL_Param.N_LINES DO
        xPushOk        := FC_FifoClear(stFifo := aBranch[k]);
        aeMcColor[k]   := E_Color.NONE;
        aiOnOut[k]     := 0;
        aiOnGreen[k]   := 0;
        axAwaitDrop[k] := FALSE;
    END_FOR
END_IF

(* =====================================================================
   6. ZONA 1: ALIMENTACION Y UNION EN LA FAJA PRINCIPAL
      - S2/S4: pieza lista frente a Y01/Y02 (S1 y S3 eliminados segun observacion).
      - Solo se empuja con S5 libre, la ultima pieza ya alejada (tMergeGap con M3 en marcha)
        y cupo en M3. Si las dos fajas tienen pieza, se alternan (turno).
      - Cada empuje debe confirmarse con S5 antes de tTransferTimeout (alarma 10).
   ===================================================================== *)
rtS5(CLK := GVL_IO.xS5_MainDrop);
IF rtS5.Q AND xAutoActive THEN
    iOnMain := iOnMain + 1;
    xGapReq := TRUE;
    FOR k := 1 TO GVL_Param.N_FEEDERS DO
        IF axAwaitDrop[k] THEN
            axAwaitDrop[k] := FALSE;
            audiFed[k] := audiFed[k] + 1;
            EXIT;
        END_IF
    END_FOR
END_IF

(* La separacion solo cuenta mientras M3 se mueve *)
tonGap(IN := xGapReq AND fbM3.xMotor, PT := GVL_Param.tMergeGap);
IF tonGap.Q THEN
    xGapReq := FALSE;
END_IF

(* Contencion: si en una rama ya esperan iBranchCapacity piezas para su maquina, no se empuja
   ni se emite nada nuevo hasta que el robot libere la bahia (el ritmo lo marca la maquina) *)
iWip := iOnMain + aBranch[1].iCount + aBranch[2].iCount;
FOR k := 1 TO GVL_Param.N_LINES DO
    IF aeMcColor[k] <> E_Color.NONE THEN iWip := iWip + 1; END_IF
    IF axAwaitDrop[k] THEN iWip := iWip + 1; END_IF
END_FOR
(* Limite de trabajo en proceso: un crudo nuevo entra cuando una maquina termina otro *)
xBaysFull := (aBranch[1].iCount >= GVL_Param.iBranchCapacity)
             OR (aBranch[2].iCount >= GVL_Param.iBranchCapacity)
             OR (iWip >= GVL_Param.iWipMax);
xMergeFree := xAutoRun AND NOT GVL_IO.xS5_MainDrop AND NOT xGapReq AND NOT xBaysFull
              AND (iOnMain < GVL_Param.iMainCapacity);
FOR k := 1 TO GVL_Param.N_FEEDERS DO
    xMergeFree := xMergeFree AND NOT afbFeed[k].xBusy AND NOT axAwaitDrop[k];
END_FOR

FOR k := 1 TO GVL_Param.N_FEEDERS DO
    j := 3 - k;   (* La otra faja *)
    axPermit[k] := xMergeFree AND axAllow[k]
                   AND ((iTurn = k) OR NOT afbFeed[j].xReady OR NOT axAllow[j]);
    afbFeed[k](xEnable     := xEnable,
               xFeed       := xAutoRun,
               xManualMode := xManualMode,
               xManBelt    := axManFeedBelt[k],
               xManPush    := axManFeedPush[k],
               xPartAtEnd  := axPartAtEnd[k],
               xPushPermit := axPermit[k],
               xFrontLimit := axFeedFront[k],
               xBackLimit  := axFeedBack[k],
               tCenter     := GVL_Param.tFeederCenter,
               tTimeout    := GVL_Param.tPusherTimeout,
               xReset      := tpReset.Q);
    IF afbFeed[k].xPushStart THEN
        xMergeFree     := FALSE;       (* La otra faja no puede empujar en este mismo ciclo *)
        iTurn          := j;           (* El turno pasa a la otra faja *)
        axAwaitDrop[k] := TRUE;
        audiLotFed[k]  := audiLotFed[k] + 1;
    END_IF
    IF tpReset.Q THEN
        axAwaitDrop[k] := FALSE;       (* El operador ya reviso la transferencia *)
    END_IF
    (* El tiempo de confirmacion solo corre con M3 en marcha: si el sorter retiene M3,
       la pieza empujada espera antes de S5 y eso no es una falla *)
    atonAwait[k](IN := axAwaitDrop[k] AND xEnable AND fbM3.xMotor, PT := GVL_Param.tTransferTimeout);

    (* Emisor: solo mientras su faja avanza y el lote lo permite.
       Factory I/O no emite mientras el volumen del emisor esta ocupado. *)
    axEmit[k] := xEnable AND ((xAutoRun AND axAllow[k] AND NOT xBaysFull AND afbFeed[k].xBelt)
                              OR (xManualMode AND axManEmit[k]));
END_FOR
GVL_HMI.xManPushY01 := FALSE;
GVL_HMI.xManPushY02 := FALSE;

(* =====================================================================
   7. ZONA 2: FAJA PRINCIPAL, IDENTIFICACION (S6.1 / S6.2) Y WHEEL SORTER
   ===================================================================== *)
eColorRead := FC_ColorFromSensors(xGreen := GVL_IO.xS61_GreenRaw, xBlue := GVL_IO.xS62_BlueRaw);

fbSorter(xEnable      := xEnable,
         xAutoMode    := xAutoActive,
         xManualMode  := xManualMode,
         xManPlus     := GVL_HMI.xManWSPlus,
         xManLeft     := GVL_HMI.xManWSLeft,
         xManRight    := GVL_HMI.xManWSRight,
         eColorAtRead := eColorRead,
         xPresence    := GVL_IO.xS7_Sorter,
         xLidsFree    := (aBranch[1].iCount < GVL_Param.iBranchCapacity),
         xBasesFree   := (aBranch[2].iCount < GVL_Param.iBranchCapacity),
         xLidsOnLeft  := GVL_Param.xLidsOnLeft,
         tSettle      := GVL_Param.tSorterSettle,
         tTimeout     := GVL_Param.tSorterTimeout,
         tEnter       := GVL_Param.tSorterEnter,
         tDeliver     := GVL_Param.tSorterDeliver,
         xReset       := tpReset.Q,
         xResetRule   := xClearTracking AND NOT xAutoActive);

IF fbSorter.xDone THEN
    iOnMain := MAX(iOnMain - 1, 0);
    k := TO_INT(fbSorter.eDoneBranch);
    xPushOk := FC_FifoPush(stFifo := aBranch[k], eItem := fbSorter.eDoneColor);
    IF NOT xPushOk THEN
        xEvtQueueFull := TRUE;
    END_IF
    GVL_HMI.iLastColor := TO_INT(fbSorter.eDoneColor);
END_IF
IF fbSorter.xDiscarded THEN
    iOnMain := MAX(iOnMain - 1, 0);   (* La pieza no identificada salio de la linea a mano *)
END_IF
tonSorterWait(IN := fbSorter.xWaitingBranch, PT := GVL_Param.tSorterWait);

(* "Si hay objeto en la linea, mover la faja": M3 solo marcha con piezas.
   Tambien mientras se espera la caida de un empuje, para que la pieza llegue a S5
   aunque el sensor quede un poco aguas abajo del punto de caida. *)
fbM3(xEnable     := xEnable,
     xManualMode := xManualMode,
     xAutoMode   := xAutoActive,
     xDemand     := (iOnMain > 0) OR (eColorRead <> E_Color.NONE)
                    OR axAwaitDrop[1] OR axAwaitDrop[2],
     xHold       := fbSorter.xHoldMain,
     xManualRun  := GVL_HMI.xManM3,
     tRunOn      := GVL_Param.tRunOn);

(* Piezas perdidas: M3 marcha con piezas contadas pero ninguna llega a la vision ni al sorter
   (se cayeron o se retiraron a mano). Se corrige la cuenta y se avisa, en vez de bloquear la union. *)
tonMainLost(IN := xAutoActive AND fbM3.xMotor AND (iOnMain > 0) AND (eColorRead = E_Color.NONE)
                  AND (fbSorter.eStep = E_SorterStep.IDLE) AND NOT GVL_IO.xS7_Sorter,
            PT := GVL_Param.tMainLost);
IF tonMainLost.Q THEN
    iOnMain      := 0;
    xEvtMainLost := TRUE;
END_IF

(* =====================================================================
   8. ZONAS 3 Y 4: RAMAS, CENTROS DE MECANIZADO, SEGREGACION POR COLOR Y CONTEO
      La misma logica para tapas (k = 1) y bases (k = 2).
   ===================================================================== *)
FOR k := 1 TO GVL_Param.N_LINES DO
    (* Rama M4/M5: acerca piezas a la bahia de entrada y se detiene con la pieza en S8/S9.
       Una sola pieza en la bahia: cuando la pieza pasa S8/S9 y entra a la bahia, la faja sigue
       detenida hasta que el robot la toma (Is Busy sube) o vence tBayWait. Asi el robot nunca
       encuentra dos piezas juntas (se le caian) y no se amontonan en la bahia. *)
    aftEntry[k](CLK := axEntry[k]);
    artMcBusy[k](CLK := axMcBusy[k]);
    IF aftEntry[k].Q AND xAutoActive THEN
        axBayWait[k] := TRUE;
    END_IF
    atonBayWait[k](IN := axBayWait[k], PT := GVL_Param.tBayWait);
    IF artMcBusy[k].Q OR atonBayWait[k].Q OR NOT xAutoActive THEN
        axBayWait[k] := FALSE;
    END_IF
    afbBranch[k](xEnable     := xEnable,
                 xManualMode := xManualMode,
                 xAutoMode   := xAutoActive,
                 xDemand     := (aBranch[k].iCount > 0),
                 xHold       := axEntry[k] OR axBayWait[k],
                 xManualRun  := axManBranch[k],
                 tRunOn      := GVL_Param.tRunOn);

    (* La faja de la rama marcha con piezas contadas pero ninguna llega a S8/S9: piezas caidas
       o atascadas antes de la maquina. Se avisa (alarma 25) y la cola se conserva, asi el sorter
       no manda mas piezas encima. Con Reset (tras revisar la rama) se vacia la cola. *)
    atonBranchLost[k](IN := xAutoActive AND afbBranch[k].xMotor AND (aBranch[k].iCount > 0)
                            AND NOT axEntry[k],
                      PT := GVL_Param.tMainLost);
    IF atonBranchLost[k].Q THEN
        axBranchLost[k] := TRUE;
        xEvtMainLost    := TRUE;
    END_IF
    IF axBranchLost[k] AND tpReset.Q THEN
        xPushOk         := FC_FifoClear(stFifo := aBranch[k]);
        axBranchLost[k] := FALSE;
    END_IF

    (* Centro de mecanizado: MC1 produce tapas, MC2 produce bases *)
    afbMC[k](xEnable      := xEnable,
             xRun         := xAutoActive,
             xManualMode  := xManualMode,
             xManRun      := axManMC[k],
             xProduceLids := (k = 1),
             xBusy        := axMcBusy[k],
             xEntry       := axEntry[k],
             xReset       := tpReset.Q,
             xResetCount  := xResetCounters);
    IF afbMC[k].xLoaded AND xAutoActive THEN
        aeMcColor[k] := FC_FifoPop(stFifo := aBranch[k]);
    END_IF
    IF afbMC[k].xFinished AND xAutoActive THEN
        aiOnOut[k]   := aiOnOut[k] + 1;
        aeMcColor[k] := E_Color.NONE;
    END_IF

    (* Segregacion: el producto verde se desvia, el azul sigue de largo *)
    afbDiv[k](xEnable     := xEnable,
              xAutoMode   := xAutoActive,
              xManualMode := xManualMode,
              xManPush    := axManDivPush[k],
              xGreen      := axGreenVision[k],
              xFrontLimit := axDivFront[k],
              xBackLimit  := axDivBack[k],
              tCenter     := GVL_Param.tDiverterCenter,
              tTimeout    := GVL_Param.tPusherTimeout,
              xHoldOnPush := GVL_Param.xHoldOutOnPush,
              xReset      := tpReset.Q);
    IF afbDiv[k].xDiverted THEN
        aiOnOut[k]   := MAX(aiOnOut[k] - 1, 0);
        aiOnGreen[k] := aiOnGreen[k] + 1;
    END_IF

    afbOut[k](xEnable     := xEnable,
              xManualMode := xManualMode,
              xAutoMode   := xAutoActive,
              (* Tambien mientras la maquina tiene pieza: el robot deja el producto en la bahia de
                 salida y la faja debe sacarlo de ahi para que la maquina pueda descargar *)
              xDemand     := (aiOnOut[k] > 0) OR (aeMcColor[k] <> E_Color.NONE),
              xHold       := afbDiv[k].xHoldBelt,
              xManualRun  := axManOut[k],
              tRunOn      := GVL_Param.tRunOn);
    afbGreen[k](xEnable     := xEnable,
                xManualMode := xManualMode,
                xAutoMode   := xAutoActive,
                xDemand     := (aiOnGreen[k] > 0),
                xHold       := FALSE,
                xManualRun  := axManGreen[k],
                tRunOn      := GVL_Param.tRunOn);

    (* Conteo con los sensores capacitivos al final de cada faja de salida *)
    artExitBlue[k](CLK := axExitBlue[k]);
    artExitGreen[k](CLK := axExitGreen[k]);
    IF artExitBlue[k].Q AND xAutoActive THEN
        aiOnOut[k] := MAX(aiOnOut[k] - 1, 0);
    END_IF
    IF artExitGreen[k].Q AND xAutoActive THEN
        aiOnGreen[k] := MAX(aiOnGreen[k] - 1, 0);
    END_IF

    (* Atasco: sensor de salida ocupado demasiado tiempo con la faja en marcha *)
    atonJamBlue[k](IN := axExitBlue[k] AND afbOut[k].xMotor, PT := GVL_Param.tJam);
    atonJamGreen[k](IN := axExitGreen[k] AND afbGreen[k].xMotor, PT := GVL_Param.tJam);
END_FOR
GVL_HMI.xManPushY03 := FALSE;
GVL_HMI.xManPushY04 := FALSE;

(* =====================================================================
   9. SALIDAS FISICAS Y SENALIZACION
   ===================================================================== *)
GVL_IO.xE1_EmitGreen    := axEmit[1];
GVL_IO.xE2_EmitBlue     := axEmit[2];
GVL_IO.xM1_Feed1        := afbFeed[1].xBelt;
GVL_IO.xM2_Feed2        := afbFeed[2].xBelt;
GVL_IO.xY01_Push        := afbFeed[1].xPush;
GVL_IO.xY02_Push        := afbFeed[2].xPush;
GVL_IO.xM3_Main         := fbM3.xMotor;
GVL_IO.xWS_Plus         := fbSorter.xPlus;
GVL_IO.xWS_Left         := fbSorter.xLeft;
GVL_IO.xWS_Right        := fbSorter.xRight;
GVL_IO.xM4_LidsBranch   := afbBranch[1].xMotor;
GVL_IO.xM5_BasesBranch  := afbBranch[2].xMotor;
GVL_IO.xMC1_Start       := afbMC[1].xStart;
GVL_IO.xMC1_Stop        := afbMC[1].xStop;
GVL_IO.xMC1_Reset       := afbMC[1].xResetOut;
GVL_IO.xMC1_ProduceLids := afbMC[1].xLidsOut;
GVL_IO.xMC2_Start       := afbMC[2].xStart;
GVL_IO.xMC2_Stop        := afbMC[2].xStop;
GVL_IO.xMC2_Reset       := afbMC[2].xResetOut;
GVL_IO.xMC2_ProduceLids := afbMC[2].xLidsOut;
GVL_IO.xM6_LidsOut      := afbOut[1].xMotor;
GVL_IO.xY03_Push        := afbDiv[1].xPush;
GVL_IO.xM7_GreenLids    := afbGreen[1].xMotor;
GVL_IO.xM8_BasesOut     := afbOut[2].xMotor;
GVL_IO.xY04_Push        := afbDiv[2].xPush;
GVL_IO.xM9_GreenBases   := afbGreen[2].xMotor;

tonBlink(IN := NOT tonBlink.Q, PT := T#500MS);
IF tonBlink.Q THEN
    xBlink := NOT xBlink;
END_IF

GVL_IO.xLamp_Green  := (eState = E_MachineState.AUTO_RUN)
                       OR ((eState = E_MachineState.AUTO_STOP) AND xBlink);
GVL_IO.xLamp_Yellow := (eState = E_MachineState.IDLE)
                       OR ((eState = E_MachineState.MANUAL) AND xBlink)
                       OR (fbAlarm.xAnyWarning AND xBlink);
GVL_IO.xLamp_Red    := (eState = E_MachineState.EMERGENCY)
                       OR ((eState = E_MachineState.FAULT) AND xBlink);
GVL_IO.xLamp_Start  := (eState = E_MachineState.IDLE) AND xModeAuto;
GVL_IO.xLamp_Reset  := fbAlarm.xAnyUnack AND xBlink;
GVL_IO.xLamp_Stop   := (eState <> E_MachineState.AUTO_RUN);

(* =====================================================================
   10. KPI Y ESTADO PARA EL HMI
   ===================================================================== *)
axKpiExit[1] := GVL_IO.xS12_BlueLids;
axKpiExit[2] := GVL_IO.xS13_GreenLids;
axKpiExit[3] := GVL_IO.xS14_BlueBases;
axKpiExit[4] := GVL_IO.xS15_GreenBases;
fbKpi(axExit      := axKpiExit,
      xRunning    := (eState = E_MachineState.AUTO_RUN),
      xStopped    := (eState = E_MachineState.FAULT) OR (eState = E_MachineState.EMERGENCY),
      xResetCount := xResetCounters);
IF xResetCounters THEN
    audiFed[1] := 0;
    audiFed[2] := 0;
END_IF

GVL_IO.iDisplay := UDINT_TO_INT(fbKpi.udiTotal MOD 10000);

GVL_HMI.iState            := TO_INT(eState);
GVL_HMI.xModeAuto         := xModeAuto;
GVL_HMI.xTurnBlue         := (iTurn = 2);
GVL_HMI.iSorterStep       := TO_INT(fbSorter.eStep);
GVL_HMI.iSorterNext       := TO_INT(fbSorter.eNextBranch);
GVL_HMI.xNextGreenToBases := fbSorter.axNextToBases[1];
GVL_HMI.xNextBlueToBases  := fbSorter.axNextToBases[2];
GVL_HMI.iOnMain           := iOnMain;
GVL_HMI.iLidsQueue        := aBranch[1].iCount;
GVL_HMI.iBasesQueue       := aBranch[2].iCount;
GVL_HMI.wLidsQueue        := FC_FifoPack(stFifo := aBranch[1]);
GVL_HMI.wBasesQueue       := FC_FifoPack(stFifo := aBranch[2]);
GVL_HMI.iMC1Color         := TO_INT(aeMcColor[1]);
GVL_HMI.iMC2Color         := TO_INT(aeMcColor[2]);
GVL_HMI.iOnLidsOut        := aiOnOut[1];
GVL_HMI.iOnGreenLids      := aiOnGreen[1];
GVL_HMI.iOnBasesOut       := aiOnOut[2];
GVL_HMI.iOnGreenBases     := aiOnGreen[2];
GVL_HMI.iY01Step          := TO_INT(afbFeed[1].eStep);
GVL_HMI.iY02Step          := TO_INT(afbFeed[2].eStep);
GVL_HMI.iY03Step          := TO_INT(afbDiv[1].eStep);
GVL_HMI.iY04Step          := TO_INT(afbDiv[2].eStep);
GVL_HMI.xLotMode          := xLotMode;
GVL_HMI.xLotCompleted     := xLotCompleted;
GVL_HMI.udiLotFedGreen    := audiLotFed[1];
GVL_HMI.udiLotFedBlue     := audiLotFed[2];
GVL_HMI.dwAlarmActive     := fbAlarm.dwActiveMask;
GVL_HMI.dwAlarmUnack      := fbAlarm.dwUnackMask;
GVL_HMI.udiTotal          := fbKpi.udiTotal;
GVL_HMI.udiBlueLids       := fbKpi.audiCount[1];
GVL_HMI.udiGreenLids      := fbKpi.audiCount[2];
GVL_HMI.udiBlueBases      := fbKpi.audiCount[3];
GVL_HMI.udiGreenBases     := fbKpi.audiCount[4];
GVL_HMI.udiFedGreen       := audiFed[1];
GVL_HMI.udiFedBlue        := audiFed[2];
GVL_HMI.rPPM              := fbKpi.rPPM;
GVL_HMI.rPPMInst          := fbKpi.rPPMInst;
GVL_HMI.rCycleTime_s      := fbKpi.rCycle_s;
GVL_HMI.rAvailability     := fbKpi.rAvailability;
GVL_HMI.rUtilMC1          := afbMC[1].rUtilization;
GVL_HMI.rUtilMC2          := afbMC[2].rUtilization;
GVL_HMI.rCycleMC1_s       := afbMC[1].rLastCycle_s;
GVL_HMI.rCycleMC2_s       := afbMC[2].rLastCycle_s;
GVL_HMI.udiRunTime_s      := fbKpi.udiRun_s;
GVL_HMI.udiFaultTime_s    := fbKpi.udiFault_s;
GVL_HMI.udiHeartbeat      := GVL_HMI.udiHeartbeat + 1;
