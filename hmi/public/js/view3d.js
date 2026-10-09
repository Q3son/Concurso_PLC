// =====================================================================
// Gemelo digital 3D (three.js) construido desde layout.js.
// Modelo base de visualización: fajas, pushers, wheel sorter, centros de mecanizado con robot,
// sensores con LED, torre de luces y piezas (crudo, tapa y base) en sus colores.
// Con el PLC real no hay posiciones de piezas: se animan actuadores y sensores.
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  BELTS, beltLength, beltDir, pointOn, SORTER, MACHINES, PUSHERS, SENSORS, EMITTERS, REMOVERS, PANEL,
  BELT_WIDTH, BELT_SPEED,
} from './layout.js';
import { partWorld } from './view2d.js';

const TOP = 0.86;                     // altura de la superficie de las fajas (m)
const COLORS = {
  floor: 0xb9bec2, frame: 0x6b747c, belt: 0x2f3439, pusher: 0xc0322b, steel: 0xa9b0b6,
  machine: 0xe9ecee, machineDark: 0x3a4148, robot: 0xe8862a, G: 0x3d8a55, B: 0x2f63b0, M: 0x9aa3ab,
  sensor: 0x2b3036, ledOff: 0x4a5056, ledOn: 0xffd23a, emitter: 0x5aa0e6, remover: 0x30363c,
};

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3035'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#3a4046';
  for (let i = 0; i < 64; i += 16) g.fillRect(i, 0, 6, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function label(text, cls = 'l3d') {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  return new CSS2DObject(d);
}

export class View3D {
  constructor(container) {
    this.el = container;
    this.ok = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      container.innerHTML = '<p class="hint pad">Tu navegador no soporta WebGL: usa la vista 2D.</p>';
      return;
    }
    this.ok = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.el.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels3d';
    this.el.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd3d7da);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(3.2, 14.5, 15.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(5.8, 0.4, 0.2);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 45;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-6, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 50 });
    sun.target.position.set(5.6, 0, 0);
    this.scene.add(sun, sun.target);

    this.mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
    this.belts = {}; this.pushers = {}; this.sensors = {}; this.leds = {}; this.machines = {}; this.lamps = {};
    this.partMeshes = new Map();
    this.partGeo = {
      raw: new THREE.BoxGeometry(0.36, 0.3, 0.36),
      lid: new THREE.CylinderGeometry(0.2, 0.2, 0.1, 28),
      base: new THREE.CylinderGeometry(0.2, 0.2, 0.22, 28),
    };
    this.partMat = { G: this.mat(COLORS.G), B: this.mat(COLORS.B), M: this.mat(COLORS.M, { metalness: 0.7, roughness: 0.3 }) };

    this.build();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.clock = new THREE.Clock();
    this.snap = null;
    this.visible = false;
    const loop = () => { requestAnimationFrame(loop); if (this.visible) this.frame(); };
    loop();
  }

  setVisible(v) { this.visible = v; if (v) this.resize(); }
  showLabels(v) { this.labels.domElement.style.display = v ? '' : 'none'; }

  resize() {
    if (!this.ok) return;
    const w = this.el.clientWidth || 800, h = this.el.clientHeight || 520;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  box(w, h, d, color, x, y, z, parent = this.scene, extra) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? this.mat(color, extra) : color);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  build() {
    const S = this.scene;
    // Piso
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), this.mat(COLORS.floor, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(5.6, 0, 0); floor.receiveShadow = true;
    S.add(floor);
    const grid = new THREE.GridHelper(26, 26, 0x9aa1a7, 0xa9afb4);
    grid.position.set(5.6, 0.002, 0);
    S.add(grid);

    // Fajas
    for (const [id, b] of Object.entries(BELTS)) {
      const L = beltLength(b), [dx, dz] = beltDir(b);
      const g = new THREE.Group();
      const [mx, mz] = pointOn(b, L / 2);
      g.position.set(mx, 0, mz);
      g.rotation.y = -Math.atan2(dz, dx);
      const tex = stripeTexture();
      tex.repeat.set(L / 0.5, 1);
      const surf = this.box(L, 0.08, BELT_WIDTH, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, TOP - 0.04, 0, g);
      this.box(L, 0.14, 0.06, COLORS.frame, 0, TOP - 0.06, BELT_WIDTH / 2 + 0.03, g);
      this.box(L, 0.14, 0.06, COLORS.frame, 0, TOP - 0.06, -BELT_WIDTH / 2 - 0.03, g);
      for (let s = -L / 2 + 0.3; s <= L / 2 - 0.2; s += Math.max(1.4, L / 5)) {
        this.box(0.06, TOP - 0.1, 0.06, COLORS.frame, s, (TOP - 0.1) / 2, BELT_WIDTH / 2, g);
        this.box(0.06, TOP - 0.1, 0.06, COLORS.frame, s, (TOP - 0.1) / 2, -BELT_WIDTH / 2, g);
      }
      const lab = label(id, 'l3d tag3d');
      lab.position.set(0, TOP + 0.35, BELT_WIDTH / 2 + 0.25);
      g.add(lab);
      S.add(g);
      this.belts[id] = { tex, L, surf };
    }

    // Wheel sorter
    const [scx, scz] = SORTER.center;
    const ws = new THREE.Group();
    ws.position.set(scx, 0, scz);
    this.box(SORTER.size, TOP - 0.06, SORTER.size, COLORS.machineDark, 0, (TOP - 0.06) / 2, 0, ws);
    this.wheels = new THREE.Group();
    for (const ix of [-0.28, 0, 0.28]) for (const iz of [-0.28, 0, 0.28]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), this.mat(0x9fa6ad, { metalness: 0.5 }));
      w.rotation.z = Math.PI / 2;
      w.position.set(ix, 0, iz);
      this.wheels.add(w);
    }
    this.wheels.position.y = TOP - 0.05;
    ws.add(this.wheels);
    const wl = label('WS1', 'l3d tag3d'); wl.position.set(0.7, TOP + 0.4, 0); ws.add(wl);
    S.add(ws);

    // Centros de mecanizado con robot
    for (const [id, mc] of Object.entries(MACHINES)) {
      const [x1, z1, x2, z2] = mc.rect;
      const g = new THREE.Group();
      g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      const w = x2 - x1, d = z2 - z1;
      this.box(w, 0.12, d, COLORS.machineDark, 0, 0.06, 0, g);
      const cnc = this.box(w * 0.42, 2.0, d * 0.9, COLORS.machine, w * 0.24, 1.0, 0, g);
      this.box(w * 0.3, 0.9, 0.02, this.mat(0x7fb3d6, { transparent: true, opacity: 0.45 }), w * 0.2, 1.15, (mc.lids ? 1 : -1) * d * 0.45 + (mc.lids ? 0.01 : -0.01), g);
      void cnc;
      // Robot: base, brazo y antebrazo
      const robot = new THREE.Group();
      robot.position.set(-w * 0.22, 0.12, 0);
      this.box(0.5, 0.5, 0.5, COLORS.robot, 0, 0.25, 0, robot);
      const shoulder = new THREE.Group(); shoulder.position.y = 0.55; robot.add(shoulder);
      this.box(0.22, 1.1, 0.22, COLORS.robot, 0, 0.5, 0, shoulder);
      const elbow = new THREE.Group(); elbow.position.y = 1.05; shoulder.add(elbow);
      this.box(0.9, 0.18, 0.18, COLORS.robot, 0.42, 0, 0, elbow);
      g.add(robot);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), this.mat(COLORS.ledOff, { emissive: 0x000000 }));
      light.position.set(w * 0.24, 2.12, 0);
      g.add(light);
      const lab = label(`${id} · ${mc.lids ? 'tapas' : 'bases'}`, 'l3d mc3d');
      lab.position.set(0, 2.5, 0);
      g.add(lab);
      S.add(g);
      this.machines[id] = { robot, shoulder, elbow, light, lab, group: g, partPos: new THREE.Vector3(w * 0.24, 1.1, 0).add(g.position) };
    }

    // Pushers (cuerpo rojo, vástago y placa)
    for (const [id, p] of Object.entries(PUSHERS)) {
      const [bx, bz] = p.body, [dx, dz] = p.dir;
      const g = new THREE.Group();
      g.position.set(bx, 0, bz);
      g.rotation.y = -Math.atan2(dz, dx);       // eje local +x = sentido del empuje
      this.box(0.5, 0.32, 0.55, COLORS.pusher, -0.12, TOP + 0.1, 0, g);
      this.box(0.08, TOP - 0.05, 0.08, COLORS.frame, -0.12, (TOP - 0.05) / 2, 0, g);
      const move = new THREE.Group(); g.add(move);
      const rod = this.box(0.6, 0.06, 0.06, COLORS.steel, -0.1, TOP + 0.1, 0, move, { metalness: 0.8, roughness: 0.3 });
      this.box(0.05, 0.26, 0.6, COLORS.steel, 0.2, TOP + 0.1, 0, move, { metalness: 0.6 });
      void rod;
      const lab = label(id, 'l3d tag3d'); lab.position.set(-0.2, TOP + 0.55, 0); g.add(lab);
      S.add(g);
      this.pushers[id] = move;
    }

    // Sensores: poste + cabeza + LED. Visión: brazo sobre la faja.
    for (const s of SENSORS) {
      let x, z, side = [0, 0.48];
      if (s.belt === 'WS') { [x, z] = SORTER.center; side = [0.62, 0]; }
      else {
        [x, z] = pointOn(BELTS[s.belt], s.s);
        const [dx] = beltDir(BELTS[s.belt]);
        side = Math.abs(dx) > 0.5 ? [0, (z <= 0 ? -1 : 1) * 0.48] : [0.48, 0];
      }
      if (s.code === 'S6.1') { x -= 0.12; } else if (s.code === 'S6.2') { x += 0.12; }
      const g = new THREE.Group();
      g.position.set(x + side[0], 0, z + side[1]);
      if (s.type === 'vision') {
        this.box(0.05, TOP + 0.75, 0.05, COLORS.frame, 0, (TOP + 0.75) / 2, 0, g);
        this.box(Math.abs(side[0]) > 0 ? 0.5 : 0.06, 0.05, Math.abs(side[1]) > 0 ? 0.5 : 0.06, COLORS.frame,
          -side[0] / 2, TOP + 0.75, -side[1] / 2, g);
        this.box(0.16, 0.12, 0.16, COLORS.sensor, -side[0], TOP + 0.66, -side[1], g);
      } else {
        this.box(0.05, TOP + 0.05, 0.05, COLORS.frame, 0, (TOP + 0.05) / 2, 0, g);
        this.box(0.1, 0.1, 0.1, s.type === 'capacitive' ? 0x406a4f : COLORS.sensor, 0, TOP + 0.08, 0, g);
      }
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), this.mat(COLORS.ledOff));
      led.position.set(s.type === 'vision' ? -side[0] : 0, s.type === 'vision' ? TOP + 0.76 : TOP + 0.17, s.type === 'vision' ? -side[1] : 0);
      g.add(led);
      const lab = label(s.code, 'l3d sen3d'); lab.position.set(0, TOP + (s.type === 'vision' ? 1.0 : 0.4), 0); g.add(lab);
      S.add(g);
      this.leds[s.key] = led;
    }

    // Emisores y removedores
    for (const [id, e] of Object.entries(EMITTERS)) {
      const [x, z] = pointOn(BELTS[e.belt], e.s);
      const m = this.box(0.7, 0.7, 0.75, this.mat(COLORS.emitter, { transparent: true, opacity: 0.22 }), x, TOP + 0.35, z);
      m.castShadow = false;
      const lab = label(id, 'l3d tag3d'); lab.position.set(x, TOP + 0.95, z); this.scene.add(lab);
      this.sensors[id] = m;
    }
    for (const r of Object.values(REMOVERS)) {
      const b = BELTS[r.belt];
      const [x, z] = pointOn(b, beltLength(b) + 0.25);
      this.box(0.55, TOP, 0.75, COLORS.remover, x, TOP / 2, z);
    }

    // Panel y torre de luces
    const [px, pz] = PANEL.at;
    this.box(1.2, 1.3, 0.4, 0x50585f, px, 0.65, pz);
    const [tx, tz] = PANEL.tower;
    this.box(0.06, 1.9, 0.06, COLORS.frame, tx, 0.95, tz);
    [['lampRed', 0xd0312d, 2.2], ['lampYellow', 0xe2a70f, 2.02], ['lampGreen', 0x2ea05a, 1.84]].forEach(([id, c, y]) => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 20), this.mat(c, { transparent: true, opacity: 0.55, emissive: 0x000000 }));
      lamp.position.set(tx, y, tz);
      this.scene.add(lamp);
      this.lamps[id] = { mesh: lamp, color: c };
    });
  }

  update(snap) { this.snap = snap; }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const snap = this.snap;
    if (snap) {
      const O = snap.outputs || {}, I = snap.inputs || {};
      for (const [id, b] of Object.entries(this.belts)) {
        if (O[id.toLowerCase()]) b.tex.offset.x -= (BELT_SPEED * dt) / 0.5;
      }
      for (const [id, move] of Object.entries(this.pushers)) {
        const k = id.toLowerCase();
        const pos = snap.pushers?.[id] ?? (I[`${k}Front`] ? 1 : O[k] ? 0.5 : 0);
        move.position.x = pos * 0.85;
      }
      for (const s of SENSORS) {
        const on = !!I[s.key];
        const m = this.leds[s.key].material;
        m.color.setHex(on ? COLORS.ledOn : COLORS.ledOff);
        m.emissive.setHex(on ? 0xffb000 : 0x000000);
      }
      for (const id of Object.keys(EMITTERS)) this.sensors[id].material.opacity = O[id.toLowerCase()] ? 0.42 : 0.14;
      // Sorter: ruedas elevadas y giradas hacia la rama
      this.wheels.position.y = TOP - (O.wsPlus ? 0.0 : 0.06);
      const target = O.wsLeft ? Math.PI / 4 : O.wsRight ? -Math.PI / 4 : 0;
      this.wheels.rotation.y += (target - this.wheels.rotation.y) * Math.min(1, dt * 8);
      // Máquinas
      for (const [id, M] of Object.entries(this.machines)) {
        const k = id.toLowerCase();
        const st = snap.machines?.[id]?.state ?? (I[`${k}Busy`] ? 'machining' : 'idle');
        const err = I[`${k}Error`] || I[`${k}Opened`];
        const tgt = st === 'loading' ? 1.2 : st === 'unloading' ? -1.2 : 0;
        M.shoulder.rotation.y += (tgt - M.shoulder.rotation.y) * Math.min(1, dt * 3);
        const reach = st === 'machining' ? -0.2 : 0.35;
        M.elbow.rotation.z += (reach - M.elbow.rotation.z) * Math.min(1, dt * 3);
        const lm = M.light.material;
        const c = err ? 0xd0312d : I[`${k}Busy`] ? 0x2ea05a : O[`${k}Start`] ? 0xe2a70f : COLORS.ledOff;
        lm.color.setHex(c); lm.emissive.setHex(c === COLORS.ledOff ? 0 : c);
        lm.emissiveIntensity = 0.7;
        const prog = Math.round(I[`${k}Progress`] ?? 0);
        M.lab.element.textContent = `${id} · ${id === 'MC1' ? 'tapas' : 'bases'}${err ? ' · ERROR' : I[`${k}Busy`] ? ` · ${prog} %` : ''}`;
      }
      for (const [id, L] of Object.entries(this.lamps)) {
        const on = !!O[id];
        L.mesh.material.opacity = on ? 1 : 0.45;
        L.mesh.material.emissive.setHex(on ? L.color : 0);
      }
      this.syncParts(snap);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  syncParts(snap) {
    const seen = new Set();
    for (const p of snap.parts || []) {
      seen.add(p.id);
      let mesh = this.partMeshes.get(p.id);
      const key = `${p.kind}-${p.color}`;
      if (mesh && mesh.userData.key !== key) { this.scene.remove(mesh); mesh = null; }
      if (!mesh) {
        mesh = new THREE.Mesh(this.partGeo[p.kind] || this.partGeo.raw, this.partMat[p.color] || this.partMat.M);
        mesh.castShadow = true;
        mesh.userData.key = key;
        this.scene.add(mesh);
        this.partMeshes.set(p.id, mesh);
      }
      const h = p.kind === 'raw' ? 0.3 : p.kind === 'lid' ? 0.1 : 0.22;
      if (MACHINES[p.lane]) {
        const pp = this.machines[p.lane].partPos;
        mesh.position.set(pp.x, pp.y, pp.z);
      } else {
        const w = partWorld(p, snap);
        if (!w) continue;
        mesh.position.set(w[0], TOP + h / 2 + 0.005, w[1]);
      }
    }
    for (const [id, mesh] of this.partMeshes) {
      if (!seen.has(id)) { this.scene.remove(mesh); this.partMeshes.delete(id); }
    }
  }

  resetView() {
    this.camera.position.set(3.2, 14.5, 15.5);
    this.controls.target.set(5.8, 0.4, 0.2);
  }
}
