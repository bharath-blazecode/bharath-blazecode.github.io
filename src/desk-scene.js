// Original, procedural desk artwork. Three.js is bundled locally for the site.
import {
  AmbientLight, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group,
  Mesh, MeshLambertMaterial, OrthographicCamera, Raycaster, Scene, SphereGeometry,
  SRGBColorSpace, Vector2, WebGLRenderer
} from 'three';

export function createDeskScene(canvas, { onSelect, onHover, onFailure, onReady, reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new Scene();
  const camera = new OrthographicCamera(-3, 3, 2, -2, .1, 50);
  camera.position.set(6, 5.2, 8);
  camera.lookAt(0, .55, 0);
  scene.add(new AmbientLight(0xffffff, 1.35));
  const light = new DirectionalLight(0xffffff, 2.1);
  light.position.set(3, 8, 6);
  scene.add(light);

  const materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new MeshLambertMaterial({ color: new Color(color) }));
    return materials.get(color);
  }
  const geometries = [];
  function box(parent, color, size, position, rotation = 0) {
    const geometry = new BoxGeometry(...size);
    geometries.push(geometry);
    const item = new Mesh(geometry, material(color));
    item.position.set(...position);
    item.rotation.y = rotation;
    parent.add(item);
    return item;
  }
  function cylinder(parent, color, radius, height, position) {
    const geometry = new CylinderGeometry(radius, radius, height, 18);
    geometries.push(geometry);
    const item = new Mesh(geometry, material(color));
    item.position.set(...position);
    parent.add(item);
    return item;
  }
  function sphere(parent, color, radius, position) {
    const geometry = new SphereGeometry(radius, 12, 8);
    geometries.push(geometry);
    const item = new Mesh(geometry, material(color));
    item.position.set(...position);
    parent.add(item);
    return item;
  }
  function object(key) {
    const group = new Group();
    group.userData.destination = key;
    desk.add(group);
    return group;
  }

  const desk = new Group();
  scene.add(desk);
  // Desk slab and two visible supports.
  box(desk, '#d8dfcf', [5.4, .2, 3.2], [0, .1, 0]);
  box(desk, '#6a7864', [5.4, .12, 3.2], [0, -.06, 0]);
  box(desk, '#53654f', [.22, 1.1, .22], [-2.35, -.65, 1.2]);
  box(desk, '#53654f', [.22, 1.1, .22], [2.35, -.65, 1.2]);
  box(desk, '#53654f', [.22, 1.1, .22], [-2.35, -.65, -1.2]);
  box(desk, '#53654f', [.22, 1.1, .22], [2.35, -.65, -1.2]);

  // The monitor is an illustration of a system, not a live dashboard.
  const monitor = object('security');
  box(monitor, '#101c16', [2.35, 1.48, .15], [-.3, 1.55, -.8]);
  box(monitor, '#2d4335', [2.12, 1.24, .03], [-.3, 1.55, -.705]);
  box(monitor, '#b9c8ae', [.55, .07, .025], [-.93, 1.98, -.68]);
  box(monitor, '#dce64e', [.55, .07, .025], [-.93, 1.78, -.68]);
  box(monitor, '#789581', [.55, .07, .025], [-.93, 1.58, -.68]);
  box(monitor, '#8ea992', [1.03, .035, .025], [.05, 1.98, -.68]);
  box(monitor, '#8ea992', [.76, .035, .025], [-.08, 1.83, -.68]);
  box(monitor, '#dce64e', [.93, .06, .025], [.02, 1.58, -.68]);
  box(monitor, '#8ea992', [.7, .035, .025], [-.09, 1.43, -.68]);
  box(monitor, '#8ea992', [.9, .035, .025], [.01, 1.28, -.68]);
  box(monitor, '#65745f', [.18, .52, .2], [-.3, .55, -.8]);
  box(monitor, '#65745f', [.8, .08, .55], [-.3, .25, -.65]);

  // A small notebook represents the research question.
  const notebook = object('research');
  box(notebook, '#f2f3ee', [1.24, .12, .9], [-1.55, .3, .55], -.16);
  box(notebook, '#dce64e', [1.22, .025, .88], [-1.55, .375, .55], -.16);
  box(notebook, '#54644e', [.08, .03, .84], [-2.03, .4, .47], -.16);
  box(notebook, '#53614e', [.55, .02, .035], [-1.5, .4, .38], -.16);
  box(notebook, '#53614e', [.4, .02, .035], [-1.56, .4, .52], -.16);

  // Layered papers and a folder represent project work.
  const folder = object('projects');
  box(folder, '#92a48d', [1.3, .11, 1], [1.55, .29, .55], .16);
  box(folder, '#f2f3ee', [1.12, .055, .84], [1.55, .38, .52], .12);
  box(folder, '#dce64e', [1.23, .035, .93], [1.55, .43, .58], .16);
  box(folder, '#aab9a1', [.52, .035, .17], [1.16, .44, .1], .16);

  // Two small figures stand for the people behind the work.
  const people = object('people');
  cylinder(people, '#526b58', .15, .35, [1.7, .44, -.8]);
  sphere(people, '#dce64e', .13, [1.7, .71, -.8]);
  cylinder(people, '#879b83', .13, .3, [2.03, .41, -.65]);
  sphere(people, '#f2f3ee', .115, [2.03, .65, -.65]);

  // A keyboard grounds the scene as a workstation.
  box(desk, '#72816d', [1.8, .08, .52], [-.25, .27, .43]);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 9; col++) {
      box(desk, '#cbd4c5', [.12, .02, .12], [-.99 + col * .18, .325, .28 + row * .17]);
    }
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let visible = false;
  let reduced = reducedMotion;
  let frame = 0;
  let introStart = null;
  let introPlayed = false;
  let targetX = 0;
  let targetY = 0;
  let hover = null;
  let down = null;
  let ready = false;

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const vertical = 4.8;
    camera.left = -vertical * aspect / 2;
    camera.right = vertical * aspect / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestRender();
  }
  function requestRender() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render);
  }
  function render(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    const duration = 1800;
    const progress = reduced || introStart === null ? 1 : Math.min(1, (now - introStart) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const desiredY = (reduced ? 0 : targetY) + (1 - eased) * -.35;
    const desiredX = reduced ? 0 : targetX;
    if (reduced) {
      desk.rotation.x = desiredX;
      desk.rotation.y = desiredY;
    } else {
      desk.rotation.x += (desiredX - desk.rotation.x) * .16;
      desk.rotation.y += (desiredY - desk.rotation.y) * .16;
    }
    renderer.render(scene, camera);
    if (!ready) { ready = true; onReady(); }
    if (progress < 1 || Math.abs(desiredX - desk.rotation.x) > .001 || Math.abs(desiredY - desk.rotation.y) > .001) requestRender();
  }
  function hit(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const intersection of raycaster.intersectObjects(desk.children, true)) {
      let item = intersection.object;
      while (item && item !== desk) {
        if (item.userData.destination) return item.userData.destination;
        item = item.parent;
      }
      return null; // A visible part of the desk blocks objects behind it.
    }
    return null;
  }
  function move(event) {
    const next = hit(event);
    if (next !== hover) {
      hover = next;
      canvas.style.cursor = hover ? 'pointer' : '';
      onHover(hover);
    }
    if (!reduced && event.pointerType !== 'touch') {
      targetY = pointer.x * .12;
      targetX = -pointer.y * .07;
      requestRender();
    }
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
    const destination = hit(event);
    if (destination) onSelect(destination);
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

  return {
    setVisible(value) {
      visible = value;
      if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
      if (visible) {
        if (!introPlayed && !reduced) { introStart = performance.now(); introPlayed = true; }
        requestRender();
      }
    },
    setReduced(value) {
      reduced = value;
      if (value) { targetX = 0; targetY = 0; introStart = null; }
      requestRender();
    },
    dispose() {
      visible = false;
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
