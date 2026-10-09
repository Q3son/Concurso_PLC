(* Pasos de la secuencia del wheel sorter (FB_WheelSorter) *)
{attribute 'qualified_only'}
{attribute 'strict'}
TYPE E_SorterStep :
(
    IDLE     := 0,    (* Libre, esperando pieza en el punto de lectura S6.1/S6.2 *)
    PREPARE  := 10,   (* Ruedas elevadas y orientadas; la faja M3 espera *)
    TRANSFER := 20,   (* M3 entrega la pieza; se espera que pase por S7 *)
    DONE     := 30,   (* Pieza entregada a su rama (un ciclo) *)
    ERROR    := 90    (* Pieza no identificada o tiempo excedido: requiere Reset *)
) INT;
END_TYPE
