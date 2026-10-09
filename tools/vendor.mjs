// Copia three.js (y los addons que usa la vista 3D) a hmi/public/vendor para que el tablero
// funcione sin internet y en GitHub Pages. Uso: cd hmi && npm run vendor
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'hmi/node_modules/three');
const dst = path.join(root, 'hmi/public/vendor/three');
rmSync(dst, { recursive: true, force: true });
mkdirSync(path.join(dst, 'addons/controls'), { recursive: true });
mkdirSync(path.join(dst, 'addons/renderers'), { recursive: true });
cpSync(path.join(src, 'build/three.module.min.js'), path.join(dst, 'three.module.min.js'));
cpSync(path.join(src, 'examples/jsm/controls/OrbitControls.js'), path.join(dst, 'addons/controls/OrbitControls.js'));
cpSync(path.join(src, 'examples/jsm/renderers/CSS2DRenderer.js'), path.join(dst, 'addons/renderers/CSS2DRenderer.js'));
cpSync(path.join(src, 'LICENSE'), path.join(dst, 'LICENSE'));
console.log('three.js copiado en hmi/public/vendor/three');
