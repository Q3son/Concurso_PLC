(* Centro de mecanizado de Factory I/O (Machining Center): convierte un crudo en tapa o base.
   Tags (docs.factoryio.com/manual/parts/stations): Start, Stop, Reset, Produce Lids (salidas);
   Is Busy, Has Error, Opened, Progress (entradas). Tapas ~6 s, bases ~3 s de mecanizado.
   Instancias: MC1 = tapas (xProduceLids = TRUE), MC2 = bases (xProduceLids = FALSE).
   - xLoaded  : el robot retiro la pieza de la bahia de entrada (flanco de bajada de S8/S9).
   - xFinished: termino el mecanizado y la pieza quedo en la bahia de salida (flanco de bajada de Is Busy).
   - rUtilization: % del tiempo en automatico que la maquina estuvo ocupada (deteccion del cuello de botella). *)
FUNCTION_BLOCK FB_MachiningCenter
VAR_INPUT
    xEnable      : BOOL;            (* Sin emergencia ni falla *)
    xRun         : BOOL;            (* Celda en automatico (AUTO_RUN / AUTO_STOP) *)
    xManualMode  : BOOL;
    xManRun      : BOOL;
    xProduceLids : BOOL;
    xBusy        : BOOL;            (* Is Busy *)
    xEntry       : BOOL;            (* S8 / S9: pieza en la bahia de entrada *)
    xReset       : BOOL;
    xResetCount  : BOOL;
END_VAR
VAR_OUTPUT
    xStart       : BOOL;
    xStop        : BOOL;
    xResetOut    : BOOL;
    xLidsOut     : BOOL;
    xLoaded      : BOOL;            (* Pulso *)
    xFinished    : BOOL;            (* Pulso *)
    udiCycles    : UDINT;
    rLastCycle_s : REAL;
    rUtilization : REAL;
END_VAR
VAR
    ftEntry      : F_TRIG;
    rtBusy       : R_TRIG;
    ftBusy       : F_TRIG;
    tBusyStart   : TIME;
    tonTick      : TON;
    udiRun_s     : UDINT;
    udiBusy_s    : UDINT;
END_VAR

xStart    := xEnable AND ((NOT xManualMode AND xRun) OR (xManualMode AND xManRun));
xStop     := NOT xEnable;          (* Emergencia o falla: robot y CNC se detienen *)
xResetOut := xReset;
xLidsOut  := xProduceLids;

ftEntry(CLK := xEntry);
rtBusy(CLK := xBusy);
ftBusy(CLK := xBusy);
xLoaded   := ftEntry.Q AND xStart;
xFinished := ftBusy.Q;

IF rtBusy.Q THEN
    tBusyStart := TIME();
END_IF
IF ftBusy.Q THEN
    udiCycles    := udiCycles + 1;
    rLastCycle_s := TIME_TO_REAL(TIME() - tBusyStart) / 1000.0;
END_IF

IF xResetCount THEN
    udiRun_s := 0;
    udiBusy_s := 0;
    rUtilization := 0.0;
END_IF
tonTick(IN := NOT tonTick.Q, PT := T#1S);
IF tonTick.Q AND xRun AND xEnable THEN
    udiRun_s := udiRun_s + 1;
    IF xBusy THEN
        udiBusy_s := udiBusy_s + 1;
    END_IF
    rUtilization := 100.0 * UDINT_TO_REAL(udiBusy_s) / UDINT_TO_REAL(udiRun_s);
END_IF
