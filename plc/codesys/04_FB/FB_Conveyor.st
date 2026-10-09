(* Faja transportadora con modo Auto/Manual, marcha por demanda y contador de horas.
   En automatico la faja solo se mueve cuando hay piezas que mover (xDemand) y sigue
   tRunOn mas para vaciar el tramo: ahorra energia y desgaste. xHold la detiene
   cuando la estacion de aguas abajo esta ocupada (acumulacion). *)
FUNCTION_BLOCK FB_Conveyor
VAR_INPUT
    xEnable      : BOOL;            (* Permisivo: sin emergencia ni falla *)
    xManualMode  : BOOL;
    xAutoMode    : BOOL;            (* AUTO_RUN o AUTO_STOP *)
    xDemand      : BOOL;            (* Hay piezas en el tramo *)
    xHold        : BOOL;            (* Retencion pedida por la estacion siguiente *)
    xManualRun   : BOOL;            (* Orden manual desde el HMI *)
    tRunOn       : TIME := T#2S;
END_VAR
VAR_OUTPUT
    xMotor       : BOOL;
    udiRunTime_s : UDINT;
END_VAR
VAR
    tofRunOn     : TOF;
    tonSecond    : TON;
END_VAR

tofRunOn(IN := xDemand, PT := tRunOn);

IF NOT xEnable THEN
    xMotor := FALSE;
ELSIF xManualMode THEN
    xMotor := xManualRun;
ELSE
    xMotor := xAutoMode AND NOT xHold AND tofRunOn.Q;
END_IF

(* Contador de segundos de marcha (mantenimiento preventivo) *)
tonSecond(IN := xMotor AND NOT tonSecond.Q, PT := T#1S);
IF tonSecond.Q THEN
    udiRunTime_s := udiRunTime_s + 1;
END_IF
