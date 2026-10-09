(* Empujador de simple efecto con vigilancia de finales de carrera.
   Un flanco en xStart ejecuta un ciclo completo: extender -> retraer.
   Si un final de carrera no llega a tiempo -> ERROR (requiere xReset). *)
FUNCTION_BLOCK FB_Pusher
VAR_INPUT
    xEnable      : BOOL;
    xStart       : BOOL;          (* Flanco ascendente inicia el ciclo *)
    xFrontLimit  : BOOL;
    xBackLimit   : BOOL;
    tTimeout     : TIME := T#3S;
    xReset       : BOOL;
END_VAR
VAR_OUTPUT
    xPush        : BOOL;          (* Salida al actuador *)
    xBusy        : BOOL;
    xDone        : BOOL;          (* Pulso de un ciclo al terminar *)
    xErrExtend   : BOOL;
    xErrRetract  : BOOL;
    xHome        : BOOL;          (* Retraido y en reposo *)
    eStep        : E_PusherStep;
    udiCycles    : UDINT;
END_VAR
VAR
    rtStart      : R_TRIG;
    tonWatch     : TON;
    eStepPrev    : E_PusherStep;
END_VAR

rtStart(CLK := xStart);
xDone := FALSE;

(* El temporizador se reinicia automaticamente en cada cambio de paso *)
tonWatch(IN := (eStep = eStepPrev) AND
               ((eStep = E_PusherStep.EXTEND) OR (eStep = E_PusherStep.RETRACT)),
         PT := tTimeout);
eStepPrev := eStep;

(* Perdida de permisivo: retraer y abortar el ciclo (el llamador reintenta) *)
IF NOT xEnable AND ((eStep = E_PusherStep.EXTEND) OR (eStep = E_PusherStep.RETRACT)) THEN
    eStep := E_PusherStep.IDLE;
END_IF

CASE eStep OF
    E_PusherStep.IDLE:
        xPush := FALSE;
        IF rtStart.Q AND xEnable THEN
            eStep := E_PusherStep.EXTEND;
        END_IF

    E_PusherStep.EXTEND:
        xPush := TRUE;
        IF xFrontLimit THEN
            eStep := E_PusherStep.RETRACT;
        ELSIF tonWatch.Q THEN
            xErrExtend := TRUE;
            eStep := E_PusherStep.ERROR;
        END_IF

    E_PusherStep.RETRACT:
        xPush := FALSE;
        IF xBackLimit THEN
            eStep := E_PusherStep.DONE;
        ELSIF tonWatch.Q THEN
            xErrRetract := TRUE;
            eStep := E_PusherStep.ERROR;
        END_IF

    E_PusherStep.DONE:
        xPush := FALSE;
        xDone := TRUE;
        udiCycles := udiCycles + 1;
        eStep := E_PusherStep.IDLE;

    E_PusherStep.ERROR:
        xPush := FALSE;   (* Posicion segura: retraido *)
        IF xReset THEN
            xErrExtend  := FALSE;
            xErrRetract := FALSE;
            eStep := E_PusherStep.IDLE;
        END_IF
END_CASE

xBusy := (eStep = E_PusherStep.EXTEND) OR (eStep = E_PusherStep.RETRACT);
xHome := (eStep = E_PusherStep.IDLE) AND xBackLimit AND NOT xPush;
