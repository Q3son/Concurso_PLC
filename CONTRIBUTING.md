# Cómo colaborar

Gracias por sumarte. Este repositorio es la solución del equipo para el Smart Factory Challenge
(HRFEST 2026); todo lo que entra a `main` es lo que se presenta, así que seguimos unas pocas reglas.

## Puesta en marcha

```bash
git clone https://github.com/TU-USUARIO/smart-factory-challenge.git
cd smart-factory-challenge/hmi
npm install
npm test        # debe terminar en verde
npm run demo    # http://localhost:3000
```

En VS Code: abre la carpeta raíz, acepta las extensiones recomendadas y usa **F5** o
*Terminal > Run Task*.

## Flujo

1. Toma o crea un *issue* (falla, mejora o tarea) y asígnatelo.
2. Crea una rama desde `main`: `feat/…`, `fix/…`, `docs/…`.
3. Haz commits pequeños con prefijo: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
4. Antes de subir: `cd hmi && npm test`.
5. Abre un *pull request* con la plantilla, enlaza el *issue* (`Closes #N`) y pide revisión.
6. Se integra cuando la CI está en verde y un compañero aprobó.

## Reglas que mantienen el proyecto coherente

| Si cambias… | También debes… |
|---|---|
| Lógica de `PLC_PRG` o de un FB (`plc/codesys`) | Replicarla en `hmi/public/js/control.js` y cubrirla con una prueba |
| Una variable de `GVL_IO` | Actualizar `hmi/public/js/iomap.js` y ejecutar `npm run mapa-io` |
| Una variable de `GVL_HMI` o `GVL_Param` | Actualizar `hmi/src/tags.js` y `DEFAULT_PARAM` en `control.js` |
| Una alarma | Actualizar `ALARMS` en `hmi/public/js/constants.js` |
| La posición de un equipo | Actualizar `hmi/public/js/layout.js` y ejecutar `npm run plano` |
| Un diagrama `.mmd` | Ejecutar `npm run diagramas` (o dejar que GitHub lo dibuje) |

La prueba de coherencia (`hmi/tests/consistency.test.js`) detecta la mayoría de estos olvidos.

## Estilo

- **ST**: notación húngara de CODESYS (`x` BOOL, `i` INT, `udi` UDINT, `r` REAL, `t` TIME, `e` enum,
  `a` arreglo, `fb` instancia), enums con `{attribute 'qualified_only'}` y `'strict'`, sin números
  mágicos (todo tiempo o capacidad va a `GVL_Param`), comentarios en español sin tildes (CODESYS
  antiguo no siempre las guarda bien).
- **JavaScript**: módulos ES, sin dependencias en el navegador salvo three.js (copiado en
  `public/vendor` con `npm run vendor`).
- **Documentación**: en español, directa, con tablas cuando se compara.

## Archivos binarios

El `.project` de CODESYS y la escena `.factoryio` no se pueden fusionar. Antes de editarlos,
avisa en el *issue* para que nadie más los toque al mismo tiempo.
