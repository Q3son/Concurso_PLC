(* Gestor de alarmas: enclavamiento, reconocimiento con Reset y mascaras para el HMI.
   Una alarma solo se borra con Reset cuando su condicion ya desaparecio. *)
FUNCTION_BLOCK FB_AlarmManager
VAR_INPUT
    xReset         : BOOL;   (* Nivel: reconocer y borrar (usar pulso estirado ~200 ms) *)
END_VAR
VAR_IN_OUT
    aAlarm         : ARRAY[1..GVL_Param.ALARM_COUNT] OF ST_Alarm;
END_VAR
VAR_OUTPUT
    xAnyEmergency  : BOOL;
    xAnyFault      : BOOL;
    xAnyWarning    : BOOL;
    xAnyUnack      : BOOL;
    dwActiveMask   : DWORD;
    dwUnackMask    : DWORD;
    iActiveCount   : INT;
END_VAR
VAR
    i              : INT;
END_VAR

xAnyEmergency := FALSE;
xAnyFault     := FALSE;
xAnyWarning   := FALSE;
xAnyUnack     := FALSE;
dwActiveMask  := 0;
dwUnackMask   := 0;
iActiveCount  := 0;

FOR i := 1 TO GVL_Param.ALARM_COUNT DO
    (* Flanco ascendente de la condicion: nueva ocurrencia *)
    IF aAlarm[i].xCondition AND NOT aAlarm[i].xPrevCond THEN
        aAlarm[i].xActive  := TRUE;
        aAlarm[i].xUnack   := TRUE;
        aAlarm[i].udiCount := aAlarm[i].udiCount + 1;
    END_IF
    aAlarm[i].xPrevCond := aAlarm[i].xCondition;

    (* Reset: reconoce todo y borra lo que ya no tiene causa *)
    IF xReset THEN
        aAlarm[i].xUnack := FALSE;
        IF NOT aAlarm[i].xCondition THEN
            aAlarm[i].xActive := FALSE;
        END_IF
    END_IF

    IF aAlarm[i].xActive THEN
        iActiveCount := iActiveCount + 1;
        dwActiveMask := dwActiveMask OR SHL(DWORD#1, i - 1);
        CASE aAlarm[i].eClass OF
            E_AlarmClass.EMERGENCY: xAnyEmergency := TRUE;
            E_AlarmClass.FAULT:     xAnyFault     := TRUE;
            E_AlarmClass.WARNING:   xAnyWarning   := TRUE;
        END_CASE
    END_IF
    IF aAlarm[i].xUnack THEN
        xAnyUnack   := TRUE;
        dwUnackMask := dwUnackMask OR SHL(DWORD#1, i - 1);
    END_IF
END_FOR
