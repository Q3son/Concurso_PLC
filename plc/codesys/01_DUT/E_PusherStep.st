{attribute 'qualified_only'}
{attribute 'strict'}
TYPE E_PusherStep :
(
    IDLE    := 0,
    EXTEND  := 10,
    RETRACT := 20,
    DONE    := 30,
    ERROR   := 90
) INT;
END_TYPE
