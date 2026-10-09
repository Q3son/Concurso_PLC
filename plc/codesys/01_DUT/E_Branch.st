(* Rama de proceso despues del wheel sorter. El valor se usa como indice de arreglo [1..2]. *)
{attribute 'qualified_only'}
{attribute 'strict'}
TYPE E_Branch :
(
    NONE  := 0,
    LIDS  := 1,   (* Rama de tapas  -> MC1 (Machining Center, Produce Lids = TRUE) *)
    BASES := 2    (* Rama de bases  -> MC2 (Machining Center, Produce Lids = FALSE) *)
) INT;
END_TYPE
