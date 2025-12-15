(async () => {
  console.log('We Are In A Soup - v1.2.0');
  const THREE = window.THREE;
  if (!THREE) return;

  // Constants
  const ROOM = { W: 20, H: 6, D: 20, EYE_HEIGHT: 1.5, SPEED: 3 };
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
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 500);
  scene.add(camera);

  // Camera controls
  let yaw = 0, pitch = 0;

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.4));
  const dir = new THREE.DirectionalLight(0xffffff, 0.4);
  dir.position.set(20, 30, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  let model;
  let meshColliders = [];

  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        "./assets/classroom.glb",
        (data) => { res(data); },
        undefined,
        (err) => { rej(err); }
      )
    );
    model = gltf.scene;
    
    model.traverse(m => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.material) {
          m.material.roughness = 0.5;
          m.material.metalness = 0.1;
        }
        // Create individual bounding box for each mesh
        const box = new THREE.Box3().setFromObject(m);
        meshColliders.push(box);
      }
    });
    scene.add(model);
  } catch (err) {
    console.error('Failed to load classroom.glb, using fallback box');
    model = new THREE.Mesh(
      new THREE.BoxGeometry(20, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0x8b8b8b })
    );
    model.position.set(0, 3, 0);
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    meshColliders.push(box);
  }

  // Input
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = {};
  let isDown = false;
  let lastX = 0, lastY = 0;

  const player = new THREE.Vector3(0, 1.5, 0);
  const playerBox = new THREE.Box3();

  window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    keys[key] = true;
    keys[e.code] = true;
  });
  window.addEventListener("keyup", e => {
    const key = e.key.toLowerCase();
    keys[key] = false;
    keys[e.code] = false;
  });

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

  const clamp = pos => {
    pos.x = Math.max(-25, Math.min(25, pos.x));
    pos.z = Math.max(-25, Math.min(25, pos.z));
  };

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

    const forward = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
    const strafe = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);

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

      // Check collision against all mesh colliders
      let colliding = false;
      for (let box of meshColliders) {
        if (playerBox.intersectsBox(box)) {
          colliding = true;
          break;
        }
      }

      if (!colliding) {
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
