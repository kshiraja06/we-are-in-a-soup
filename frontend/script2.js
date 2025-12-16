(async () => {
  console.log('We Are In A Soup - v1.2.0');
  const THREE = window.THREE;
  if (!THREE) return;


  // Constants
  // Increase SPEED to compensate for the larger environment so movement doesn't feel slow
  const ROOM = { W: 20, H: 6, D: 20, EYE_HEIGHT: 3.5, SPEED: 15 };
  const PLAYER = { SIZE: new THREE.Vector3(0.5, 1.7, 0.5), RADIUS: 0.3 };
  const SENSITIVITY = 0.002;
  
  // World boundaries - limit the playable area
  const WORLD_BOUNDS = {
    minX: -100,
    maxX: 100,
    minZ: -100,
    maxZ: 100,
    minY: -10,
    maxY: 50
  };

  // Canvas & Renderer
  const canvas = document.getElementById("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue background
  // Add fog for better visual polish and to hide distant areas
  scene.fog = new THREE.Fog(0x87CEEB, 80, 150);
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 500);
  scene.add(camera);

  // Camera controls
  let yaw = 0, pitch = 0;

  // Soft warm lighting
  const hemisphereLight = new THREE.HemisphereLight(0xfff5e6, 0xffe0b3, 0.5); // Warm top, warmer bottom
  scene.add(hemisphereLight);
  
  const dir = new THREE.DirectionalLight(0xffe5cc, 0.3); // Soft warm directional light
  dir.position.set(20, 30, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 200;
  dir.shadow.camera.left = -100;
  dir.shadow.camera.right = 100;
  dir.shadow.camera.top = 100;
  dir.shadow.camera.bottom = -100;
  scene.add(dir);
  
  // Additional soft ambient light
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.65)); // Warm ambient
  
  // Store collider visuals for later cleanup if needed
  const colliderVisuals = [];

  let model;
  let meshColliders = []; // Store actual mesh objects for precise collision
  let claytable;
  let glazingBowl; // Placeholder bowl for glazing
  let roomCenter = new THREE.Vector3(0, 0, 0);
  
  // Table visit tracking - 3 stations: bowl glazing, claytable soup painting, and worry box
  const TOTAL_TABLES = 3;
  let tablesVisited = 0;
  window.tablesVisited = 0; // Make globally accessible
  window.TOTAL_TABLES = TOTAL_TABLES;

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
        // Store the actual mesh object for precise geometry-based collision
        const meshName = m.name.toLowerCase();
        if (meshName.includes('coll_')) {
          meshColliders.push(m); // Store the actual mesh, not just bounding box
          console.log('Found collision mesh:', m.name);
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

    // Collider visuals removed

    // Add world boundary collision boxes to limit player movement
    const boundaryThickness = 2;
    // North wall (positive Z)
    meshColliders.push(new THREE.Box3(
      new THREE.Vector3(WORLD_BOUNDS.minX, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxZ - boundaryThickness),
      new THREE.Vector3(WORLD_BOUNDS.maxX, WORLD_BOUNDS.maxY, WORLD_BOUNDS.maxZ + boundaryThickness)
    ));
    // South wall (negative Z)
    meshColliders.push(new THREE.Box3(
      new THREE.Vector3(WORLD_BOUNDS.minX, WORLD_BOUNDS.minY, WORLD_BOUNDS.minZ - boundaryThickness),
      new THREE.Vector3(WORLD_BOUNDS.maxX, WORLD_BOUNDS.maxY, WORLD_BOUNDS.minZ + boundaryThickness)
    ));
    // East wall (positive X)
    meshColliders.push(new THREE.Box3(
      new THREE.Vector3(WORLD_BOUNDS.maxX - boundaryThickness, WORLD_BOUNDS.minY, WORLD_BOUNDS.minZ),
      new THREE.Vector3(WORLD_BOUNDS.maxX + boundaryThickness, WORLD_BOUNDS.maxY, WORLD_BOUNDS.maxZ)
    ));
    // West wall (negative X)
    meshColliders.push(new THREE.Box3(
      new THREE.Vector3(WORLD_BOUNDS.minX - boundaryThickness, WORLD_BOUNDS.minY, WORLD_BOUNDS.minZ),
      new THREE.Vector3(WORLD_BOUNDS.minX + boundaryThickness, WORLD_BOUNDS.maxY, WORLD_BOUNDS.maxZ)
    ));
    console.log('Added world boundary collision boxes');

    // Calculate room's bounding box to find floor level and center position
    const roomBox = new THREE.Box3().setFromObject(model);
    const roomMinY = roomBox.min.y;
    const roomCenter = new THREE.Vector3();
    roomBox.getCenter(roomCenter);
    
    // Add a floor plane (smaller than world boundaries for better feel)
    const floorSize = 120; // Smaller floor size
    const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xf5f5f5, // Light gray floor
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.position.set(roomCenter.x, roomMinY, roomCenter.z); // Position at room's center X/Z and bottom Y
    floor.receiveShadow = true;
    scene.add(floor);
    console.log('Added floor plane at room center:', roomCenter, 'floor level:', roomMinY);
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
    claytable.position.set(81, -2.5, -30);
    claytable.scale.setScalar(0.8);
    
    // Update world matrix for collision detection
    claytable.updateMatrixWorld(true);
    
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
    
    // Add claytable to collision system
    meshColliders.push(claytable);
    console.log('Added claytable to collision system');
        
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
    
    // Add fallback claytable to collision system
    meshColliders.push(claytable);
    console.log('Added fallback claytable to collision system');
  }

  // Add placeholder glazing bowl on top of claytable (will be replaced with GLB later)
  try {
    // Get claytable position to place bowl on top
    const tableBox = new THREE.Box3().setFromObject(claytable);
    const tableTop = tableBox.max.y;
    const tableCenter = new THREE.Vector3();
    tableBox.getCenter(tableCenter);
    
    // Create a realistic ceramic bowl shape using LatheGeometry
    const points = [];
    // Create a bowl profile: starts wide at top, curves down, narrow at bottom
    // (radius, y) coordinates for the profile that will be rotated
    points.push(new THREE.Vector2(0.8, 0.0));   // Top rim, wider
    points.push(new THREE.Vector2(0.75, 0.15)); // Curve down
    points.push(new THREE.Vector2(0.6, 0.4));   // Bowl wall
    points.push(new THREE.Vector2(0.5, 0.6));   // More curve
    points.push(new THREE.Vector2(0.45, 0.75)); // Lower curve
    points.push(new THREE.Vector2(0.4, 0.95));  // Bottom, narrow
    
    // Create outer bowl geometry
    const bowlGeometry = new THREE.LatheGeometry(points, 32); // 32 segments around
    
    // Create inner bowl geometry (slightly smaller for inside surface)
    const innerPoints = [];
    innerPoints.push(new THREE.Vector2(0.75, 0.05));   // Top rim, slightly inset
    innerPoints.push(new THREE.Vector2(0.7, 0.2));     // Curve down
    innerPoints.push(new THREE.Vector2(0.55, 0.45));   // Bowl wall
    innerPoints.push(new THREE.Vector2(0.45, 0.65));   // More curve
    innerPoints.push(new THREE.Vector2(0.4, 0.8));     // Lower curve
    innerPoints.push(new THREE.Vector2(0.38, 0.95));   // Bottom, slightly inset
    
    const innerBowlGeometry = new THREE.LatheGeometry(innerPoints, 32);
    
    // Create a canvas texture for painting on the bowl
    const textureSize = 512;
    const bowlTextureCanvas = document.createElement('canvas');
    bowlTextureCanvas.width = textureSize;
    bowlTextureCanvas.height = textureSize;
    const bowlTextureCtx = bowlTextureCanvas.getContext('2d');
    
    // Fill with cream/tan ceramic color
    bowlTextureCtx.fillStyle = '#d4c5a9';
    bowlTextureCtx.fillRect(0, 0, textureSize, textureSize);
    
    // Add blue stripe around the rim (top portion)
    bowlTextureCtx.fillStyle = '#1e3a8a';
    bowlTextureCtx.fillRect(0, 0, textureSize, textureSize * 0.15); // Blue stripe at top
    
    const bowlTexture = new THREE.CanvasTexture(bowlTextureCanvas);
    bowlTexture.needsUpdate = true;
    
    // Ceramic material properties: slightly glossy, not metallic
    const bowlMaterial = new THREE.MeshStandardMaterial({ 
      map: bowlTexture,
      roughness: 0.5,  // Ceramic is semi-gloss
      metalness: 0.0   // No metalness, pure ceramic
    });
    
    // Create outer bowl
    const outerBowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
    
    // Create inner bowl material (slightly darker for inside)
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9b899,  // Slightly darker ceramic color for inside
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide  // Render both sides so we can see the inside
    });
    const innerBowl = new THREE.Mesh(innerBowlGeometry, innerMaterial);
    
    // Create a group to hold both outer and inner bowl
    glazingBowl = new THREE.Group();
    glazingBowl.add(outerBowl);
    glazingBowl.add(innerBowl);
    
    // Position bowl on top of claytable, centered
    // Bowl height is ~1.0 units, position it on the table
    glazingBowl.position.set(tableCenter.x, tableTop + 1.0, tableCenter.z);
    glazingBowl.rotation.x = Math.PI; // Flip bowl right-side up
    glazingBowl.castShadow = true;
    glazingBowl.receiveShadow = true;
    
    // Store texture canvas and context for painting
    glazingBowl.userData.textureCanvas = bowlTextureCanvas;
    glazingBowl.userData.textureContext = bowlTextureCtx;
    glazingBowl.userData.texture = bowlTexture;
    
    scene.add(glazingBowl);
    
    // Make bowl globally accessible for glazing system
    window.glazingBowl = glazingBowl;
    
    console.log('Added glazing bowl on top of claytable');
  } catch (err) {
    console.error('Failed to create glazing bowl:', err);
  }

  // Add worry box placeholder
  let worryBox;
  try {
    // Create a simple box for the worry station
    const worryBoxGeometry = new THREE.BoxGeometry(1.5, 1.8, 1.2);
    const worryBoxMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xe8d5b7, // Warm paper-like color
      roughness: 0.7,
      metalness: 0.0
    });
    worryBox = new THREE.Mesh(worryBoxGeometry, worryBoxMaterial);
    
    // Position worry box in the scene (away from other tables)
    worryBox.position.set(-60, 2.5, -50);
    worryBox.castShadow = true;
    worryBox.receiveShadow = true;
    
    scene.add(worryBox);
    
    // Add a label on top as a separate mesh
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('worry box', 128, 60);
    ctx.font = '20px Arial';
    ctx.fillText('📝 share your worries', 128, 95);
    
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.6 });
    const labelGeometry = new THREE.PlaneGeometry(2, 0.8);
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.z = 0.61;
    worryBox.add(label);
    
    console.log('Added worry box to scene');
  } catch (err) {
    console.error('Failed to create worry box:', err);
  }
    
    // Don't add to collision - bowl should be clickable/interactable
    console.log('Added glazing bowl on top of claytable');
  } catch (err) {
    console.error('Failed to create glazing bowl:', err);
  }

  // Input
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = {};
  let isDown = false;
  let lastX = 0, lastY = 0;
  let controlsEnabled = false; // Controls disabled until user clicks start

  // Start player at origin, within world boundaries
  const player = new THREE.Vector3(70, ROOM.EYE_HEIGHT, 10);
  const playerBox = new THREE.Box3();

  // Setup intro overlay
  const introOverlay = document.getElementById('introOverlay');
  const startButton = document.getElementById('startButton');
  
  // Show overlay after scene has loaded and rendered
  const showIntroOverlay = () => {
    if (introOverlay) {
      introOverlay.classList.add('visible');
    }
  };
  
  const enableControls = () => {
    controlsEnabled = true;
    if (introOverlay) {
      introOverlay.classList.remove('visible');
      introOverlay.classList.add('hidden');
    }
    // Keep cursor visible (no pointer lock) so it can be customized later
  };

  if (startButton) {
    startButton.addEventListener('click', enableControls);
  }
  
  // Also allow clicking anywhere on overlay to start
  if (introOverlay) {
    introOverlay.addEventListener('click', (e) => {
      if (e.target === introOverlay) {
        enableControls();
      }
    });
  }

  document.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;
  }, true);
  document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
  }, true);

  canvas.addEventListener("click", e => {
    if (!controlsEnabled) {
      enableControls();
      return;
    }
    
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    
    // Check if clicking on claytable
    if (claytable) {
      const intersects = raycaster.intersectObject(claytable, true);
      console.log('Claytable click test:', intersects.length > 0);
      if (intersects.length) {
        // Mark claytable as visited
        if (!window.claytableVisited) {
          window.claytableVisited = true;
          window.tablesVisited = (window.tablesVisited || 0) + 1;
          if (typeof window.updateTableProgress === 'function') {
            window.updateTableProgress();
          }
        }
        
        const w = document.getElementById("paintWindow");
        console.log('Paint window element:', w);
        if (w) {
          w.style.display = "flex";
          w.classList.remove("hidden-init");
          setTimeout(() => window.initializeCanvas?.(), 10);
        }
      }
    }
    
    // Check if clicking on glazing bowl
    if (glazingBowl) {
      const intersects = raycaster.intersectObject(glazingBowl, true);
      if (intersects.length) {
        // Mark bowl table as visited
        if (!window.bowlTableVisited) {
          window.bowlTableVisited = true;
          window.tablesVisited = (window.tablesVisited || 0) + 1;
          if (typeof window.updateTableProgress === 'function') {
            window.updateTableProgress();
          }
        }
        
        const glazingWindow = document.getElementById("glazingWindow");
        if (glazingWindow) {
          glazingWindow.style.display = "flex";
          glazingWindow.classList.remove("hidden-init");
          // Initialize glazing system if needed
          if (typeof window.initializeGlazing === 'function') {
            setTimeout(() => window.initializeGlazing(), 10);
          }
        }
      }
    }

    // Check if clicking on worry box
    if (worryBox) {
      const intersects = raycaster.intersectObject(worryBox, true);
      if (intersects.length) {
        // Mark worry box as visited
        if (!window.worryBoxVisited) {
          window.worryBoxVisited = true;
          window.tablesVisited = (window.tablesVisited || 0) + 1;
          if (typeof window.updateTableProgress === 'function') {
            window.updateTableProgress();
          }
        }

        const worryWindow = document.getElementById("worryWindow");
        if (worryWindow) {
          worryWindow.style.display = "flex";
          worryWindow.classList.remove("hidden-init");
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

  // Helper to check collision between player box and mesh geometry
  const checkMeshCollision = (playerBox, mesh) => {
    // Update mesh world matrix to ensure transforms are current
    mesh.updateMatrixWorld(true);
    
    // First do a quick bounding box check for early rejection
    const meshBox = new THREE.Box3().setFromObject(mesh);
    if (!playerBox.intersectsBox(meshBox)) {
      return false;
    }

    // Get player box center and dimensions
    const center = new THREE.Vector3();
    playerBox.getCenter(center);
    const boxSize = new THREE.Vector3();
    playerBox.getSize(boxSize);
    const playerRadius = Math.max(boxSize.x, boxSize.z) * 0.5;
    
    // Cast rays from player center in movement-relevant directions
    // This checks if the mesh surface is very close to the player
    const raycaster = new THREE.Raycaster();
    raycaster.far = playerRadius * 2; // Check up to player diameter
    
    // Cast in 8 horizontal directions (for walls) and 2 vertical (floor/ceiling)
    const directions = [
      new THREE.Vector3(1, 0, 0),   // +X
      new THREE.Vector3(-1, 0, 0),  // -X
      new THREE.Vector3(0, 0, 1),   // +Z
      new THREE.Vector3(0, 0, -1),  // -Z
      new THREE.Vector3(0.707, 0, 0.707),   // Diagonal
      new THREE.Vector3(-0.707, 0, 0.707),  // Diagonal
      new THREE.Vector3(0.707, 0, -0.707),  // Diagonal
      new THREE.Vector3(-0.707, 0, -0.707), // Diagonal
      new THREE.Vector3(0, 1, 0),   // +Y (ceiling)
      new THREE.Vector3(0, -1, 0),  // -Y (floor)
    ];

    for (const dir of directions) {
      raycaster.set(center, dir);
      const intersects = raycaster.intersectObject(mesh, true);
      // If we hit the mesh within player radius, we're colliding
      if (intersects.length > 0 && intersects[0].distance <= playerRadius) {
        return true;
      }
    }

    return false;
  };

  canvas.addEventListener("pointerdown", e => {
    if (!controlsEnabled) {
      enableControls();
      return;
    }
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("pointerup", () => {
    if (controlsEnabled) {
      isDown = false;
    }
  });

  canvas.addEventListener("pointermove", e => {
    if (!controlsEnabled || !isDown) return;
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
  let overlayShown = false;
  const animate = t => {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;
    
    // Show overlay after first frame renders (scene is ready)
    if (!overlayShown && introOverlay) {
      overlayShown = true;
      // Small delay to ensure scene has rendered
      setTimeout(() => {
        showIntroOverlay();
      }, 100);
    }

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

    if (controlsEnabled && (forward || strafe)) {
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const dx = (sin * -forward + cos * strafe) * ROOM.SPEED * dt;
      const dz = (cos * -forward - sin * strafe) * ROOM.SPEED * dt;

      const next = player.clone();
      next.x += dx;
      next.z += dz;

      // Collision check against coll_* meshes using actual mesh geometry
      updatePlayerBox(next);
      let hit = false;
      for (const collider of meshColliders) {
        // Handle Box3 objects (for fallback boundaries)
        if (collider instanceof THREE.Box3) {
          if (collider.intersectsBox(playerBox)) {
            hit = true;
            break;
          }
        } 
        // Handle mesh objects, Groups (like GLTF scenes), and other Object3D types
        else if (collider instanceof THREE.Object3D) {
          if (checkMeshCollision(playerBox, collider)) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        player.copy(next);
      }
      
      // Safety clamp to ensure player stays within world boundaries
      player.x = Math.max(WORLD_BOUNDS.minX + PLAYER.RADIUS, Math.min(WORLD_BOUNDS.maxX - PLAYER.RADIUS, player.x));
      player.z = Math.max(WORLD_BOUNDS.minZ + PLAYER.RADIUS, Math.min(WORLD_BOUNDS.maxZ - PLAYER.RADIUS, player.z));
      player.y = Math.max(WORLD_BOUNDS.minY + PLAYER.RADIUS, Math.min(WORLD_BOUNDS.maxY - PLAYER.RADIUS, player.y));
    }

    camera.position.set(player.x, ROOM.EYE_HEIGHT, player.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  // Initialize table progress overlay
  if (typeof window.updateTableProgress === 'function') {
    window.updateTableProgress();
  }
  
  requestAnimationFrame(animate);
})();
