FUNCTION FC_FifoClear : BOOL
VAR_IN_OUT
    stFifo : ST_Fifo;
END_VAR

stFifo.iHead  := 0;
stFifo.iCount := 0;
FC_FifoClear  := TRUE;
