// Genera docs/02-mapa-io.md desde hmi/public/js/iomap.js (fuente única del mapa de E/S).
// Uso: cd hmi && npm run mapa-io
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DI, AI, DO, AO, IO_SUMMARY } from '../hmi/public/js/iomap.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZONE = { 1: 'Alimentación', 2: 'Identificación', 3: 'Mecanizado', 4: 'Segregación' };
const table = (rows, head) => [
  `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
  ...rows.map((d) => `| ${d.addr} | ${d.code} | \`${d.plc}\` | ${d.fio} | ${d.label} | ${d.zone ? ZONE[d.zone] : 'Panel'} |`),
].join('\n');
const H = ['Dir.', 'Código', 'Variable `GVL_IO`', 'Tag en Factory I/O', 'Función', 'Zona'];

const md = `# 2. Mapa de entradas y salidas

> Archivo generado con \`npm run mapa-io\` desde [\`hmi/public/js/iomap.js\`](../hmi/public/js/iomap.js).
> \`npm test\` verifica que coincide, variable por variable y en el mismo orden, con
> [\`GVL_IO.st\`](../plc/codesys/02_GVL/GVL_IO.st). No lo edites a mano.

Todas las señales llegan al **mismo PLC**. Los códigos (S5, M3, Y02…) son los del
[plano de distribución](img/plano-celda.png) y del [plano de hardware](img/plano-hardware.png).
Las direcciones son las del dispositivo **Modbus TCP Slave Device** de CODESYS
([04-codesys.md](04-codesys.md)): Factory I/O **escribe** los sensores en *Coils* y *Holding Registers*
y **lee** los actuadores en *Discrete Inputs* e *Input Registers*.

## Entradas digitales: ${DI.length} (Coils 0 a ${DI.length - 1})

${table(DI, H)}

## Entradas de registro: ${AI.length} (Holding Registers)

${table(AI, H)}

## Salidas digitales: ${DO.length} (Discrete Inputs 0 a ${DO.length - 1})

${table(DO, H)}

## Salida de registro: ${AO.length} (Input Register)

${table(AO, H)}

## Resumen frente a las bases

| | Mínimo exigido | Esta celda |
|---|---|---|
| Sensores | 6 | **${IO_SUMMARY.processSensors} de proceso**: 14 de presencia/visión/conteo (S2, S4, S5, S6.1, S6.2, S7 a S15), 8 finales de carrera (LS1 a LS8) y 6 estados de máquina; más 6 del panel |
| Actuadores | 4 | **${IO_SUMMARY.processActuators} de proceso**: 2 emisores, 9 fajas, 4 pushers, wheel sorter (3 señales) y 2 centros de mecanizado (4 señales cada uno); más 6 lámparas y el display |
| PLC | 1 | **1 solo PLC** para toda la celda |

## Correcciones aplicadas al mapa

| Antes (Rev. B) | Ahora (Rev. C) | Motivo |
|---|---|---|
| S1 y S3: inicio de cada alimentador | **Eliminados** | Observación: no son necesarios. El emisor de Factory I/O no emite si su volumen está ocupado, así que basta con S2/S4 |
| S2 y S4: fin del alimentador | **Pieza lista para empujar** con Y01 / Y02 | Observación |
| S5: zona de unión | **Pieza cayó en la faja principal** (confirma cada empuje) | Observación |
| S6: visión numérica (0..9) | **S6.1 y S6.2**: visión digital crudo verde / crudo azul | Observación |
| Pushers A, B, C y salida 4 de rechazo | **Wheel sorter WS1** + 2 centros de mecanizado + segregación por color | Observación: nuevo proceso de tapas y bases |
`;
writeFileSync(path.join(root, 'docs/02-mapa-io.md'), md);
console.log('docs/02-mapa-io.md generado');
