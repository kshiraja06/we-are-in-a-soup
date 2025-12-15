(async () => {
  const THREE = window.THREE;
  if (!THREE) return;

  // Constants
  const ROOM = { W: 20, H: 6, D: 20, EYE_HEIGHT: 0.9, SPEED: 3 };
  const PLAYER = { SIZE: new THREE.Vector3(0.6, 1.7, 0.6), RADIUS: 0.3 };
  const SENSITIVITY = 0.002;

  // Canvas & Renderer
  const canvas = document.getElementById("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2f33);
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
  scene.add(camera);

  // Camera controls
  let yaw = 0, pitch = 0;

  // Build room
  const pastel = [0xf7c5cc, 0xc6e2ff, 0xfff4c2, 0xd7ffd9];
  const createWall = (w, h, color) => new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })
  );

  const walls = [
    { obj: createWall(ROOM.W, ROOM.H, pastel[0]), pos: [0, ROOM.H / 2, -ROOM.D / 2], rot: 0 },
    { obj: createWall(ROOM.W, ROOM.H, pastel[1]), pos: [0, ROOM.H / 2, ROOM.D / 2], rot: Math.PI },
    { obj: createWall(ROOM.D, ROOM.H, pastel[2]), pos: [-ROOM.W / 2, ROOM.H / 2, 0], rot: Math.PI / 2 },
    { obj: createWall(ROOM.D, ROOM.H, pastel[3]), pos: [ROOM.W / 2, ROOM.H / 2, 0], rot: -Math.PI / 2 }
  ];
  walls.forEach(({ obj, pos, rot }) => {
    obj.position.set(...pos);
    obj.rotation.y = rot;
    scene.add(obj);
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.W, ROOM.D),
    new THREE.MeshStandardMaterial({ color: 0xf8f4e3 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  scene.add(dir);

  let model;
  let modelBox = new THREE.Box3();

  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load("./assets/claytable.glb", res, undefined, rej)
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

  // Input
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = {};
  let isDown = false;
  let lastX = 0, lastY = 0;

  const player = new THREE.Vector3(8, ROOM.EYE_HEIGHT, 8);
  const playerBox = new THREE.Box3();

  window.addEventListener("keydown", e => (keys[e.code] = true));
  window.addEventListener("keyup", e => (keys[e.code] = false));

  const clamp = pos => {
    pos.x = Math.max(-ROOM.W / 2 + PLAYER.RADIUS, Math.min(ROOM.W / 2 - PLAYER.RADIUS, pos.x));
    pos.z = Math.max(-ROOM.D / 2 + PLAYER.RADIUS, Math.min(ROOM.D / 2 - PLAYER.RADIUS, pos.z));
  };

  canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(model, true).length) {
      const w = document.getElementById("paintWindow");
      if (w) {
        w.style.display = "flex";
        setTimeout(() => window.initializeCanvas?.(), 10);
      }
    }
  });

  canvas.addEventListener("pointerdown", e => {
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("pointerup", () => (isDown = false));

  canvas.addEventListener("pointermove", e => {
    if (!isDown) return;
    yaw -= (e.clientX - lastX) * SENSITIVITY;
    pitch -= (e.clientY - lastY) * SENSITIVITY;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    lastX = e.clientX;
    lastY = e.clientY;
  });

  // Resize handling
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Animation loop
  let prev = performance.now();
  const animate = t => {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;

    if (document.getElementById("paintWindow")?.style.display === "flex") {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
      return;
    }

    const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    // Camera pan with arrow keys
    if (keys.ArrowUp) pitch += 1.8 * dt;
    if (keys.ArrowDown) pitch -= 1.8 * dt;
    if (keys.ArrowLeft) yaw += 1.8 * dt;
    if (keys.ArrowRight) yaw -= 1.8 * dt;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

    if (forward || strafe) {
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const dx = (sin * -forward + cos * strafe) * ROOM.SPEED * dt;
      const dz = (cos * -forward - sin * strafe) * ROOM.SPEED * dt;

      const next = player.clone();
      next.x += dx;
      next.z += dz;
      clamp(next);

      playerBox.setFromCenterAndSize(new THREE.Vector3(next.x, 0.9, next.z), PLAYER.SIZE);
      modelBox.setFromObject(model);

      if (!playerBox.intersectsBox(modelBox)) {
        player.copy(next);
      }
    }

    camera.position.set(player.x, ROOM.EYE_HEIGHT, player.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
})();
