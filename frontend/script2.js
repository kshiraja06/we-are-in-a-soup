(async () => {
  const THREE = window.THREE;
  if (!THREE) return;

  const canvas = document.getElementById("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2f33);

  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
  scene.add(camera);

  const ROOM_W = 20;
  const ROOM_H = 6;
  const ROOM_D = 20;

  const halfW = ROOM_W / 2;
  const halfD = ROOM_D / 2;

  const eyeHeight = 0.9;
  const speed = 3;

  let yaw = 0;
  let pitch = 0;

  const pastel = [0xf7c5cc, 0xc6e2ff, 0xfff4c2, 0xd7ffd9];

  function wall(w, h, color) {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })
    );
  }

  const front = wall(ROOM_W, ROOM_H, pastel[0]);
  front.position.set(0, ROOM_H / 2, -halfD);
  scene.add(front);

  const back = wall(ROOM_W, ROOM_H, pastel[1]);
  back.position.set(0, ROOM_H / 2, halfD);
  back.rotation.y = Math.PI;
  scene.add(back);

  const left = wall(ROOM_D, ROOM_H, pastel[2]);
  left.position.set(-halfW, ROOM_H / 2, 0);
  left.rotation.y = Math.PI / 2;
  scene.add(left);

  const right = wall(ROOM_D, ROOM_H, pastel[3]);
  right.position.set(halfW, ROOM_H / 2, 0);
  right.rotation.y = -Math.PI / 2;
  scene.add(right);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0xf8f4e3 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  scene.add(dir);

  let model;
  let modelBox = new THREE.Box3();
  const boxHelper = new THREE.Box3Helper(modelBox, 0xff0000);
  scene.add(boxHelper);


  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    const loader = new GLTFLoader();

    const gltf = await new Promise((res, rej) =>
      loader.load("./assets/claytable.glb", res, undefined, rej)
    );

    model = gltf.scene;
    model.position.set(10, -1.3, -5);
    model.scale.setScalar(0.4);

    model.traverse(m => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.material.roughness = 0.6;
        m.material.metalness = 0.1;
      }
    });

    scene.add(model);
    modelBox.setFromObject(model);
  } catch {
    model = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    model.position.set(0, 0.5, 0);
    scene.add(model);
    modelBox.setFromObject(model);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function openSoupPainter() {
    const w = document.getElementById("paintWindow");
    if (!w) return;
    w.style.display = "flex";
    setTimeout(() => window.initializeCanvas?.(), 10);
  }

  canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(model, true).length) {
      openSoupPainter();
    }
  });

  const player = new THREE.Vector3(8, eyeHeight, 8);
  const playerSize = new THREE.Vector3(0.6, 1.7, 0.6);
  const playerBox = new THREE.Box3();

  const keys = {};
  window.addEventListener("keydown", e => (keys[e.code] = true));
  window.addEventListener("keyup", e => (keys[e.code] = false));

  function clamp(pos) {
    pos.x = Math.max(-halfW + 0.3, Math.min(halfW - 0.3, pos.x));
    pos.z = Math.max(-halfD + 0.3, Math.min(halfD - 0.3, pos.z));
  }

  let isDown = false;
  let lastX = 0;
  let lastY = 0;
  const sensitivity = 0.002;

  canvas.addEventListener("pointerdown", e => {
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("pointerup", () => (isDown = false));

  canvas.addEventListener("pointermove", e => {
    if (!isDown) return;
    yaw -= (e.clientX - lastX) * sensitivity;
    pitch -= (e.clientY - lastY) * sensitivity;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    lastX = e.clientX;
    lastY = e.clientY;
  });

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  let prev = performance.now();

  function animate(t) {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;

    if (document.getElementById("paintWindow")?.style.display === "flex") {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
      return;
    }

    const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    if (forward || strafe) {
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);

      const dx = (sin * -forward + cos * strafe) * speed * dt;
      const dz = (cos * -forward - sin * strafe) * speed * dt;

      const next = player.clone();
      next.x += dx;
      next.z += dz;
      clamp(next);

      playerBox.setFromCenterAndSize(
        new THREE.Vector3(next.x, 0.9, next.z),
        playerSize
      );

      modelBox.setFromObject(model);
      boxHelper.box.copy(modelBox);

      if (!playerBox.intersectsBox(modelBox)) {
        player.copy(next);
      }
    }

    camera.position.set(player.x, eyeHeight, player.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
