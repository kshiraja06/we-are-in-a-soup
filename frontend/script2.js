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
  const hemisphereLight = new THREE.HemisphereLight(0xfffacd, 0xffffe0, 0.45); // Soft yellow top and bottom
  scene.add(hemisphereLight);
  
  const dir = new THREE.DirectionalLight(0xfffacd, 0.35); // Soft yellow directional light
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
  
  // Soft warm ambient light
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.55)); // Warm cream ambient
  
  console.log('Added soft warm lighting');
  
  // Store collider visuals for later cleanup if needed
  const colliderVisuals = [];

  let model;
  let meshColliders = []; // Store actual mesh objects for precise collision
  let claytable;
  let glazingBowl; // Placeholder bowl for glazing
  let roomCenter = new THREE.Vector3(0, 0, 0);
  
  // Table visit tracking - 4 stations: bowl glazing, claytable soup painting, worry box, and kitchen box
  const TOTAL_TABLES = 4;
  let tablesVisited = 0;
  window.tablesVisited = 0; // Make globally accessible
  window.TOTAL_TABLES = TOTAL_TABLES;

  // Proximity dialogue system
  const dialogueState = {
    claytable: { shown: false, lastShown: 0, clicked: false },
    glazingBowl: { shown: false, lastShown: 0, clicked: false },
    worryBox: { shown: false, lastShown: 0, clicked: false },
    kitchenBox: { shown: false, lastShown: 0, clicked: false },
    endingZone: { shown: false, lastShown: 0 }
  };
  const DIALOGUE_COOLDOWN = 20000; // 20 seconds
  const PROXIMITY_DISTANCE = 8; // Distance to trigger dialogue
  
  // Ending sequence state
  let endingTriggered = false;
  const ENDING_ZONE = { x: 81, z: -30, radius: 5 }; // Back right area

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
    
    // Add green floor for room
    const floorSize = 120;
    const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xa8c5a0, // Green floor
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(roomCenter.x, roomMinY, roomCenter.z);
    floor.receiveShadow = true;
    scene.add(floor);
    console.log('Added green floor at room center:', roomCenter, 'floor level:', roomMinY);
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
    
    // Add claytable to collision system with taller collision box
    const claytableBounds = new THREE.Box3().setFromObject(claytable);
    claytableBounds.max.y += 3; // Make collision taller for camera
    meshColliders.push(claytableBounds);
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

  // Load kitchen table.glb for worry box station
  let worryBox;
  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        "./assets/kitchen table.glb",
        (data) => { res(data); },
        undefined,
        (err) => { rej(err); }
      )
    );
    worryBox = gltf.scene;
    
    // Scale up the table to make it more visible
    worryBox.scale.set(4, 4, 4);
    
    // Position kitchen table in the scene (closer to player spawn for visibility)
    // Player starts at (70, 3.5, 10), so put table right next to them
    worryBox.position.set(58, -1.5, -15);
    worryBox.castShadow = true;
    worryBox.receiveShadow = true;
    
    // Enable shadows for all meshes in the model
    worryBox.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    scene.add(worryBox);
    
    // Add to collision system with taller collision box
    const worryBoxBounds = new THREE.Box3().setFromObject(worryBox);
    const tableTop = worryBoxBounds.max.y;
    worryBoxBounds.max.y += 3; // Make collision taller for camera
    meshColliders.push(worryBoxBounds);
    
    // Create canvas for text
    const chitCanvas = document.createElement('canvas');
    chitCanvas.width = 512;
    chitCanvas.height = 256;
    const chitCtx = chitCanvas.getContext('2d');
    
    // Draw chit background (cream/beige paper)
    chitCtx.fillStyle = '#fffacd';
    chitCtx.fillRect(0, 0, 512, 256);
    
    // Add slight texture/border
    chitCtx.strokeStyle = '#d4a574';
    chitCtx.lineWidth = 4;
    chitCtx.strokeRect(0, 0, 512, 256);
    
    // Draw text
    chitCtx.fillStyle = '#3d2817';
    chitCtx.font = 'italic bold 48px Georgia, serif';
    chitCtx.textAlign = 'center';
    chitCtx.textBaseline = 'middle';
    chitCtx.fillText('holding space', 256, 128);
    
    // Create texture and material
    const chitTexture = new THREE.CanvasTexture(chitCanvas);
    const chitMaterial = new THREE.MeshStandardMaterial({
      map: chitTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    // Create plane for chit
    const chitGeometry = new THREE.PlaneGeometry(1.5, 0.75);
    const chit = new THREE.Mesh(chitGeometry, chitMaterial);
    chit.position.set(worryBox.position.x+3.5, tableTop + 0.05, worryBox.position.z+1);
    chit.rotation.x = -Math.PI / 2; // Lay flat on table
    chit.receiveShadow = true;
    scene.add(chit);
    
    console.log('Added kitchen table (worry box) with "holding space" chit at position:', worryBox.position);
  } catch (err) {
    console.error('Failed to load kitchen table.glb for worry box:', err);
  }

  // Load kitchen table 2.glb for kitchen setup station
  let kitchenBox;
  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        "./assets/kitchen table 2.glb",
        (data) => { res(data); },
        undefined,
        (err) => { rej(err); }
      )
    );
    kitchenBox = gltf.scene;
    
    // Scale up the table to make it more visible
    kitchenBox.scale.set(3.5, 3.5, 3.5);
    
    // Position kitchen table further back and to the right
    kitchenBox.position.set(80, -1.5, -9);
    kitchenBox.castShadow = true;
    kitchenBox.receiveShadow = true;
    
    // Enable shadows for all meshes in the model
    kitchenBox.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    scene.add(kitchenBox);
    
    // Add to collision system with taller collision box
    const kitchenBoxBounds = new THREE.Box3().setFromObject(kitchenBox);
    kitchenBoxBounds.max.y += 3; // Make collision taller for camera
    meshColliders.push(kitchenBoxBounds);
    
    // Add induction cooktop on the table
    const inductionGeometry = new THREE.BoxGeometry(0.8, 0.05, 0.8);
    const inductionMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a, // Dark grey/black for induction
      roughness: 0.3,
      metalness: 0.7
    });
    const induction = new THREE.Mesh(inductionGeometry, inductionMaterial);
    
    // Position induction on top of the table
    // Get table bounding box to place induction on top
    const tableBox = new THREE.Box3().setFromObject(kitchenBox);
    const tableHeight = tableBox.max.y;
    induction.position.set(83, tableHeight + 0.025, -8);
    induction.castShadow = true;
    induction.receiveShadow = true;
    scene.add(induction);
    
    // Add soup pot on the induction - opaque pot with visible soup on top
    const potGeometry = new THREE.CylinderGeometry(0.5, 0.45, 0.6, 32);
    const potMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x606060, // Dark grey for pot
      roughness: 0.5,
      metalness: 0.7
    });
    const pot = new THREE.Mesh(potGeometry, potMaterial);
    pot.position.set(83, tableHeight + 0.025 + 0.3, -8);
    pot.castShadow = true;
    pot.receiveShadow = true;
    scene.add(pot);
    
    // Add soup liquid visible at the top of the pot
    const soupGeometry = new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32);
    const soupMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xd4a574, // Soup color (brownish)
      roughness: 0.9,
      metalness: 0.0,
      emissive: 0xd4a574,
      emissiveIntensity: 0.4
    });
    const soup = new THREE.Mesh(soupGeometry, soupMaterial);
    soup.position.set(83, tableHeight + 0.025 + 0.59, -8); // Just below pot rim
    scene.add(soup);
    
    console.log('Added kitchen table 2 with induction and soup pot at position:', kitchenBox.position);
  } catch (err) {
    console.error('Failed to load kitchen table 2.glb:', err);
  }

  // Create a subtle glowing plane on the wall surface
  // Match wall dimensions and position it directly on the wall
  const glowPlaneGeometry = new THREE.PlaneGeometry(15, 12); // Larger to match wall section
  const glowPlaneMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa, // Softer yellow
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
  });
  const glowPlane = new THREE.Mesh(glowPlaneGeometry, glowPlaneMaterial);
  
  // Position directly on the wall surface (adjust Z to be flush with wall)
  glowPlane.position.set(ENDING_ZONE.x, 4, ENDING_ZONE.z + 0.1);
  glowPlane.rotation.y = Math.PI / 2; // Face outward from wall
  scene.add(glowPlane);
  window.glowPlane = glowPlane;
  
  // Single subtle point light for soft glow
  const glowLight = new THREE.PointLight(0xffffaa, 0, 20);
  glowLight.position.set(ENDING_ZONE.x, 4, ENDING_ZONE.z);
  scene.add(glowLight);
  window.endingGlowLight = glowLight;
  
  console.log('Wall glow plane created at position:', glowPlane.position);

  // Create text-based recipe cards on back wall - very tight spacing
  const recipeCards = [
    { name: 'Tomato Soup', x: -2.5, y: 6.5, color: 0xffcccc, border: 0xff6666 },
    { name: 'Bassaru', x: -1.2, y: 7.2, color: 0xccffff, border: 0x6666ff },
    { name: 'Goat Leg Soup', x: 0, y: 7.5, color: 0xffeecc, border: 0xff6666 },
    { name: 'Veg Soup', x: 1.2, y: 7.2, color: 0xffffcc, border: 0x666666 },
    { name: 'Mushroom Soup', x: 2.5, y: 6.5, color: 0xffccff, border: 0xff66ff },
    { name: 'Raoji Ganji', x: -2.5, y: 4.8, color: 0xffddcc, border: 0xff6666 },
    { name: 'Mix Veg Soup', x: -1.2, y: 5.5, color: 0xeeffcc, border: 0x666666 },
    { name: 'Red Lentil Soup', x: 0, y: 5.5, color: 0xffffdd, border: 0x666666 },
    { name: 'Lemon Coriander', x: 1.2, y: 5.5, color: 0xeeffee, border: 0x666666 },
    { name: 'Rasam', x: 2.5, y: 4.8, color: 0xffdddd, border: 0xff6666 },
    { name: 'Chicken Soup', x: -1.5, y: 3.2, color: 0xeeffdd, border: 0xff6666 },
    { name: 'Ginger Tea', x: 0, y: 3.2, color: 0xffeeee, border: 0x666666 },
    { name: 'Huli', x: 1.5, y: 3.2, color: 0xffffee, border: 0x6666ff }
  ];

  // Store recipe card meshes for click detection
  window.recipeCardMeshes = [];

  // Position cards on the back wall, moved forward
  const wallZ = -38;
  const wallX = 62;

  // Create text-based recipe cards
  recipeCards.forEach(card => {
    // Create canvas for text card
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Draw card background
    ctx.fillStyle = '#' + card.color.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw border
    ctx.strokeStyle = '#' + card.border.toString(16).padStart(6, '0');
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 492);
    
    // Draw recipe name
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.name, 256, 256);
    
    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide
    });
    
    // Create plane for card (smaller size)
    const cardGeometry = new THREE.PlaneGeometry(1.0, 1.0);
    const cardMesh = new THREE.Mesh(cardGeometry, material);
    
    // Position on back wall
    cardMesh.position.set(wallX + card.x, card.y, wallZ + 0.1);
    cardMesh.rotation.y = 0; // Face forward into room
    cardMesh.receiveShadow = true;
    
    // Store card data for click detection
    cardMesh.userData.recipeName = card.name;
    cardMesh.userData.isRecipeCard = true;
    
    scene.add(cardMesh);
    window.recipeCardMeshes.push(cardMesh);
  });
  
  console.log('Added', recipeCards.length, 'recipe card placeholders on back wall');

  // Create video frame on wall
  const videoFrameGeometry = new THREE.PlaneGeometry(12, 7);
  
  // Create canvas for text texture
  const videoCanvas = document.createElement('canvas');
  videoCanvas.width = 512;
  videoCanvas.height = 256;
  const ctx = videoCanvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, 512, 256);
  
  // Draw border
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 248);
  
  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("nidhi's video !! click !!", 256, 128);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(videoCanvas);
  const videoFrameMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.3,
    metalness: 0.1
  });
  const videoFrame = new THREE.Mesh(videoFrameGeometry, videoFrameMaterial);
  
  // Position video frame on left wall (facing right into room) - moved more to the right
  videoFrame.position.set(60, 6, -20);
  videoFrame.rotation.y = Math.PI / 2; // Face right into room
  videoFrame.receiveShadow = true;
  
  // Store video frame data for click detection
  videoFrame.userData.isVideoFrame = true;
  
  scene.add(videoFrame);
  window.videoFrame = videoFrame;
  
  console.log('Video frame created at position:', videoFrame.position);

  // Add dining table to back of room
  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    
    const tableGltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        "./assets/dining table.glb",
        (data) => { res(data); },
        undefined,
        (err) => { rej(err); }
      )
    );
    
    const diningTable = tableGltf.scene;
    diningTable.position.set(65,-2, -29); // Back of room
    diningTable.rotation.y = Math.PI / 2;
    diningTable.scale.set(4.0, 4.0, 4.0);
    diningTable.castShadow = true;
    diningTable.receiveShadow = true;
    
    diningTable.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Fix materials to ensure they're not black
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.roughness = 0.6;
              mat.metalness = 0.1;
            });
          } else {
            child.material.roughness = 0.6;
            child.material.metalness = 0.1;
          }
        }
      }
    });
    
    scene.add(diningTable);
    
    // Add to collision system with taller collision box
    const diningTableBounds = new THREE.Box3().setFromObject(diningTable);
    diningTableBounds.max.y += 3; // Make collision taller for camera
    meshColliders.push(diningTableBounds);
    
    console.log('Added dining table to back of room');
  } catch (err) {
    console.error('Failed to load dining table:', err);
  }

  // Add just 1 chair in the room for atmosphere
  const chairPositions = [
    { pos: [75, 0, -20], rot: -Math.PI / 4 } // Back right area
  ];

  // Load and place chairs
  try {
    const GLTFLoader = window.THREE.GLTFLoader || window.GLTFLoader;
    
    const chairGltf = await new Promise((res, rej) =>
      new GLTFLoader().load(
        "./assets/chairs.glb",
        (data) => { res(data); },
        undefined,
        (err) => { rej(err); }
      )
    );
    
    for (let i = 0; i < chairPositions.length; i++) {
      const chairPos = chairPositions[i];
      const chair = chairGltf.scene.clone();
      
      chair.position.set(chairPos.pos[0], chairPos.pos[1], chairPos.pos[2]);
      chair.rotation.y = chairPos.rot;
      chair.scale.set(0.5, 0.5, 0.5);
      chair.castShadow = true;
      chair.receiveShadow = true;
      
      chair.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(chair);
      meshColliders.push(chair);
    }
    
    console.log('Added 1 chair to the room');
  } catch (err) {
    console.error('Failed to load chairs:', err);
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
        // Mark claytable as clicked (stop showing dialogue)
        dialogueState.claytable.clicked = true;
        
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
        // Mark bowl as clicked (stop showing dialogue)
        dialogueState.glazingBowl.clicked = true;
        
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
        // Mark worry box as clicked (stop showing dialogue)
        dialogueState.worryBox.clicked = true;
        
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

    // Check if clicking on kitchen box
    if (kitchenBox) {
      const intersects = raycaster.intersectObject(kitchenBox, true);
      if (intersects.length) {
        // Mark kitchen box as clicked (stop showing dialogue)
        dialogueState.kitchenBox.clicked = true;
        
        // Mark kitchen box as visited
        if (!window.kitchenBoxVisited) {
          window.kitchenBoxVisited = true;
          window.tablesVisited = (window.tablesVisited || 0) + 1;
          if (typeof window.updateTableProgress === 'function') {
            window.updateTableProgress();
          }
        }
        
        // Open kitchen setup page in new window
        window.open('./kitchen-setup.html', '_blank');
      }
    }

    // Check if clicking on recipe cards
    if (window.recipeCardMeshes && window.recipeCardMeshes.length > 0) {
      const cardIntersects = raycaster.intersectObjects(window.recipeCardMeshes, false);
      if (cardIntersects.length > 0) {
        const clickedCard = cardIntersects[0].object;
        if (clickedCard.userData.isRecipeCard) {
          // Show expanded recipe view
          showRecipeExpanded(null, clickedCard.userData.recipeName);
        }
      }
    }

    // Check if clicking on video frame
    if (window.videoFrame) {
      const videoIntersects = raycaster.intersectObject(window.videoFrame, false);
      if (videoIntersects.length > 0) {
        // Show video player overlay
        showVideoOverlay();
      }
    }
  });

  // Recipe data with full instructions
  const recipeData = {
    'Tomato Soup': {
      steps: ['1. Peel Apples and Carrots and Chop into medium sized bits', '2. Tomatoes apples and carrots go into 1/2 water and boil until carrots and apple go soft', '3. Blend, Strain', '4. Adjust salt, Pepper, Sugar, Butter for seasoning and add Water for consistency'],
      ingredients: '1:2:4 = apple: carrot: tomato, warm fat, salt, pepper, sugar, butter'
    },
    'Bassaru': {
      steps: ['1. Separate the water after cooking greens and dal', '2. Boil that water with Garlic, Cummin and Pepper', '3. Serve hot, sometimes with Rice, Brown Rice or Ragi Mudde'],
      ingredients: 'Palak, Keerai or Soppu, Leftover Dal Water, Garlic, Cummin, Pepper',
      note: 'Bassaru is not thick, it should be clear'
    },
    'Goat Leg Soup': {
      steps: ['1. Cut the goat leg into pieces', '2. Put it in a cooker', '3. Add salt, chilli powder, pepper and garlic', '4. Pressure cook / boil well until the stock becomes strong', '5. Remove the leg juice and have the soup', '6. Garnish with Kothmir (fresh coriander)'],
      ingredients: 'Goat Leg (cut), Salt, Chilli Powder, Black Pepper, Garlic',
      notes: ['It helps with joint pain', 'You get a good sleep', 'It is a medicine food', 'Best had at night']
    },
    'Veg Soup': {
      steps: ['1. Heat oil in a pot and add ginger', '2. Add all the chopped vegetables and sauté for about 10 minutes', '3. Pour in water or stock and bring it to boil', '4. Lower the heat and simmer for 15-20 minutes until the veggies are tender', '5. Season with Salt and Pepper', '6. Serve hot'],
      ingredients: 'Carrots, Ginger, Garlic, Veggies, Salt, Pepper, Oil, Cornflour, Butter, Chillies'
    },
    'Mushroom Soup': {
      steps: ['1. Heat oil in a pot and sauté garlic, ginger and chillies', '2. Add mushrooms and cook over a minute', '3. Add the mixed vegetables and sauté for about 10 minutes', '4. Pour in water and bring to boil', '5. Add Soy sauce, vinegar, salt and pepper', '6. Stir the cornflour slurry and cook till slightly thick', '7. Taste and Adjust Seasoning'],
      ingredients: 'Mushrooms, Veggies, Garlic, Ginger, Chillies, Soy, Vinegar, Cornflour, Water, Salt, Pepper, Oil, Spring Onions'
    },
    'Raoji Ganji': {
      steps: ['No recipe text available - traditional preparation'],
      ingredients: 'Traditional ingredients'
    },
    'Mix Veg Soup': {
      steps: ['1. Heat oil in a pot and add ginger', '2. Add all the chopped vegetables and sauté for about 10 minutes', '3. Pour in water or stock and bring it to boil', '4. Lower the heat and simmer for 15-20 minutes until the veggies are tender', '5. Season with Salt and Pepper', '6. Serve hot'],
      ingredients: 'Carrots, Ginger, Garlic, Veggies, Salt, Pepper, Oil, Cornflour, Butter, Chillies'
    },
    'Red Lentil Soup': {
      steps: ['1. Rinse red lentils off in the water in a strainer and set aside', '2. In a pot warm extra virgin olive oil', '3. Add chopped onions and stir well combining them all together', '4. Pour boiled water over, and stir everything well combining the water with lentils and onions', '5. Add salt and cumin, give it another stir', '6. Let it cook for 30 mins on low heat'],
      ingredients: 'Red Split Lentils, Onions, Olive Oil, Water, Salt, Cummin Powder',
      subtitle: 'Palestinian Adas'
    },
    'Lemon Coriander': {
      steps: ['1. Rinse and finely chop fresh coriander stems and leaves', '2. In a pot, heat a little oil and add chopped garlic & ginger. Stir gently', '3. Pour in water or light vegetable stock and bring to a soft boil', '4. Add coriander stems, salt, and crushed black pepper', '5. Let the soup simmer for 20 minutes on low heat', '6. Finish with chopped coriander leaves and mix elegantly'],
      ingredients: 'Onion, Garlic, Ginger, Veggies, Vegetable Stock, Water, Coriander, Lemon, Pepper, Salt, Oil'
    },
    'Rasam': {
      steps: ['1. Crush garlic, pepper, coriander, red chillies and jeera coarsely', '2. Soak Tamarind, extract the juice, and keep aside', '3. In a pot, add tomatoes, tamarind water, turmeric, rasam powder, salt and water', '4. Lightly mash the tomatoes and add the crushed spice mix. Simmer for 10 minutes', '5. Heat oil, add onion, add curry leaves, and let them crackle', '6. Pour this tadka into the rasam and switch off flame'],
      ingredients: 'Garlic, Pepper, Coriander, Red Chillies, Tomato, Tamarind, Rasam Powder, Onion, Curry Leaf, Oil, Turmeric Powder',
      subtitle: "Basavaraj's Rasam"
    },
    'Chicken Soup': {
      steps: ['1. In warm water, put some fermented fish (Ngari)', '2. After 2 minutes - your onion, garlic and ginger. Let it boil', '3. Add chicken and bamboo shoots', '4. You can put dry chilli, pepper and salt to taste', '5. Spring onions (optional)'],
      ingredients: 'Fermented fish (Ngari), Onion, Garlic, Ginger, Chicken, Bamboo shoots, Chilli, Pepper, Salt, Spring onions',
      subtitle: "Dolly Sanasam's Recipe"
    },
    'Ginger Tea': {
      steps: ['1. Bring to boil, 1 cup of water in a sauce pan. Add tea powder, crushed ginger and switch off the flame. Mix well', '2. Keep it covered for about 10 minutes, add lemon', '3. Mix honey or sugar as needed. Enjoy immediately'],
      ingredients: 'Water, Tea Leaves, Ginger, Lemon, Sugar/Jaggery'
    },
    'Huli': {
      steps: ['1. Boil vegetables in tamarind water', '2. Add dal water and sambar Powder', '3. Simmer and Temper lightly'],
      ingredients: 'Toor Dal Water, Tamarind, Sambar Powder, Drumstick or Pumpkin, Curry Leaves',
      subtitle: 'Thin Sambar-like Soup - Lakshmamma\'s Recipe',
      notes: ['Eaten with hot rice', 'When there are a lot of people at home', 'Karnataka comfort soup']
    }
  };

  // Function to show expanded recipe card
  function showRecipeExpanded(imagePath, recipeName) {
    // Create overlay if it doesn't exist
    let overlay = document.getElementById('recipeExpandedOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'recipeExpandedOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
        overflow-y: auto;
      `;
      
      const content = document.createElement('div');
      content.id = 'recipeExpandedContent';
      content.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        max-width: 700px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        margin: 20px;
      `;
      
      overlay.appendChild(content);
      document.body.appendChild(overlay);
      
      // Close on click
      overlay.addEventListener('click', () => {
        overlay.style.display = 'none';
      });
    }
    
    // Get recipe data
    const recipe = recipeData[recipeName] || { steps: ['Recipe not found'], ingredients: '' };
    
    // Build steps HTML - remove number prefixes since <ol> provides numbering
    let stepsHTML = recipe.steps.map(step => {
      // Remove "1. ", "2. ", etc. from the beginning of each step
      const cleanStep = step.replace(/^\d+\.\s*/, '');
      return `<li style="margin-bottom: 12px;">${cleanStep}</li>`;
    }).join('');
    
    // Build notes HTML if exists
    let notesHTML = '';
    if (recipe.notes) {
      notesHTML = '<div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 6px;">';
      notesHTML += '<strong style="color: #666;">Notes:</strong><ul style="margin: 10px 0 0 20px;">';
      notesHTML += recipe.notes.map(note => `<li style="color: #666; margin-bottom: 6px;">${note}</li>`).join('');
      notesHTML += '</ul></div>';
    }
    if (recipe.note) {
      notesHTML = `<div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 6px; color: #666;"><em>${recipe.note}</em></div>`;
    }
    
    // Update content and show
    const content = document.getElementById('recipeExpandedContent');
    content.innerHTML = `
      <h2 style="font-family: Georgia, serif; color: #333; margin-bottom: 8px;">${recipeName}</h2>
      ${recipe.subtitle ? `<p style="font-family: Georgia, serif; color: #999; font-style: italic; margin-bottom: 20px;">${recipe.subtitle}</p>` : ''}
      
      <div style="margin-bottom: 25px;">
        <h3 style="font-family: Georgia, serif; color: #555; margin-bottom: 12px; font-size: 18px;">Ingredients</h3>
        <p style="font-family: Georgia, serif; color: #666; line-height: 1.6; background: #fff9e6; padding: 12px; border-radius: 6px;">${recipe.ingredients}</p>
      </div>
      
      <div>
        <h3 style="font-family: Georgia, serif; color: #555; margin-bottom: 12px; font-size: 18px;">Instructions</h3>
        <ol style="font-family: Georgia, serif; color: #666; line-height: 1.6; padding-left: 20px;">
          ${stepsHTML}
        </ol>
      </div>
      
      ${notesHTML}
    `;
    overlay.style.display = 'flex';
  }

  // Function to show video overlay
  function showVideoOverlay() {
    const videoOverlay = document.getElementById('videoOverlay');
    const iframe = document.getElementById('wallVideo');
    
    if (videoOverlay && iframe) {
      videoOverlay.style.display = 'flex';
      // YouTube iframe will autoplay when loaded with autoplay parameter
      // Reload iframe to trigger autoplay
      const currentSrc = iframe.src;
      iframe.src = currentSrc + '&autoplay=1';
    }
  }

  // Close video overlay functionality - completely rewritten
  function initVideoClose() {
    console.log('Initializing video close functionality...');
    
    const closeVideoBtn = document.getElementById('closeVideo');
    const videoOverlay = document.getElementById('videoOverlay');
    
    console.log('Elements found:', {
      closeVideoBtn: !!closeVideoBtn,
      videoOverlay: !!videoOverlay
    });
    
    if (closeVideoBtn && videoOverlay) {
      // Remove existing listeners to prevent duplicates
      closeVideoBtn.replaceWith(closeVideoBtn.cloneNode(true));
      const newCloseBtn = document.getElementById('closeVideo');
      
      // Simple direct close
      newCloseBtn.onclick = function() {
        console.log('Close button clicked!');
        videoOverlay.style.display = 'none';
        return false;
      };
      
      // Close on overlay click
      videoOverlay.onclick = function(e) {
        if (e.target === videoOverlay) {
          console.log('Background clicked, closing overlay');
          videoOverlay.style.display = 'none';
        }
      };
      
      // ESC key close
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && videoOverlay.style.display === 'flex') {
          console.log('ESC pressed, closing overlay');
          videoOverlay.style.display = 'none';
        }
      });
      
      console.log('Video close functionality initialized');
    } else {
      console.error('Missing video overlay elements');
    }
  }
  
  // Initialize immediately and also on DOMContentLoaded
  initVideoClose();
  document.addEventListener('DOMContentLoaded', initVideoClose);

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

  // Dialogue display function
  const showDialogue = (text, duration = 1000) => {
    const dialogue = document.getElementById('proximityDialogue');
    if (!dialogue) return;
    
    dialogue.textContent = text;
    dialogue.style.opacity = '1';
    
    setTimeout(() => {
      dialogue.style.opacity = '0';
    }, duration);
  };

  // Check proximity to objects and show dialogue
  const checkProximity = () => {
    if (!controlsEnabled) return;
    
    const now = Date.now();
    
    // Only show dialogue for glazing bowl
    if (glazingBowl && !dialogueState.glazingBowl.clicked) {
      const bowlPos = new THREE.Vector3();
      glazingBowl.getWorldPosition(bowlPos);
      const dist = player.distanceTo(bowlPos);
      
      if (dist < PROXIMITY_DISTANCE) {
        if (!dialogueState.glazingBowl.shown || (now - dialogueState.glazingBowl.lastShown > DIALOGUE_COOLDOWN)) {
          showDialogue("click the bowl!", 1000);
          dialogueState.glazingBowl.shown = true;
          dialogueState.glazingBowl.lastShown = now;
        }
      }
    }
    
    // Check ending zone proximity (only if all tables visited)
    if (!endingTriggered && window.tablesVisited >= TOTAL_TABLES) {
      const distToEnd = Math.sqrt(
        Math.pow(player.x - ENDING_ZONE.x, 2) + 
        Math.pow(player.z - ENDING_ZONE.z, 2)
      );
      
      if (distToEnd < ENDING_ZONE.radius) {
        if (!dialogueState.endingZone.shown || (now - dialogueState.endingZone.lastShown > DIALOGUE_COOLDOWN)) {
          showDialogue("are you ready?", 1500);
          dialogueState.endingZone.shown = true;
          dialogueState.endingZone.lastShown = now;
          
          // Trigger ending sequence after short delay
          setTimeout(() => {
            triggerEnding();
          }, 2000);
        }
      }
    }
  };

  // Ending sequence
  const triggerEnding = () => {
    if (endingTriggered) return;
    endingTriggered = true;
    
    // Fade to black
    const fadeOverlay = document.getElementById('fadeOverlay');
    if (fadeOverlay) {
      fadeOverlay.style.pointerEvents = 'all';
      fadeOverlay.style.opacity = '1';
    }
    
    // After fade, show stats
    setTimeout(() => {
      showStats();
    }, 2500);
  };

  const showStats = () => {
    const statsOverlay = document.getElementById('statsOverlay');
    const statsContent = document.getElementById('statsContent');
    
    if (!statsOverlay || !statsContent) return;
    
    // Stats from the "Soup for Thought" image
    const stats = [
      "we produce enough food to feed everyone, yet millions starve",
      "truth travels slower than lies",
      "every 2 seconds, someone is displaced",
      "loneliness is now a global epidemic",
      "history remembers power, not people",
      "children inherit crises they didn't create",
      "more people have phones than clean water",
      "maps are drawn by the victorious",
      "peace lasts shorter than the wars that create it",
      "most of the internet is designed to keep you scrolling, not thinking",
      "the poorest pay the highest price for the climate crisis",
      "more plastic enters the ocean than data enters your phone",
      "most human suffering is preventable—and it still happens",
      "someone somewhere is makicng your clothes for less than a living wage"
    ];
    
    statsOverlay.style.display = 'block';
    statsContent.innerHTML = '';
    statsContent.style.position = 'relative';
    statsContent.style.width = '100%';
    statsContent.style.height = '100%';
    
    // Bombard with stats appearing in random positions
    let delay = 0;
    let previousElements = [];
    
    stats.forEach((stat, index) => {
      setTimeout(() => {
        // Fade out previous text elements
        previousElements.forEach(el => {
          el.style.opacity = '0';
          setTimeout(() => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }, 500);
        });
        previousElements = [];
        
        const p = document.createElement('p');
        p.textContent = stat;
        p.style.position = 'absolute';
        p.style.opacity = '0';
        p.style.transition = 'opacity 0.5s';
        p.style.fontSize = '1.2em';
        p.style.maxWidth = '400px';
        p.style.padding = '10px';
        
        // Random position on screen
        p.style.left = Math.random() * 60 + 10 + '%';
        p.style.top = Math.random() * 70 + 10 + '%';
        
        statsContent.appendChild(p);
        previousElements.push(p);
        
        setTimeout(() => {
          p.style.opacity = '1';
        }, 50);
        
        // Show final popup after last stat
        if (index === stats.length - 1) {
          setTimeout(() => {
            showFinalPopup();
          }, 2000);
        }
      }, delay);
      delay += 1200;
    });
  };

  const showFinalPopup = () => {
    const finalPopup = document.getElementById('finalPopup');
    const suggestionText = document.getElementById('suggestionText');
    
    if (!finalPopup || !suggestionText) return;
    
    // Random suggestion - only two options
    const suggestions = [
      "feed a friend",
      "help a stranger"
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    suggestionText.textContent = randomSuggestion;
    
    finalPopup.style.display = 'flex';
    
    // Button handlers
    document.getElementById('exitButton')?.addEventListener('click', () => {
      window.close();
      // If window.close() doesn't work (some browsers block it), redirect
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 100);
    });
    
    document.getElementById('roamButton')?.addEventListener('click', () => {
      // Hide all overlays and let player roam
      finalPopup.style.display = 'none';
      document.getElementById('statsOverlay').style.display = 'none';
      document.getElementById('fadeOverlay').style.opacity = '0';
      document.getElementById('fadeOverlay').style.pointerEvents = 'none';
      // Keep endingTriggered = true so it doesn't re-trigger
    });
  };

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
            // Debug: Log which wall mesh is being collided with
            console.log('Wall collision detected with mesh:', collider.name || 'unnamed', 'at position:', collider.position);
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

    // Check proximity to objects for dialogue hints
    checkProximity();

    // Activate wall glow when all tables visited
    if (window.glowPlane && window.tablesVisited >= TOTAL_TABLES) {
      // Subtle pulsing opacity
      const pulseIntensity = 0.15 + Math.sin(t * 0.003) * 0.1;
      window.glowPlane.material.opacity = pulseIntensity;
      
      // Subtle point light
      if (window.endingGlowLight) {
        window.endingGlowLight.intensity = pulseIntensity * 3;
      }
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
