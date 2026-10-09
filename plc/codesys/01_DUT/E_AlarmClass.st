{attribute 'qualified_only'}
{attribute 'strict'}
TYPE E_AlarmClass :
(
    WARNING   := 1,   (* Aviso: no detiene la maquina *)
    FAULT     := 2,   (* Falla: detiene la maquina, requiere Reset *)
    EMERGENCY := 3    (* Emergencia: corte inmediato *)
) INT;
END_TYPE
