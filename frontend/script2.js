(async () => {
  console.log('We Are In A Soup - v1.2.0');
  const THREE = window.THREE;
  if (!THREE) return;

  // Create debug overlay
  const debugOverlay = document.createElement('div');
  debugOverlay.id = 'debugOverlay';
  debugOverlay.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.7);color:#0f0;font-family:monospace;font-size:12px;padding:10px;z-index:999;border:1px solid #0f0';
  document.body.appendChild(debugOverlay);

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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.3));
  const dir = new THREE.DirectionalLight(0xffffff, 0.3);
  dir.position.set(20, 30, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  let model;
  let meshColliders = [];
  let claytable;
  let roomCenter = new THREE.Vector3(0, 0, 0);

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

    // Find room bounds - use hardcoded reasonable defaults if mesh bounds are crazy
    let roomBounds = new THREE.Box3();
    if (meshColliders.length > 0) {
      meshColliders.forEach(box => roomBounds.union(box));
      console.log('Raw room bounds min:', roomBounds.min);
      console.log('Raw room bounds max:', roomBounds.max);
      
      // If bounds are unreasonable (too large), use default room size
      const size = roomBounds.getSize(new THREE.Vector3());
      if (size.x > 100 || size.y > 100 || size.z > 100) {
        console.log('Room bounds too large, using defaults');
        roomBounds = new THREE.Box3(
          new THREE.Vector3(-10, 0, -10),
          new THREE.Vector3(10, 6, 10)
        );
      }
    } else {
      // Fallback to default room
      roomBounds = new THREE.Box3(
        new THREE.Vector3(-10, 0, -10),
        new THREE.Vector3(10, 6, 10)
      );
    }
    
    roomBounds.getCenter(roomCenter);
    console.log('Room center:', roomCenter.x.toFixed(1), roomCenter.y.toFixed(1), roomCenter.z.toFixed(1));
    console.log('Final room bounds min:', roomBounds.min);
    console.log('Final room bounds max:', roomBounds.max);
      
    // Clear bad collision boxes and create clean wall/floor boxes
    meshColliders = [];
    const minX = roomBounds.min.x;
    const maxX = roomBounds.max.x;
    const minY = roomBounds.min.y;
    const maxY = roomBounds.max.y;
    const minZ = roomBounds.min.z;
    const maxZ = roomBounds.max.z;
    const thickness = 0.3;
    
    // Floor
    let floor = new THREE.Box3(
      new THREE.Vector3(minX, minY - thickness, minZ),
      new THREE.Vector3(maxX, minY + thickness, maxZ)
    );
    meshColliders.push(floor);
    console.log('Floor collision box:', floor.min, 'to', floor.max);
    
    // Ceiling
    let ceiling = new THREE.Box3(
      new THREE.Vector3(minX, maxY - thickness, minZ),
      new THREE.Vector3(maxX, maxY + thickness, maxZ)
    );
    meshColliders.push(ceiling);
    
    // Four walls
    // Front wall (minZ)
    let frontWall = new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ - thickness),
      new THREE.Vector3(maxX, maxY, minZ + thickness)
    );
    meshColliders.push(frontWall);
    
    // Back wall (maxZ)
    let backWall = new THREE.Box3(
      new THREE.Vector3(minX, minY, maxZ - thickness),
      new THREE.Vector3(maxX, maxY, maxZ + thickness)
    );
    meshColliders.push(backWall);
    
    // Left wall (minX)
    let leftWall = new THREE.Box3(
      new THREE.Vector3(minX - thickness, minY, minZ),
      new THREE.Vector3(minX + thickness, maxY, maxZ)
    );
    meshColliders.push(leftWall);
    
    // Right wall (maxX)
    let rightWall = new THREE.Box3(
      new THREE.Vector3(maxX - thickness, minY, minZ),
      new THREE.Vector3(maxX + thickness, maxY, maxZ)
    );
    meshColliders.push(rightWall);
    
    console.log('Created 6 collision boxes, player will spawn at:', roomCenter.x.toFixed(1), roomCenter.z.toFixed(1));
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

  // Load claytable
  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    const claytableGltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        "./assets/claytable.glb",
        (data) => { res(data); },
        undefined,
        (err) => { rej(err); }
      )
    );
    claytable = claytableGltf.scene;
    claytable.position.set(0, -0.85, 0);
    claytable.scale.setScalar(0.15);
    claytable.traverse(m => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.material) {
          m.material.roughness = 0.6;
          m.material.metalness = 0.1;
        }
      }
    });
    scene.add(claytable);
  } catch (err) {
    console.error('Failed to load claytable.glb');
    claytable = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    claytable.position.set(0, 0.1, 0);
    claytable.scale.setScalar(0.1);
    scene.add(claytable);
  }

  // Input
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = {};
  let isDown = false;
  let lastX = 0, lastY = 0;

  const player = new THREE.Vector3(0, ROOM.EYE_HEIGHT, 0);
  const playerBox = new THREE.Box3();

  document.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;
  }, true);
  document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
  }, true);

  canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    
    // Check if clicking on claytable
    if (claytable) {
      const intersects = raycaster.intersectObject(claytable, true);
      console.log('Claytable click test:', intersects.length > 0);
      if (intersects.length) {
        const w = document.getElementById("paintWindow");
        console.log('Paint window element:', w);
        if (w) {
          w.style.display = "flex";
          w.classList.remove("hidden-init");
          setTimeout(() => window.initializeCanvas?.(), 10);
        }
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

    // Update debug overlay
    debugOverlay.innerHTML = `w:${keys['w']?1:0} a:${keys['a']?1:0} s:${keys['s']?1:0} d:${keys['d']?1:0}<br>pos:${player.x.toFixed(1)},${player.z.toFixed(1)}<br>cam:${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)}<br>colliders:${meshColliders.length}`;

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

      // Check collision
      playerBox.setFromCenterAndSize(new THREE.Vector3(next.x, 0.9, next.z), new THREE.Vector3(1.0, 1.7, 1.0));
      let colliding = false;
      for (let i = 0; i < meshColliders.length; i++) {
        if (playerBox.intersectsBox(meshColliders[i])) {
          colliding = true;
          break;
        }
      }
      
      if (!colliding) {
        clamp(next);
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
