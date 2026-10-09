(* Color de la materia prima / producto.
   Coincide con la observacion del jurado: S6.1 identifica crudo VERDE (1) y S6.2 crudo AZUL (2). *)
{attribute 'qualified_only'}
{attribute 'strict'}
TYPE E_Color :
(
    NONE  := 0,
    GREEN := 1,   (* Verde: S6.1 / origen faja alimentadora 1 (M1, Y01) *)
    BLUE  := 2    (* Azul:  S6.2 / origen faja alimentadora 2 (M2, Y02) *)
) INT;
END_TYPE
