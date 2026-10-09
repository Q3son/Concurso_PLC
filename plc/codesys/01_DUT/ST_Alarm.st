TYPE ST_Alarm :
STRUCT
    sText      : STRING(80);
    eClass     : E_AlarmClass := E_AlarmClass.FAULT;
    xCondition : BOOL;   (* Condicion actual (la escribe el programa) *)
    xPrevCond  : BOOL;   (* Uso interno: deteccion de flanco *)
    xActive    : BOOL;   (* Alarma enclavada *)
    xUnack     : BOOL;   (* Pendiente de reconocimiento *)
    udiCount   : UDINT;  (* Numero de ocurrencias *)
END_STRUCT
END_TYPE
