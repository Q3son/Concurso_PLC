## Qué cambia

<!-- Una o dos frases. Ej.: "Agrega la alarma de puerta abierta de MC1 y MC2". -->

Closes #

## Área

- [ ] PLC (`plc/codesys`)
- [ ] Escena Factory I/O / mapa de E/S
- [ ] Tablero HMI / gemelo digital (`hmi`)
- [ ] Documentación, planos o diagramas

## Verificación

- [ ] `cd hmi && npm test` en verde
- [ ] Si cambié `PLC_PRG` o un FB, repliqué el cambio en `hmi/public/js/control.js`
- [ ] Si cambié una E/S, actualicé `iomap.js` y ejecuté `npm run mapa-io`
- [ ] Si moví equipos, actualicé `layout.js` y ejecuté `npm run plano`
- [ ] Probado en Factory I/O + CODESYS (describe abajo) o solo en el gemelo digital

## Evidencia

<!-- Captura del tablero, de CODESYS en línea o de Factory I/O. -->
