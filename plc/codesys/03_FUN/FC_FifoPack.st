(* Empaqueta los colores de la cola en una WORD para el HMI:
   2 bits por pieza (01 = verde, 10 = azul), la primera pieza de la cola en los bits 0-1.
   Muestra como maximo 8 piezas. *)
FUNCTION FC_FifoPack : WORD
VAR_IN_OUT
    stFifo : ST_Fifo;
END_VAR
VAR
    k      : INT;
    iIdx   : INT;
    wPack  : WORD;
END_VAR

wPack := 0;
FOR k := 0 TO MIN(stFifo.iCount, 8) - 1 DO
    iIdx  := (stFifo.iHead + k) MOD GVL_Param.FIFO_SIZE;
    wPack := wPack OR SHL(INT_TO_WORD(TO_INT(stFifo.aItem[iIdx])), 2 * k);
END_FOR
FC_FifoPack := wPack;
