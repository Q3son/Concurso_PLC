(* Extrae el primer color de la cola. Devuelve NONE si esta vacia. *)
FUNCTION FC_FifoPop : E_Color
VAR_IN_OUT
    stFifo : ST_Fifo;
END_VAR

IF stFifo.iCount <= 0 THEN
    FC_FifoPop := E_Color.NONE;
ELSE
    FC_FifoPop := stFifo.aItem[stFifo.iHead];
    stFifo.iHead := (stFifo.iHead + 1) MOD GVL_Param.FIFO_SIZE;
    stFifo.iCount := stFifo.iCount - 1;
END_IF
