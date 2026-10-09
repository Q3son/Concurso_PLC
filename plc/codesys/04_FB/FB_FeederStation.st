(* Estacion de alimentacion: faja alimentadora + pusher de transferencia a la faja principal.
   Instancias: faja 1 (M1, S2, Y01, crudo verde) y faja 2 (M2, S4, Y02, crudo azul).
   - La faja acerca piezas hasta que S2/S4 detecta una; tras tCenter la detiene centrada frente al pusher.
   - Con la pieza centrada (xReady) y el turno concedido por la union (xPushPermit) ejecuta un ciclo del pusher.
   - La confirmacion de llegada (S5) la vigila PLC_PRG, que es quien conoce la faja principal. *)
FUNCTION_BLOCK FB_FeederStation
VAR_INPUT
    xEnable      : BOOL;            (* Permisivo general *)
    xFeed        : BOOL;            (* AUTO_RUN: se permite acercar y transferir piezas *)
    xManualMode  : BOOL;
    xManBelt     : BOOL;            (* Manual: faja *)
    xManPush     : BOOL;            (* Manual: pulso de un ciclo del pusher *)
    xPartAtEnd   : BOOL;            (* S2 / S4 *)
    xPushPermit  : BOOL;            (* Turno concedido por la logica de union *)
    xFrontLimit  : BOOL;
    xBackLimit   : BOOL;
    tCenter      : TIME := T#400MS;
    tTimeout     : TIME := T#3S;
    xReset       : BOOL;
END_VAR
VAR_OUTPUT
    xBelt        : BOOL;            (* Salida a la faja M1 / M2 *)
    xPush        : BOOL;            (* Salida al pusher Y01 / Y02 *)
    xReady       : BOOL;            (* Pieza centrada y pusher en reposo: lista para transferir *)
    xPushStart   : BOOL;            (* Pulso: el pusher acaba de iniciar un empuje *)
    xBusy        : BOOL;
    xHome        : BOOL;
    xErrExtend   : BOOL;
    xErrRetract  : BOOL;
    eStep        : E_PusherStep;
END_VAR
VAR
    tonCenter    : TON;
    fbPusher     : FB_Pusher;
    eStepPrev    : E_PusherStep;
END_VAR

tonCenter(IN := xPartAtEnd, PT := tCenter);
xReady := tonCenter.Q AND (fbPusher.eStep = E_PusherStep.IDLE);

fbPusher(xEnable     := xEnable,
         xStart      := (xFeed AND NOT xManualMode AND xReady AND xPushPermit)
                        OR (xManualMode AND xManPush),
         xFrontLimit := xFrontLimit,
         xBackLimit  := xBackLimit,
         tTimeout    := tTimeout,
         xReset      := xReset);

xPushStart := (fbPusher.eStep = E_PusherStep.EXTEND) AND (eStepPrev <> E_PusherStep.EXTEND)
              AND NOT xManualMode;
eStepPrev  := fbPusher.eStep;

(* La faja avanza hasta tener una pieza centrada y se detiene mientras el pusher trabaja *)
IF NOT xEnable THEN
    xBelt := FALSE;
ELSIF xManualMode THEN
    xBelt := xManBelt;
ELSE
    xBelt := xFeed AND NOT tonCenter.Q AND NOT fbPusher.xBusy;
END_IF

xPush       := fbPusher.xPush;
xBusy       := fbPusher.xBusy;
xHome       := fbPusher.xHome;
xErrExtend  := fbPusher.xErrExtend;
xErrRetract := fbPusher.xErrRetract;
eStep       := fbPusher.eStep;
