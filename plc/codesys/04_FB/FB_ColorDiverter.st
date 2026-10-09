(* Segregacion por color a la salida de cada centro de mecanizado.
   La faja de salida (M6 / M8) es la de producto AZUL: las piezas azules siguen de largo.
   Un sensor de vision configurado en "Green Product Lid" (S10) o "Green Product Base" (S11)
   detecta el producto verde; tras tCenter la faja se detiene y el pusher (Y03 / Y04) lo empuja
   a la faja de producto verde (M7 / M9). *)
FUNCTION_BLOCK FB_ColorDiverter
VAR_INPUT
    xEnable      : BOOL;
    xAutoMode    : BOOL;
    xManualMode  : BOOL;
    xManPush     : BOOL;            (* Pulso: un ciclo del pusher *)
    xGreen       : BOOL;            (* S10 / S11 *)
    xFrontLimit  : BOOL;
    xBackLimit   : BOOL;
    tCenter      : TIME := T#300MS;
    tTimeout     : TIME := T#3S;
    xHoldOnPush  : BOOL := TRUE;
    xReset       : BOOL;
END_VAR
VAR_OUTPUT
    xHoldBelt    : BOOL;            (* Detener la faja de salida *)
    xPush        : BOOL;
    xDiverted    : BOOL;            (* Pulso: producto verde enviado a su faja *)
    xBusy        : BOOL;
    xHome        : BOOL;
    xErrExtend   : BOOL;
    xErrRetract  : BOOL;
    eStep        : E_PusherStep;
END_VAR
VAR
    tonCenter    : TON;
    fbPusher     : FB_Pusher;
END_VAR

tonCenter(IN := xGreen AND xAutoMode, PT := tCenter);

fbPusher(xEnable     := xEnable,
         xStart      := (xAutoMode AND tonCenter.Q) OR (xManualMode AND xManPush),
         xFrontLimit := xFrontLimit,
         xBackLimit  := xBackLimit,
         tTimeout    := tTimeout,
         xReset      := xReset);

xHoldBelt   := xAutoMode AND (tonCenter.Q OR (xHoldOnPush AND fbPusher.xBusy));
xDiverted   := fbPusher.xDone AND xAutoMode;
xPush       := fbPusher.xPush;
xBusy       := fbPusher.xBusy;
xHome       := fbPusher.xHome;
xErrExtend  := fbPusher.xErrExtend;
xErrRetract := fbPusher.xErrRetract;
eStep       := fbPusher.eStep;
