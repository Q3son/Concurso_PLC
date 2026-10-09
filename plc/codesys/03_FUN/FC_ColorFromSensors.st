(* Convierte las dos senales digitales de vision en un color.
   S6.1 (Green Raw Material) -> GREEN    S6.2 (Blue Raw Material) -> BLUE
   Ninguna, o ambas a la vez (lectura incoherente) -> NONE *)
FUNCTION FC_ColorFromSensors : E_Color
VAR_INPUT
    xGreen : BOOL;   (* S6.1 *)
    xBlue  : BOOL;   (* S6.2 *)
END_VAR

IF xGreen AND NOT xBlue THEN
    FC_ColorFromSensors := E_Color.GREEN;
ELSIF xBlue AND NOT xGreen THEN
    FC_ColorFromSensors := E_Color.BLUE;
ELSE
    FC_ColorFromSensors := E_Color.NONE;
END_IF
