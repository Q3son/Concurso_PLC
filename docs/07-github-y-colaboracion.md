# 7. GitHub y trabajo en equipo

## 7.1 Preparación (una vez por integrante)

1. Instala **Git** (<https://git-scm.com/download/win>), **Node.js 20 LTS** (<https://nodejs.org>) y **VS Code**.
2. Configura tu identidad (en VS Code: *Terminal > New Terminal*):

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true      # solo en Windows
```

## 7.2 Crear el repositorio (lo hace una sola persona)

1. Entra a <https://github.com/new>. Nombre: `Concurso_PLC`.
   Si el equipo tiene una organización en GitHub (por ejemplo la del capítulo estudiantil), créalo ahí.
2. Descripción: *Celda de manufactura con CODESYS, Factory I/O, Modbus TCP, OPC UA y HMI web con gemelo digital. HRFEST 2026.*
3. Público. **No** marques README, .gitignore ni licencia (ya vienen en el proyecto).
4. Desde la carpeta del proyecto descomprimido:

```bash
cd Concurso_PLC
git init
git add .
git commit -m "feat: celda de tapas y bases con segregación por color (rev. C)"
git branch -M main
git remote add origin https://github.com/Q3son/Concurso_PLC.git
git push -u origin main
```

5. Reemplaza `Q3son` en `README.md` (insignias y enlaces) y en `.github/CODEOWNERS`.

## 7.3 Agregar a los colaboradores

1. **Settings > Collaborators > Add people** (en una organización: *Settings > Collaborators and teams*).
2. Escribe el usuario de GitHub de cada integrante y dale rol **Write**. A quien coordina, **Maintain** o **Admin**.
3. Cada integrante acepta la invitación desde su correo y clona el repositorio:

```bash
git clone https://github.com/Q3son/Concurso_PLC.git
cd Concurso_PLC/hmi
npm install
npm test
```

## 7.4 Proteger la rama `main`

*Settings > Branches > Add branch ruleset* (o *Add rule*) para `main`:

- **Require a pull request before merging**, con **1 aprobación**.
- **Require status checks to pass**: marca *Pruebas de lógica y HMI* (el trabajo de `ci.yml`).
- **Block force pushes**.

Así nadie rompe la versión que se presenta: todo cambio entra por *pull request*, con las pruebas
en verde y la revisión de un compañero.

## 7.5 Flujo de trabajo diario

```bash
git switch main && git pull                  # partir de lo último
git switch -c feat/alarma-puerta-mc          # una rama por tarea
# ... cambios ...
cd hmi && npm test                           # antes de subir
git add . && git commit -m "feat: alarma de puerta abierta en MC1 y MC2"
git push -u origin feat/alarma-puerta-mc
```

Luego en GitHub: **Compare & pull request**, completa la plantilla y pide revisión.
En VS Code puedes hacer todo esto desde la pestaña *Source Control* y la extensión *GitHub Pull Requests*.

| Prefijo de rama / commit | Uso |
|---|---|
| `feat:` | Función nueva (lógica, pantalla, alarma) |
| `fix:` | Corrección |
| `docs:` | Documentación, planos o diagramas |
| `test:` | Pruebas |
| `refactor:` | Reorganizar sin cambiar comportamiento |
| `chore:` | Configuración, dependencias |

## 7.6 Organización del equipo

| Área | Carpetas | Responsable |
|---|---|---|
| PLC (lógica IEC 61131-3) | `plc/codesys/` | *(nombre)* |
| Escena Factory I/O e integración Modbus | `factoryio/`, `docs/02-mapa-io.md`, `docs/03-*` | *(nombre)* |
| HMI y gemelo digital | `hmi/` | *(nombre)* |
| Documentación, planos y video | `docs/`, `README.md` | *(nombre)* |

Escribe los usuarios en [`.github/CODEOWNERS`](../.github/CODEOWNERS): GitHub pedirá
automáticamente la revisión del responsable de cada carpeta.

**Issues y tablero.** Usa las plantillas de *Issues* (falla, mejora, tarea) y crea un *Project*
(*Projects > New project > Board*) con columnas *Por hacer / En curso / En revisión / Listo*.
Cada *pull request* debe cerrar un *issue* (`Closes #12` en la descripción).

## 7.7 Reglas para que el repositorio no se rompa

- **Si cambias una variable en CODESYS**, actualiza el `.st` del repositorio y, si es una E/S,
  `hmi/public/js/iomap.js`. Después ejecuta `npm run mapa-io` y `npm test`: la prueba de
  coherencia te dirá qué falta.
- **Si cambias la lógica de `PLC_PRG` o de un FB**, replica el cambio en `hmi/public/js/control.js`
  (el espejo) y agrega o ajusta una prueba en `hmi/tests/simulator.test.js`.
- **Si mueves equipos en la escena**, actualiza `hmi/public/js/layout.js` y regenera el plano
  con `npm run plano`.
- Guarda el `.project` de CODESYS y la escena `.factoryio` en sus carpetas. Son binarios: no
  los editen dos personas a la vez (avisen en el *issue*).

## 7.8 Demo en vivo (GitHub Pages)

1. **Settings > Pages**, *Source*: **GitHub Actions**.
2. En **Actions**, abre "Demo en GitHub Pages" y pulsa **Run workflow** (o haz un push a `main`).
3. En uno o dos minutos la demo queda en `https://q3son.github.io/Concurso_PLC/`.

## 7.9 Detalles que se notan

- **About** (engranaje junto a la descripción): pega la URL de la demo y agrega *topics*:
  `plc`, `codesys`, `factory-io`, `iec-61131-3`, `structured-text`, `modbus-tcp`, `opc-ua`,
  `scada`, `hmi`, `digital-twin`, `industrial-automation`.
- **Releases > Create a new release**: etiqueta `v3.0.0`, título *Versión para clasificación*,
  y adjunta el `.project` y la escena `.factoryio`.
- Sube capturas reales (CODESYS en línea y Factory I/O) a `docs/img/` y el enlace del video al README.
