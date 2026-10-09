# 5. Video de clasificación y estrategia para la final

## 5.1 Reglas del video

- Máximo **5 minutos**, grabado con Zoom (u OBS) y **la cámara encendida en miniatura**.
- Se debe ver el **código activo** (CODESYS en línea, con valores en vivo) y la **simulación corriendo**.
- **Sin cortes de edición.** Ensaya el guion completo tres veces antes de grabar.

## 5.2 Guion sugerido (alineado con la rúbrica)

| Tiempo | Qué mostrar | Criterio |
|---|---|---|
| 0:00 a 0:30 | Plano de distribución y Factory I/O junto al tablero. "Crudos verde y azul, dos centros de mecanizado, producto segregado por color; un solo PLC, 28 sensores y 26 actuadores." | Contexto, hardware (20 %) |
| 0:30 a 1:30 | Selector en Auto, Start. Mostrar la unión (turno Y01/Y02 y confirmación con S5), la lectura S6.1/S6.2 y cómo el sorter **alterna tapas y bases por color** (`fbSorter.axNextToBases` en línea). Seguir una pieza verde hasta S13 | Funcionalidad y lógica (30 %) |
| 1:30 a 2:15 | Código: `FB_WheelSorter` (regla), `FB_FeederStation`, el `FOR k := 1 TO 2` de las líneas y la máquina de estados. Mencionar IEC 61131-3, ST, enums estrictos, FB reutilizables | Calidad del código (20 %) |
| 2:15 a 3:15 | **Emergencia**: todo se detiene, MC1/MC2 reciben Stop, torre roja, banner en el tablero. Liberar, Reset, Start. Luego **Stop**: la parada controlada termina lo que está en proceso | Respuesta a alarmas (30 %) |
| 3:15 a 3:45 | Selector en Manual: mover una faja, el sorter y un pusher desde el tablero. Volver a Auto | Manual / automático |
| 3:45 a 4:30 | Tablero: productos/min, conteo de los cuatro productos, **ocupación de MC1 cerca del 100 %** (cuello de botella identificado) y lote de X verdes e Y azules. Gemelo 3D | Optimización (15 %) y HMI (20 %) |
| 4:30 a 5:00 | Cierre: Modbus TCP + OPC UA, repositorio en GitHub con pruebas automáticas y planos | Sustentación (15 %) |

Truco: deja la celda produciendo 2 minutos antes de grabar para que los KPI y la ocupación tengan datos.

## 5.3 La final: "Escena Secreta" de 2 horas

No sabrán la escena hasta ese momento: la ventaja está en **llevar todo listo para combinar**.

**Lleven preparado**

- Laptop con CODESYS, Factory I/O (licencia activa), Node.js y este repositorio clonado.
- Un proyecto CODESYS **plantilla** con todos los bloques de `04_FB` ya compilados: pusher con
  vigilancia, faja por demanda, estación de alimentación, wheel sorter, centro de mecanizado,
  desviador por color, gestor de alarmas y KPI. La máquina de estados con IDLE / AUTO / MANUAL /
  FAULT / EMERGENCY ya resuelta.
- El tablero web: solo hay que editar `hmi/public/js/iomap.js` y `layout.js` con la nueva escena.
- Esta tabla impresa.

**Plan de 2 horas**

| Minuto | Actividad | Responsable sugerido |
|---|---|---|
| 0 a 15 | Recorrer la escena: listar sensores, actuadores y la secuencia. Dibujar el diagrama de estados | Todo el equipo |
| 15 a 30 | Driver de Factory I/O y mapeo en `GVL_IO`. Probar cada E/S forzando valores | Integración |
| 30 a 75 | Lógica automática combinando bloques ya probados. Probar por zonas | PLC |
| 75 a 95 | Emergencia, Reset, vigilancias de tiempo y modo manual (la plantilla ya lo trae) | PLC |
| 95 a 110 | HMI: WebVisu rápida o ajuste de `iomap.js` | HMI |
| 110 a 120 | Prueba completa, guardar versión y preparar una explicación de 2 minutos | Todo el equipo |

Regla de oro: **primero que funcione la secuencia básica con emergencia**, después optimizar.
