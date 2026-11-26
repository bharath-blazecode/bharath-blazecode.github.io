// Original, procedural desk artwork. Three.js is bundled locally for the site.
import {
  AmbientLight, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group,
  Mesh, MeshLambertMaterial, OrthographicCamera, Plane, Raycaster, Scene, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer
} from 'three';

const TOP = .2; // height of the desk surface

export function createDeskScene(canvas, { onSelect, onHover, onFailure, onReady, onLayout, reducedMotion, pointerEffects }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  const camera = new OrthographicCamera(-3, 3, 2, -2, .1, 50);
  camera.position.set(6, 5.2, 8);
  camera.lookAt(0, .5, 0);
  scene.add(new AmbientLight(0xffffff, 1.35));
  const light = new DirectionalLight(0xffffff, 2.1);
  light.position.set(3, 8, 6);
  scene.add(light);

  const materials = new Map();
  const geometries = [];
  function material(color) {
    if (!materials.has(color)) materials.set(color, new MeshLambertMaterial({ color: new Color(color) }));
    return materials.get(color);
  }
  function mesh(parent, geometry, color, position) {
    geometries.push(geometry);
    const item = new Mesh(geometry, material(color));
    item.position.set(...position);
    parent.add(item);
    return item;
  }
  function box(parent, color, size, position, turn = 0) {
    const item = mesh(parent, new BoxGeometry(...size), color, position);
    item.rotation.y = turn;
    return item;
  }
  function cylinder(parent, color, radius, height, position, sides = 20) {
    return mesh(parent, new CylinderGeometry(radius, radius, height, sides), color, position);
  }
  function sphere(parent, color, radius, position) {
    return mesh(parent, new SphereGeometry(radius, 16, 10), color, position);
  }

  const desk = new Group();
  scene.add(desk);
  const objects = new Map();
  // Each selectable object is a group that sits at its own spot, so it can hop and lift in place.
  function object(key, x, z, anchorHeight, turn = 0) {
    const group = new Group();
    group.position.set(x, 0, z);
    group.rotation.y = turn;
    group.userData = { key, lift: 0, target: 0, hop: 0, anchor: Array.isArray(anchorHeight) ? new Vector3(...anchorHeight) : new Vector3(0, anchorHeight, 0) };
    desk.add(group);
    if (key) objects.set(key, group);
    return group;
  }

  // Desk slab, apron and legs.
  box(desk, '#d8dfcf', [5.6, .2, 3.3], [0, .1, 0]);
  box(desk, '#6a7864', [5.6, .12, 3.3], [0, -.06, 0]);
  for (const [x, z] of [[-2.45, 1.25], [2.45, 1.25], [-2.45, -1.25], [2.45, -1.25]]) box(desk, '#53654f', [.22, 1.1, .22], [x, -.65, z]);

  // Monitor: the home lab. The lines are an illustration, not a live dashboard.
  const monitor = object('homelab', -.35, -.85, 2.5);
  box(monitor, '#101c16', [2.4, 1.5, .15], [0, 1.58, 0]);
  box(monitor, '#2d4335', [2.17, 1.27, .03], [0, 1.58, .095]);
  const rows = [['#b9c8ae', .55, -.66, 2.02], ['#dce64e', .55, -.66, 1.82], ['#789581', .55, -.66, 1.62], ['#8ea992', 1.05, .36, 2.02], ['#8ea992', .76, .22, 1.87], ['#dce64e', .95, .32, 1.62], ['#8ea992', .7, .2, 1.47], ['#8ea992', .9, .3, 1.32], ['#789581', .55, -.66, 1.32]];
  const lines = rows.map(([color, width, x, y]) => box(monitor, color, [width, color === '#dce64e' ? .065 : .04, .025], [x, y, .12]));
  box(monitor, '#65745f', [.18, .56, .2], [0, .55, 0]);
  box(monitor, '#65745f', [.84, .08, .56], [0, TOP + .04, .12]);

  // Keyboard.
  const keyboard = object(null, -.3, .42, .4);
  box(keyboard, '#72816d', [1.84, .08, .54], [0, TOP + .04, 0]);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 9; col++) box(keyboard, '#cbd4c5', [.12, .02, .12], [-.72 + col * .18, TOP + .09, -.09 + row * .17]);

  // Notebook: the research question.
  const notebook = object('research', -1.72, .62, [-.5, .3, .62], -.16);
  box(notebook, '#f2f3ee', [1.2, .12, .88], [0, TOP + .06, 0]);
  box(notebook, '#dce64e', [1.18, .025, .86], [0, TOP + .135, 0]);
  box(notebook, '#54644e', [.08, .03, .84], [-.5, TOP + .16, 0]);
  box(notebook, '#53614e', [.55, .02, .035], [.08, TOP + .16, -.14]);
  box(notebook, '#53614e', [.4, .02, .035], [0, TOP + .16, 0]);
  // A pencil beside it.
  const pencil = object(null, -1.05, 1.22, .3, .5);
  box(pencil, '#dce64e', [.74, .05, .05], [0, TOP + .03, 0]);
  box(pencil, '#53614e', [.1, .05, .05], [.42, TOP + .03, 0]);

  // Game folder: ClassQuest. A folder with a small controller on top.
  const game = object('classquest', 1.3, .78, [-.1, .3, .66], .14);
  box(game, '#92a48d', [1.26, .1, .96], [0, TOP + .05, 0]);
  box(game, '#f2f3ee', [1.1, .05, .82], [0, TOP + .12, -.03]);
  box(game, '#dce64e', [1.2, .035, .9], [0, TOP + .165, .03]);
  box(game, '#aab9a1', [.5, .035, .16], [-.36, TOP + .17, -.46]);
  box(game, '#2d4335', [.62, .09, .36], [.12, TOP + .23, .1]);
  box(game, '#f2f3ee', [.16, .03, .05], [-.06, TOP + .29, .1]);
  box(game, '#f2f3ee', [.05, .03, .16], [-.06, TOP + .29, .1]);
  cylinder(game, '#dce64e', .045, .03, [.26, TOP + .29, .05]);
  cylinder(game, '#b9c8ae', .045, .03, [.34, TOP + .29, .15]);

  // Robot: LUNA. Four yellow wheels, a chassis, a camera mast and two sensor eyes.
  const robot = object('luna', 1.95, -.72, [.3, 1.5, 0], -.5);
  box(robot, '#1c241d', [.9, .22, .62], [0, TOP + .26, 0]);
  box(robot, '#3a4a3c', [.7, .1, .5], [0, TOP + .42, 0]);
  for (const [x, z] of [[-.3, .36], [.3, .36], [-.3, -.36], [.3, -.36]]) {
    const wheel = cylinder(robot, '#dce64e', .17, .12, [x, TOP + .17, z], 14);
    wheel.rotation.x = Math.PI / 2;
    const hub = cylinder(robot, '#1c241d', .08, .13, [x, TOP + .17, z], 10);
    hub.rotation.x = Math.PI / 2;
  }
  const head = new Group();
  head.position.set(.22, 0, 0);
  robot.add(head);
  box(head, '#65745f', [.1, .34, .1], [0, TOP + .64, 0]);
  box(head, '#1c241d', [.3, .2, .26], [.04, TOP + .9, 0]);
  const lens = cylinder(head, '#b9c8ae', .07, .06, [.2, TOP + .9, 0], 14);
  lens.rotation.z = Math.PI / 2;
  for (const z of [-.12, .12]) { const eye = cylinder(robot, '#f2f3ee', .07, .06, [.47, TOP + .36, z], 14); eye.rotation.z = Math.PI / 2; }

  // A mug and a chess pawn, for the person at the desk.
  const mug = object(null, 2.2, .45, .6);
  cylinder(mug, '#f2f3ee', .17, .34, [0, TOP + .17, 0]);
  cylinder(mug, '#3a4a3c', .14, .02, [0, TOP + .345, 0]);
  box(mug, '#f2f3ee', [.06, .2, .16], [.2, TOP + .18, 0]);
  const pawn = object(null, -2.3, -.55, .7);
  cylinder(pawn, '#3a4a3c', .17, .08, [0, TOP + .04, 0]);
  cylinder(pawn, '#3a4a3c', .09, .26, [0, TOP + .2, 0]);
  sphere(pawn, '#3a4a3c', .12, [0, TOP + .42, 0]);

  // A drop of highlighter ink. It rests by the notebook and follows a mouse across the desk.
  const ink = new Group();
  desk.add(ink);
  const blobs = [[.2, .34], [.12, .2], [.1, .13], [.075, .09], [.06, .06]].map(([radius, pull], index) => {
    const item = sphere(ink, '#e4ee55', radius, [0, 0, 0]);
    item.scale.y = .32;
    item.userData = { pull, x: -1.02 + index * .07, z: 1.02 - index * .05 };
    item.position.set(item.userData.x, TOP + radius * .28, item.userData.z);
    return item;
  });
  const inkTarget = { x: blobs[0].userData.x, z: blobs[0].userData.z, active: false };

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const surface = new Plane(new Vector3(0, 1, 0), -TOP);
  const point = new Vector3();
  const projected = new Vector3();
  let visible = false;
  let reduced = reducedMotion;
  let frame = 0;
  let wakeStart = null;
  let woke = false;
  let targetX = 0;
  let targetY = 0;
  let hover = null;
  let held = null;
  let down = null;
  let ready = false;
  let layoutDirty = true;
  let beatStart = 0;
  let beatTimer = 0;
  let width = 1;
  let height = 1;

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const vertical = Math.max(4.9, 8.2 / aspect);
    camera.left = -vertical * aspect / 2;
    camera.right = vertical * aspect / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    layoutDirty = true;
    requestRender();
  }
  function requestRender() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  function layout() {
    if (!onLayout) return;
    const anchors = {};
    for (const [key, group] of objects) {
      projected.copy(group.userData.anchor).applyMatrix4(group.matrixWorld).project(camera);
      anchors[key] = [(projected.x + 1) / 2 * width, (1 - projected.y) / 2 * height];
    }
    onLayout(anchors);
  }
  function render(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    let moving = false;

    // First appearance: each object hops once, left to right. The scene starts in its resting pose so it lines up with the still image.
    const wake = reduced || wakeStart === null ? 1 : Math.min(1, (now - wakeStart) / 1500);
    if (wake < 1) moving = true;
    let order = 0;
    for (const group of desk.children) {
      const data = group.userData;
      if (!data || data.anchor === undefined) continue;
      const local = Math.min(1, Math.max(0, wake * 2.6 - order * .22));
      data.hop = wake < 1 ? Math.sin(local * Math.PI) * .16 : 0;
      order++;
      const goal = data.key && (data.key === hover || data.key === held) ? .14 : 0;
      if (reduced) data.lift = goal; else data.lift += (goal - data.lift) * .2;
      if (Math.abs(goal - data.lift) > .002) moving = true;
      group.position.y = data.lift + data.hop;
    }

    const wantX = reduced ? 0 : targetX;
    const wantY = reduced ? 0 : targetY;
    if (reduced) { desk.rotation.x = 0; desk.rotation.y = 0; }
    else {
      desk.rotation.x += (wantX - desk.rotation.x) * .12;
      desk.rotation.y += (wantY - desk.rotation.y) * .12;
      if (Math.abs(wantX - desk.rotation.x) > .0008 || Math.abs(wantY - desk.rotation.y) > .0008) { moving = true; layoutDirty = true; }
    }

    // Ink: the big drop leads and the small ones lag, so a fast move pulls it apart and a pause lets it pool again.
    for (const blob of blobs) {
      const data = blob.userData;
      const dx = inkTarget.x - data.x;
      const dz = inkTarget.z - data.z;
      if (reduced) continue;
      data.x += dx * data.pull;
      data.z += dz * data.pull;
      blob.position.x = data.x;
      blob.position.z = data.z;
      if (Math.abs(dx) > .004 || Math.abs(dz) > .004) moving = true;
    }

    // Every few seconds the robot looks around and a line on the monitor is rewritten.
    if (beatStart) {
      const beat = Math.min(1, (now - beatStart) / 1900);
      head.rotation.y = Math.sin(beat * Math.PI * 2) * .6;
      lines[5].scale.x = .45 + .55 * Math.abs(Math.cos(beat * Math.PI));
      lines[7].scale.x = .6 + .4 * Math.abs(Math.cos(beat * Math.PI * 1.5));
      if (beat < 1) moving = true;
      else { beatStart = 0; head.rotation.y = 0; lines[5].scale.x = 1; lines[7].scale.x = 1; }
    }

    desk.updateMatrixWorld();
    renderer.render(scene, camera);
    if (layoutDirty || moving) { layout(); layoutDirty = false; }
    if (!ready) { ready = true; onReady(); }
    if (moving) requestRender();
  }

  function aim(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return true;
  }
  function hit() {
    for (const intersection of raycaster.intersectObjects(desk.children, true)) {
      let item = intersection.object;
      if (item.parent === ink) continue;
      while (item && item !== desk) {
        if (item.userData && item.userData.key) return item.userData.key;
        item = item.parent;
      }
      return null; // The desk or a plain object is in front.
    }
    return null;
  }
  function move(event) {
    if (!aim(event)) return;
    const next = hit();
    if (next !== hover) {
      hover = next;
      canvas.style.cursor = hover ? 'pointer' : '';
      onHover(hover);
    }
    if (!reduced && pointerEffects && event.pointerType === 'mouse') {
      targetY = pointer.x * .1;
      targetX = -pointer.y * .05;
      if (raycaster.ray.intersectPlane(surface, point)) {
        desk.worldToLocal(point);
        inkTarget.x = Math.max(-2.4, Math.min(2.4, point.x));
        inkTarget.z = Math.max(-1.3, Math.min(1.3, point.z));
      }
    }
    requestRender();
  }
  function leave() {
    hover = null;
    targetX = 0;
    targetY = 0;
    canvas.style.cursor = '';
    onHover(null);
    requestRender();
  }
  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function pointerUp(event) {
    if (!down || event.pointerId !== down.id || event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10) { down = null; return; }
    down = null;
    if (!aim(event)) return;
    const key = hit();
    if (key) onSelect(key, event);
  }
  function pointerCancel() { down = null; }
  function contextLost(event) { event.preventDefault(); onFailure(); }
  canvas.addEventListener('pointermove', move, { passive: true });
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointerdown', pointerDown, { passive: true });
  canvas.addEventListener('pointerup', pointerUp, { passive: true });
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('webglcontextlost', contextLost);
  const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(canvas);
  else window.addEventListener('resize', resize);
  resize();
  // Compile and draw the resting pose straight away, so nothing is left to do when the desk scrolls into view.
  desk.updateMatrixWorld();
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  layout();
  layoutDirty = false;
  ready = true;
  onReady();

  function scheduleBeat() {
    clearTimeout(beatTimer);
    if (!visible || reduced || document.hidden) return;
    beatTimer = setTimeout(() => { beatStart = performance.now(); requestRender(); scheduleBeat(); }, 5200);
  }

  return {
    setVisible(value) {
      visible = value;
      scheduleBeat();
      if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
      if (visible) {
        if (!woke && !reduced) { wakeStart = performance.now(); woke = true; }
        requestRender();
      }
    },
    setReduced(value) {
      reduced = value;
      if (value) { targetX = 0; targetY = 0; wakeStart = null; beatStart = 0; head.rotation.y = 0; lines[5].scale.x = 1; lines[7].scale.x = 1; }
      scheduleBeat();
      layoutDirty = true;
      requestRender();
    },
    // Lift an object from outside the canvas, for example when its project card has focus.
    highlight(key) {
      held = key;
      requestRender();
    },
    // Draw one frame in the resting pose and return it as an image. Used to make the still image.
    capture(type = 'image/webp', quality = .9) {
      desk.rotation.set(0, 0, 0);
      for (const group of desk.children) if (group.userData && group.userData.anchor) group.position.y = 0;
      desk.updateMatrixWorld();
      renderer.render(scene, camera);
      return canvas.toDataURL(type, quality);
    },
    dispose() {
      visible = false;
      clearTimeout(beatTimer);
      if (frame) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerCancel);
      canvas.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(item => item.dispose());
      renderer.dispose();
    }
  };
}
