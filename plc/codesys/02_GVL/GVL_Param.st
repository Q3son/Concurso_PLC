{attribute 'qualified_only'}
VAR_GLOBAL CONSTANT
    ALARM_COUNT     : INT  := 25;
    FIFO_SIZE       : INT  := 16;
    N_FEEDERS       : INT  := 2;    (* 1 = faja 1 / verde (M1, Y01, S2)   2 = faja 2 / azul (M2, Y02, S4) *)
    N_LINES         : INT  := 2;    (* 1 = tapas (M4, MC1, M6, Y03, M7)   2 = bases (M5, MC2, M8, Y04, M9) *)
    (* Factory I/O: Stop y Emergencia son contactos normalmente cerrados (NC).
       Verifica en el driver: con el boton SIN pulsar la senal debe verse en verde. *)
    STOP_IS_NC      : BOOL := TRUE;
    ESTOP_IS_NC     : BOOL := TRUE;
END_VAR

VAR_GLOBAL
    (* ---------- Parametros ajustables (visibles por OPC UA) ---------- *)
    tPusherTimeout   : TIME := T#3S;      (* Vigilancia de finales de carrera de Y01..Y04 *)
    tTransferTimeout : TIME := T#4S;      (* Y01/Y02 empujo y S5 no vio la pieza = falla *)
    tFeederCenter    : TIME := T#500MS;   (* Centrado de la pieza frente a Y01/Y02 tras S2/S4 *)
    tDiverterCenter  : TIME := T#300MS;   (* Centrado frente a Y03/Y04 tras S10/S11 *)
    tMergeGap        : TIME := T#1500MS;  (* Avance minimo de M3 entre dos piezas empujadas *)
    tSorterSettle    : TIME := T#300MS;   (* Tiempo para elevar y orientar las ruedas *)
    tSorterTimeout   : TIME := T#10S;     (* Pieza que no termina de pasar por el sorter *)
    tSorterEnter     : TIME := T#2S;      (* Desde que sale de la vision hasta estar sobre el sorter *)
    tSorterDeliver   : TIME := T#4S;      (* Desde que sale de la vision hasta estar en su rama (si S7 no la ve) *)
    tBayWait         : TIME := T#25S;     (* Pieza en la bahia de MC esperando que el robot la tome (tras pasar S8/S9) *)
    tMainLost        : TIME := T#20S;     (* M3 marcha con piezas contadas que nunca llegan a la vision = piezas perdidas *)
    tSorterWait      : TIME := T#30S;     (* Pieza esperando cupo en una rama = aviso de cuello de botella *)
    tJam             : TIME := T#5S;      (* Sensor de salida ocupado con la faja en marcha = atasco *)
    tDrainTimeout    : TIME := T#90S;     (* Parada controlada: tiempo maximo para terminar lo que esta en proceso *)
    tRunOn           : TIME := T#2S;      (* Marcha residual de las fajas tras quedarse sin piezas *)
    iMainCapacity    : INT  := 3;         (* Piezas maximas en M3 (limita el inventario en proceso) *)
    iWipMax          : INT  := 6;         (* Crudos en proceso a la vez (M3 + ramas + maquinas): uno nuevo entra al terminar otro *)
    iBranchCapacity  : INT  := 2;         (* Piezas maximas esperando en cada rama M4/M5 *)
    xLidsOnLeft      : BOOL := TRUE;      (* TRUE: tapas = WS Left, bases = WS Right. Cambiar si la escena esta espejada *)
    xHoldOutOnPush   : BOOL := TRUE;      (* Detener M6/M8 mientras Y03/Y04 empujan *)
    (* ---------- Lote de produccion ("se alimenta X verdes y Y azules") ---------- *)
    uiLotGreen       : UINT := 0;         (* 0 y 0 = produccion continua *)
    uiLotBlue        : UINT := 0;
END_VAR
