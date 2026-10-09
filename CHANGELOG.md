# Cambios

## 3.0.0 · Revisión C (correcciones del jurado) · 2026-10

**Proceso nuevo**: crudos verde y azul → tapas y bases → segregación del producto por color.

### PLC
- Fajas alimentadoras M1/M2 con pushers Y01/Y02 (`FB_FeederStation`) y turno alterno en la unión.
- **S1 y S3 eliminados**; S2/S4 = pieza lista para empujar; **S5 confirma** cada transferencia (alarma 10).
- **S6.1/S6.2** (visión digital crudo verde/azul) reemplazan a la visión numérica (`FC_ColorFromSensors`, `E_Color`).
- **Wheel sorter** con presencia S7 y **regla de alternancia por color** (`FB_WheelSorter`, `E_SorterStep`).
- Dos **Machining Center** para tapas y bases (`FB_MachiningCenter`) con error, puerta y ocupación.
- **Segregación**: salida azul de largo, Y03/Y04 desvían el verde (`FB_ColorDiverter`); conteo con S12 a S15.
- **Lote** de X verdes e Y azules desde el HMI, con fin automático.
- Fajas por demanda (`FB_Conveyor` con marcha residual) y 24 alarmas.

### Tablero y gemelo digital
- Lógica separada en `control.js` (espejo del PLC) y `plant.js` (física); geometría única en `layout.js`.
- Sinóptico 2D generado desde la geometría y **gemelo 3D** con three.js.
- Paneles de lote, estado del proceso (turno, regla, colas por color) y ocupación de MC1/MC2.
- Mapa de E/S único (`iomap.js`) compartido por el tablero, OPC UA, la documentación y las pruebas.

### Calidad
- 18 pruebas: secuencia, regla por color, lote, fallas, robustez y coherencia `.st` ↔ tablero.
- Planos (distribución y hardware) y mapa de E/S generados desde el código; CI verifica que estén al día.
- Plantillas de *issues* y *pull requests*, CODEOWNERS, guía de colaboración y tareas de VS Code.

## 2.0.0 · Revisión B
- Celda de clasificación azul/verde/metal con dos orígenes, tres pushers y salida de rechazo.
