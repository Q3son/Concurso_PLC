(* Indicadores de produccion: conteo por salida (S12 tapas azules, S13 tapas verdes,
   S14 bases azules, S15 bases verdes), productos/min (ventana movil de 60 s),
   tiempo entre productos y disponibilidad. *)
FUNCTION_BLOCK FB_Kpi
VAR_INPUT
    axExit       : ARRAY[1..4] OF BOOL;  (* Sensor de llegada a cada salida *)
    xRunning     : BOOL;                 (* Maquina en AUTO_RUN *)
    xStopped     : BOOL;                 (* Maquina en FAULT o EMERGENCY *)
    xResetCount  : BOOL;
END_VAR
VAR_OUTPUT
    audiCount    : ARRAY[1..4] OF UDINT;
    udiTotal     : UDINT;
    rPPM         : REAL;
    rPPMInst     : REAL;
    rCycle_s     : REAL;
    rAvailability: REAL := 100.0;
    udiRun_s     : UDINT;
    udiFault_s   : UDINT;
END_VAR
VAR
    artExit      : ARRAY[1..4] OF R_TRIG;
    tonTick      : TON;
    aBucket      : ARRAY[0..59] OF UINT;  (* Piezas por segundo, ultimos 60 s *)
    iBucket      : INT;
    i            : INT;
    udiSum       : UDINT;
    tNow         : TIME;
    tLastExit    : TIME;
    xHaveLast    : BOOL;
    xExit        : BOOL;
END_VAR

IF xResetCount THEN
    FOR i := 1 TO 4 DO audiCount[i] := 0; END_FOR
    FOR i := 0 TO 59 DO aBucket[i] := 0; END_FOR
    udiRun_s := 0; udiFault_s := 0;
    xHaveLast := FALSE;
    rPPMInst := 0; rCycle_s := 0;
END_IF

xExit := FALSE;
udiTotal := 0;
FOR i := 1 TO 4 DO
    artExit[i](CLK := axExit[i]);
    IF artExit[i].Q THEN
        audiCount[i] := audiCount[i] + 1;
        xExit := TRUE;
    END_IF
    udiTotal := udiTotal + audiCount[i];
END_FOR

IF xExit THEN
    aBucket[iBucket] := aBucket[iBucket] + 1;
    tNow := TIME();
    IF xHaveLast THEN
        rCycle_s := TIME_TO_REAL(tNow - tLastExit) / 1000.0;
        IF rCycle_s > 0.0 THEN
            rPPMInst := 60.0 / rCycle_s;
        END_IF
    END_IF
    tLastExit := tNow;
    xHaveLast := TRUE;
END_IF

(* Base de tiempo de 1 s *)
tonTick(IN := NOT tonTick.Q, PT := T#1S);
IF tonTick.Q THEN
    IF xRunning THEN udiRun_s := udiRun_s + 1; END_IF
    IF xStopped THEN udiFault_s := udiFault_s + 1; END_IF

    udiSum := 0;
    FOR i := 0 TO 59 DO
        udiSum := udiSum + aBucket[i];
    END_FOR
    rPPM := UDINT_TO_REAL(udiSum);

    iBucket := (iBucket + 1) MOD 60;
    aBucket[iBucket] := 0;

    IF (udiRun_s + udiFault_s) > 0 THEN
        rAvailability := 100.0 * UDINT_TO_REAL(udiRun_s) / UDINT_TO_REAL(udiRun_s + udiFault_s);
    END_IF
END_IF

IF NOT xRunning THEN
    rPPMInst := 0.0;
END_IF
