(* Estados de la celda de manufactura *)
{attribute 'qualified_only'}
{attribute 'strict'}
TYPE E_MachineState :
(
    IDLE      := 0,    (* Detenida, lista para arrancar *)
    AUTO_RUN  := 10,   (* Produccion automatica *)
    AUTO_STOP := 20,   (* Parada controlada: se corta la alimentacion y se termina lo que esta en proceso *)
    MANUAL    := 30,   (* Operacion manual desde el HMI *)
    FAULT     := 90,   (* Falla: requiere Reset *)
    EMERGENCY := 99    (* Paro de emergencia activo *)
) INT;
END_TYPE
