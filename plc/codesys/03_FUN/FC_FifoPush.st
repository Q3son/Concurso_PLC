(* Inserta un color al final de la cola. Devuelve FALSE si la cola esta llena. *)
FUNCTION FC_FifoPush : BOOL
VAR_IN_OUT
    stFifo : ST_Fifo;
END_VAR
VAR_INPUT
    eItem  : E_Color;
END_VAR
VAR
    iTail  : INT;
END_VAR

IF stFifo.iCount >= GVL_Param.FIFO_SIZE THEN
    FC_FifoPush := FALSE;
ELSE
    iTail := (stFifo.iHead + stFifo.iCount) MOD GVL_Param.FIFO_SIZE;
    stFifo.aItem[iTail] := eItem;
    stFifo.iCount := stFifo.iCount + 1;
    FC_FifoPush := TRUE;
END_IF
