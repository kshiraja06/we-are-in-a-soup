(async () => {
  let THREE;
  try {
    THREE = window.THREE || await import('https://unpkg.com/three@0.148.0/build/three.module.js');
  } catch {
    return;
  }

  const canvas = document.getElementById('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2f33);

  const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 100);
  scene.add(camera);

  const ROOM_W = 10, ROOM_H = 3, ROOM_D = 10;
  const halfW = ROOM_W / 2, halfD = ROOM_D / 2;
  const eyeHeight = 1.6, playerRadius = 0.3, speed = 3;
  let yaw = 0, pitch = 0;

  const pastel = [0xf7c5cc, 0xc6e2ff, 0xfff4c2, 0xd7ffd9];
  function wall(w, h, color) {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })
    );
  }

  const front = wall(ROOM_W, ROOM_H, pastel[0]);
  front.position.set(0, ROOM_H / 2, -ROOM_D / 2);
  scene.add(front);

  const back = wall(ROOM_W, ROOM_H, pastel[1]);
  back.position.set(0, ROOM_H / 2, ROOM_D / 2);
  back.rotation.y = Math.PI;
  scene.add(back);

  const left = wall(ROOM_D, ROOM_H, pastel[2]);
  left.position.set(-ROOM_W / 2, ROOM_H / 2, 0);
  left.rotation.y = Math.PI / 2;
  scene.add(left);

  const right = wall(ROOM_D, ROOM_H, pastel[3]);
  right.position.set(ROOM_W / 2, ROOM_H / 2, 0);
  right.rotation.y = -Math.PI / 2;
  scene.add(right);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0xf8f4e3 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemi.position.set(0, ROOM_H, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  scene.add(dir);

  const player = new THREE.Vector3(0, eyeHeight, 0);
  camera.position.copy(player);

  const keys = {
    forward: false,
    back: false,
    left: false,
    right: false
  };

  const keyMap = {
    ArrowUp: 'forward',
    KeyW: 'forward',
    ArrowDown: 'back',
    KeyS: 'back',
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right'
  };

  window.addEventListener('keydown', e => { if (keyMap[e.code]) keys[keyMap[e.code]] = true; });
  window.addEventListener('keyup', e => { if (keyMap[e.code]) keys[keyMap[e.code]] = false; });

  function onResize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(onResize).observe(canvas);
  onResize();

  function clamp(pos) {
    pos.x = Math.max(-halfW + playerRadius, Math.min(halfW - playerRadius, pos.x));
    pos.z = Math.max(-halfD + playerRadius, Math.min(halfD - playerRadius, pos.z));
  }

  let isDown = false, lastX = 0, lastY = 0;
  const sensitivity = 0.002;

  function pointerMove(e) {
    if (!isDown) return;
    const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    yaw -= (x - lastX) * sensitivity;
    pitch -= (y - lastY) * sensitivity;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    lastX = x;
    lastY = y;
  }

  function pointerDown(e) {
    isDown = true;
    lastX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    lastY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
  }

  function pointerUp() { isDown = false; }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('touchstart', pointerDown, { passive: true });
  canvas.addEventListener('touchend', pointerUp);
  canvas.addEventListener('touchmove', pointerMove, { passive: true });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const s = Math.sign(e.deltaY) * 0.25;
    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    const next = player.clone();
    next.x += sinY * -s;
    next.z += cosY * -s;
    clamp(next);
    player.x = next.x;
    player.z = next.z;
  }, { passive: false });

  let prev = performance.now();

  function animate(t) {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;

    const forward = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const strafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    if (forward || strafe) {
      const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
      const vx = (sinY * -forward + cosY * strafe) * speed * dt;
      const vz = (cosY * -forward - sinY * strafe) * speed * dt;
      const next = player.clone();
      next.x += vx;
      next.z += vz;
      clamp(next);
      player.x = next.x;
      player.z = next.z;
    }

    player.y = eyeHeight;

    camera.position.set(player.x, player.y, player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
