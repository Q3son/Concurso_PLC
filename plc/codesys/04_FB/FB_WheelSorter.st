(* Wheel sorter (Pop Up Wheel Sorter) con regla de alternancia por color.
   Regla del jurado: un crudo VERDE va a la rama de TAPAS si es el primer verde, o a BASES si el
   verde anterior ya fue a tapas (y asi sucesivamente). Lo mismo, de forma independiente, para AZUL.
   Secuencia:
     IDLE     : llega una pieza al punto de lectura (S6.1/S6.2). Si la rama destino tiene cupo -> PREPARE.
                Si no hay cupo, M3 se retiene con la pieza en lectura (acumulacion).
     PREPARE  : ruedas elevadas y orientadas (Left/Right). M3 espera tSettle.
     TRANSFER : M3 avanza; la pieza pasa por S7 (flanco de subida y bajada) -> DONE.
     DONE     : alterna la regla para ese color y avisa a PLC_PRG (xDone).
     ERROR    : pieza en S7 sin clasificar (no es crudo verde ni azul) o tiempo excedido. Reset. *)
FUNCTION_BLOCK FB_WheelSorter
VAR_INPUT
    xEnable       : BOOL;
    xAutoMode     : BOOL;           (* AUTO_RUN o AUTO_STOP *)
    xManualMode   : BOOL;
    xManPlus      : BOOL;
    xManLeft      : BOOL;
    xManRight     : BOOL;
    eColorAtRead  : E_Color;        (* FC_ColorFromSensors(S6.1, S6.2) *)
    xPresence     : BOOL;           (* S7 *)
    xLidsFree     : BOOL;           (* Cupo en la rama de tapas *)
    xBasesFree    : BOOL;           (* Cupo en la rama de bases *)
    xLidsOnLeft   : BOOL := TRUE;
    tSettle       : TIME := T#300MS;
    tTimeout      : TIME := T#6S;
    xReset        : BOOL;
    xResetRule    : BOOL;           (* Reinicia la alternancia: el proximo de cada color va a tapas *)
END_VAR
VAR_OUTPUT
    xPlus         : BOOL;
    xLeft         : BOOL;
    xRight        : BOOL;
    xHoldMain     : BOOL;           (* M3 debe detenerse *)
    xDone         : BOOL;           (* Pulso: pieza entregada a su rama *)
    xDiscarded    : BOOL;           (* Pulso: Reset tras pieza no identificada (el operador la retiro) *)
    eDoneColor    : E_Color;
    eDoneBranch   : E_Branch;
    eNextBranch   : E_Branch;       (* Destino previsto para la pieza en lectura *)
    xWaitingBranch: BOOL;           (* Pieza lista pero la rama destino esta llena *)
    xErrUnknown   : BOOL;
    xErrTimeout   : BOOL;
    eStep         : E_SorterStep := E_SorterStep.IDLE;
    axNextToBases : ARRAY[1..2] OF BOOL;   (* [1] verde, [2] azul. FALSE = el proximo va a tapas *)
END_VAR
VAR
    eColor        : E_Color;
    eBranch       : E_Branch;
    eStepPrev     : E_SorterStep;
    tonStep       : TON;
    rtPresence    : R_TRIG;
    ftPresence    : F_TRIG;
    ftRead        : F_TRIG;
    xPartAtRead   : BOOL;
    xSeenOnSorter : BOOL;           (* La pieza en curso ya llego a S7 *)
    xLeftRead     : BOOL;           (* La pieza en curso ya salio del punto de lectura *)
    xToLeft       : BOOL;
    xMoving       : BOOL;
END_VAR

xDone       := FALSE;
xDiscarded  := FALSE;
xPartAtRead := (eColorAtRead <> E_Color.NONE);
rtPresence(CLK := xPresence);
ftPresence(CLK := xPresence);
ftRead(CLK := xPartAtRead);

IF xResetRule THEN
    axNextToBases[1] := FALSE;
    axNextToBases[2] := FALSE;
END_IF

(* Destino previsto segun la alternancia del color leido *)
CASE eColorAtRead OF
    E_Color.GREEN:
        IF axNextToBases[1] THEN eNextBranch := E_Branch.BASES; ELSE eNextBranch := E_Branch.LIDS; END_IF
    E_Color.BLUE:
        IF axNextToBases[2] THEN eNextBranch := E_Branch.BASES; ELSE eNextBranch := E_Branch.LIDS; END_IF
ELSE
    eNextBranch := E_Branch.NONE;
END_CASE

(* Vigilancia de tiempo: se reinicia en cada cambio de paso *)
tonStep(IN := xEnable AND (eStep = eStepPrev)
              AND ((eStep = E_SorterStep.PREPARE) OR (eStep = E_SorterStep.TRANSFER)),
        PT := SEL(eStep = E_SorterStep.PREPARE, tTimeout, tSettle));
eStepPrev := eStep;

IF xManualMode THEN
    (* En manual el operador mueve el sorter; el seguimiento se vacia al volver a automatico *)
    IF eStep <> E_SorterStep.ERROR THEN
        eStep := E_SorterStep.IDLE;
    END_IF
ELSIF xEnable THEN
    CASE eStep OF
        E_SorterStep.IDLE:
            IF rtPresence.Q AND xAutoMode THEN
                xErrUnknown := TRUE;                     (* Llego al sorter sin pasar por la vision *)
                eStep := E_SorterStep.ERROR;
            ELSIF xPartAtRead AND xAutoMode THEN
                IF ((eNextBranch = E_Branch.LIDS) AND xLidsFree)
                   OR ((eNextBranch = E_Branch.BASES) AND xBasesFree) THEN
                    eColor        := eColorAtRead;
                    eBranch       := eNextBranch;
                    xSeenOnSorter := FALSE;
                    xLeftRead     := FALSE;
                    eStep         := E_SorterStep.PREPARE;
                END_IF
            END_IF

        E_SorterStep.PREPARE:
            IF tonStep.Q THEN
                eStep := E_SorterStep.TRANSFER;
            END_IF

        E_SorterStep.TRANSFER:
            IF ftRead.Q THEN
                xLeftRead := TRUE;
            END_IF
            IF rtPresence.Q THEN
                xSeenOnSorter := TRUE;
            END_IF
            IF xSeenOnSorter AND ftPresence.Q THEN
                eStep := E_SorterStep.DONE;
            ELSIF tonStep.Q THEN
                xErrTimeout := TRUE;
                eStep := E_SorterStep.ERROR;
            END_IF

        E_SorterStep.DONE:
            xDone       := TRUE;
            eDoneColor  := eColor;
            eDoneBranch := eBranch;
            axNextToBases[TO_INT(eColor)] := NOT axNextToBases[TO_INT(eColor)];
            eStep       := E_SorterStep.IDLE;

    END_CASE
END_IF

(* El Reset se atiende aunque la celda este en FAULT (sin permisivo) *)
IF (eStep = E_SorterStep.ERROR) AND xReset THEN
    xDiscarded  := xErrUnknown;
    xErrUnknown := FALSE;
    xErrTimeout := FALSE;
    eStep       := E_SorterStep.IDLE;
END_IF

(* ---------- Salidas ---------- *)
IF xLidsOnLeft THEN
    xToLeft := (eBranch = E_Branch.LIDS);
ELSE
    xToLeft := (eBranch = E_Branch.BASES);
END_IF
xMoving := xEnable AND xAutoMode
           AND ((eStep = E_SorterStep.PREPARE) OR (eStep = E_SorterStep.TRANSFER));

IF xManualMode THEN
    xPlus     := xEnable AND xManPlus;
    xLeft     := xEnable AND xManLeft;
    xRight    := xEnable AND xManRight AND NOT xManLeft;
    xHoldMain := FALSE;
ELSE
    xPlus     := xMoving;
    xLeft     := xMoving AND xToLeft;
    xRight    := xMoving AND NOT xToLeft;
    CASE eStep OF
        E_SorterStep.PREPARE, E_SorterStep.ERROR:
            xHoldMain := TRUE;
        E_SorterStep.TRANSFER:
            (* La siguiente pieza espera en lectura, pero solo cuando la pieza en curso ya esta
               sobre el sorter: antes, M3 debe seguir moviendose para entregarla *)
            xHoldMain := xSeenOnSorter AND xLeftRead AND xPartAtRead;
    ELSE
        xHoldMain := xPartAtRead;                      (* IDLE / DONE: esperar decision *)
    END_CASE
END_IF

xWaitingBranch := xAutoMode AND (eStep = E_SorterStep.IDLE) AND xPartAtRead;
