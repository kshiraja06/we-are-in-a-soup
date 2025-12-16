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
  // Increase SPEED to compensate for the larger environment so movement doesn't feel slow
  const ROOM = { W: 20, H: 6, D: 20, EYE_HEIGHT: 3.0, SPEED: 9 };
  const PLAYER = { SIZE: new THREE.Vector3(0.6, 1.7, 0.6), RADIUS: 0.3 };
  const SENSITIVITY = 0.002;

  // Canvas & Renderer
  const canvas = document.getElementById("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue background
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 500);
  scene.add(camera);

  // Camera controls
  let yaw = 0, pitch = 0;

  // Soft warm lighting
  const hemisphereLight = new THREE.HemisphereLight(0xfff5e6, 0xffe0b3, 0.4); // Warm top, warmer bottom
  scene.add(hemisphereLight);
  
  const dir = new THREE.DirectionalLight(0xffe5cc, 0.25); // Soft warm directional light
  dir.position.set(20, 30, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  scene.add(dir);
  
  // Additional soft ambient light
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.6)); // Warm ambient
  
  // Store collider visuals for later cleanup if needed
  const colliderVisuals = [];

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
    // Make the entire classroom environment even larger (3x)
    model.scale.setScalar(3);
    
    // Add model to scene first so matrix world gets updated
    scene.add(model);
    
    // Update matrix world to apply transformations
    model.updateMatrixWorld(true);
    
    model.traverse(m => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.material) {
          m.material.roughness = 0.5;
          m.material.metalness = 0.1;
          // Make room materials mostly white
          if (!m.name.toLowerCase().includes('coll_')) {
            if (Array.isArray(m.material)) {
              m.material.forEach(mat => {
                if (mat.color) mat.color.setHex(0xffffff);
                if (mat.emissive) mat.emissive.setHex(0x000000);
              });
            } else {
              if (m.material.color) m.material.color.setHex(0xffffff);
              if (m.material.emissive) m.material.emissive.setHex(0x000000);
            }
          }
        }
        // Check if this is a collision mesh (name contains "coll_")
        if (m.name.toLowerCase().includes('coll_')) {
          // Update this mesh's matrix world to get correct world space bounds
          m.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(m);
          meshColliders.push(box);
          console.log('Found collision mesh:', m.name, 'bounds:', box.min, 'to', box.max);
        }
      }
    });

    // If no collision meshes found, create default room boundaries (scaled by 3x)
    if (meshColliders.length === 0) {
      console.log('No collision meshes found, creating default room boundaries');
      roomCenter = new THREE.Vector3(0, 9, 0); // Scaled Y position
      const scale = 3; // Match model scale
      const minX = -10 * scale, maxX = 10 * scale, minY = 0, maxY = 6 * scale, minZ = -10 * scale, maxZ = 10 * scale;
      const thickness = 0.3 * scale;
      
      // Floor
      meshColliders.push(new THREE.Box3(
        new THREE.Vector3(minX, minY - thickness, minZ),
        new THREE.Vector3(maxX, minY + thickness, maxZ)
      ));
      
      // Ceiling
      meshColliders.push(new THREE.Box3(
        new THREE.Vector3(minX, maxY - thickness, minZ),
        new THREE.Vector3(maxX, maxY + thickness, maxZ)
      ));
      
      // Four walls
      meshColliders.push(new THREE.Box3(
        new THREE.Vector3(minX, minY, minZ - thickness),
        new THREE.Vector3(maxX, maxY, minZ + thickness)
      ));
      
      meshColliders.push(new THREE.Box3(
        new THREE.Vector3(minX, minY, maxZ - thickness),
        new THREE.Vector3(maxX, maxY, maxZ + thickness)
      ));
      
      meshColliders.push(new THREE.Box3(
        new THREE.Vector3(minX - thickness, minY, minZ),
        new THREE.Vector3(minX + thickness, maxY, maxZ)
      ));
      
      meshColliders.push(new THREE.Box3(
        new THREE.Vector3(maxX - thickness, minY, minZ),
        new THREE.Vector3(maxX + thickness, maxY, maxZ)
      ));
      
      console.log('Created 6 default collision boxes');
    } else {
      console.log('Using', meshColliders.length, 'collision meshes from Blender');
    }

    // Create visual outlines for all colliders
    meshColliders.forEach((box, index) => {
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
      );
      line.position.copy(center);
      scene.add(line);
      colliderVisuals.push(line);
      console.log(`Created collider visual ${index} at`, center, 'size', size);
    });
  } catch (err) {
    console.error('Failed to load classroom.glb, using fallback box');
    model = new THREE.Mesh(
      // 3x larger fallback room
      new THREE.BoxGeometry(60, 18, 60),
      new THREE.MeshStandardMaterial({ color: 0xffffff }) // White fallback room
    );
    model.position.set(0, 3, 0);
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    meshColliders.push(box);
    
    // Create visual outline for fallback collider
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
    );
    line.position.copy(center);
    scene.add(line);
    colliderVisuals.push(line);
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
    // Reposition table: down (lower Y), forward (further -Z), and left (negative X)
    claytable.position.set(21,-2,-35);
    // Even larger table scale
    claytable.scale.setScalar(0.6);
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
    // Larger fallback table
    claytable.scale.setScalar(0.3);
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

  // Clamp removed - relying on colliders for boundary detection

  // Helper to update player collision box at a given position
  const updatePlayerBox = (pos) => {
    playerBox.min.set(pos.x - PLAYER.RADIUS, 0, pos.z - PLAYER.RADIUS);
    playerBox.max.set(pos.x + PLAYER.RADIUS, ROOM.EYE_HEIGHT * 2, pos.z + PLAYER.RADIUS);
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

      // Collision check against coll_* meshes from Blender
      updatePlayerBox(next);
      const hit = meshColliders.some(box => box.intersectsBox(playerBox));
      if (!hit) {
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
