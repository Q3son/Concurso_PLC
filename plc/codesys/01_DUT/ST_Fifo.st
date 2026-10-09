(* Cola circular para el seguimiento (tracking) del color de las piezas en cada rama *)
TYPE ST_Fifo :
STRUCT
    aItem  : ARRAY[0..15] OF E_Color;
    iHead  : INT;   (* Indice de lectura *)
    iCount : INT;   (* Elementos en cola *)
END_STRUCT
END_TYPE
