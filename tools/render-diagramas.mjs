// Regenera las imágenes de los diagramas Mermaid (docs/diagramas/*.mmd -> docs/img/diagrama-*.svg/.png)
// usando mermaid-cli. Requiere internet la primera vez (npx descarga la herramienta y un navegador).
// GitHub ya dibuja los bloques ```mermaid``` de los .md: las imágenes son para presentaciones y el video.
// Uso: cd hmi && npm run diagramas
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'docs/diagramas');
const out = path.join(root, 'docs/img');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const f of readdirSync(src).filter((x) => x.endsWith('.mmd'))) {
  const base = path.join(out, `diagrama-${f.replace('.mmd', '')}`);
  for (const ext of ['svg', 'png']) {
    execFileSync(npx, ['-y', '@mermaid-js/mermaid-cli@11.4.0', '-i', path.join(src, f), '-o', `${base}.${ext}`,
      '-b', 'white', '-t', 'neutral', ...(ext === 'png' ? ['-s', '2'] : [])], { stdio: 'inherit', shell: process.platform === 'win32' });
  }
  console.log('ok', f);
}
