(async () => {
  const THREE = window.THREE;
  
  if (!THREE) {
    console.error('Three.js not loaded');
    return;
  }
  
  console.log('THREE loaded');
  
  const canvas = document.getElementById('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2f33);

  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
  scene.add(camera);

  const ROOM_W = 20, ROOM_H = 6, ROOM_D = 20;
  const halfW = ROOM_W / 2, halfD = ROOM_D / 2;
  const eyeHeight = 1.5, playerRadius = 0.3, speed = 3;
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

  const hemi = new THREE.HemisphereLight("white", 0xffffff, 0.6);
  hemi.position.set(0, ROOM_H, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  scene.add(dir);


  let model;
  let modelCollisionRadius = 1.5; // Default fallback radius
  try {
    // Try to get GLTFLoader - it might be exposed different ways
    let GLTFLoaderClass = window.THREE?.GLTFLoader || window.GLTFLoader;
    
    if (!GLTFLoaderClass) {
      throw new Error('GLTFLoader not available');
    }
    
    const loader = new GLTFLoaderClass();
    const assetPath = './assets/claytable.glb';
    console.log('Attempting to load GLB from:', assetPath);
    const gltf = await new Promise((resolve, reject) => {
      loader.load(assetPath, resolve, undefined, reject);
    });
    model = gltf.scene;
    console.log('Model loaded successfully:', model);
    model.position.set(10, -1.3, -5);
    model.scale.set(0.4, 0.4, 0.4);
    model.name = 'SoupBowl';
    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material.roughness = 0.6;
        child.material.metalness = 0.1;
      }
    });
    scene.add(model);
    console.log('Model added to scene');
    
    // Compute bounding box for collision detection
    const box = new THREE.Box3().setFromObject(model);
    const modelSize = box.getSize(new THREE.Vector3());
    modelCollisionRadius = Math.max(modelSize.x, modelSize.z) / 2;
    console.log('Model collision radius:', modelCollisionRadius);
  } catch (error) {
    console.error('Failed to load GLB model:', error);
    console.error('Error details:', error.message, error.stack);
    const deskGeometry = new THREE.BoxGeometry(2.5, 1, 1.5);
    const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.position.set(0, 0.5, 0);
    desk.castShadow = true;
    scene.add(desk);

    const bowlRadius = 0.4;
    const bowlGeometry = new THREE.SphereGeometry(bowlRadius, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const bowlMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
    model = new THREE.Mesh(bowlGeometry, bowlMaterial);
    model.position.set(0, 1, 0);
    model.rotation.x = -Math.PI;
    model.name = 'SoupBowl';
    model.castShadow = true;
    scene.add(model);
    console.log('Using fallback procedural bowl');
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactableObjects = [model];

  function openSoupPainter() {
    const painterWindow = document.getElementById('paintWindow');
    if (painterWindow) {
      painterWindow.style.display = 'flex';
      painterWindow.classList.remove('hidden-init');
      
      // Reinitialize canvas after a brief delay to ensure DOM is ready
      setTimeout(() => {
        if (window.initializeCanvas) {
          window.initializeCanvas();
        }
      }, 10);
    }
  }

  function onClick(event) {
    console.log(pointer.x,pointer.y,pointer.z);
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);
    
    if (intersects.length > 0) {
        openSoupPainter();
    }
  }
  
  const player = new THREE.Vector3(8, eyeHeight, 8);
  camera.position.copy(player);

  const keys = {
    forward: false,
    back: false,
    left: false,
    right: false,
    panUp: false,
    panDown: false,
    panLeft: false,
    panRight: false
  };

  const keyMap = {
    KeyW: 'forward',
    KeyS: 'back',
    KeyA: 'left',
    KeyD: 'right',
    ArrowUp: 'panDown',
    ArrowDown: 'panUp',
    ArrowLeft: 'panLeft',
    ArrowRight: 'panRight'
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


  const sensitivity = 0.002;
  let isDown = false;
  let lastX = 0, 
  lastY = 0;

  function pointerMove(e) {
    if (document.getElementById('paintWindow').style.display === 'flex') return;
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

  canvas.addEventListener('click', onClick);
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
  let lastCollisionTime = 0;
  let collisionCount = 0;

  function animate(t) {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;
    
    // Debug: Log model status every frame (first 5 frames only)
    if (collisionCount < 5) {
      console.log(`Frame ${collisionCount}: Model=${!!model}, Radius=${modelCollisionRadius}, Forward/Strafe will be checked`);
    }

    if (document.getElementById('paintWindow').style.display === 'flex') {
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
        return; 
    }

    if (keys.panUp) pitch -= 1.8 * dt;
    if (keys.panDown) pitch += 1.8 * dt;
    if (keys.panLeft) yaw += 1.8 * dt;
    if (keys.panRight) yaw -= 1.8 * dt;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

    const forward = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const strafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    if (forward || strafe) {
      console.log(`🔵 MOVEMENT: forward=${forward}, strafe=${strafe}, model=${!!model}`);
      const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
      const vx = (sinY * -forward + cosY * strafe) * speed * dt;
      const vz = (cosY * -forward - sinY * strafe) * speed * dt;
      const next = player.clone();
      next.x += vx;
      next.z += vz;
      clamp(next);
      
      // Collision detection with model - prevent walking through it
      if (!model) {
        console.warn('⚠️ Model not defined yet, skipping collision');
        player.x = next.x;
        player.z = next.z;
      } else {
        const modelPos = model.position.clone();
        // Only check horizontal distance (X and Z), ignore height (Y)
        const distToModel = Math.sqrt((next.x - modelPos.x) ** 2 + (next.z - modelPos.z) ** 2);
        const collisionThreshold = modelCollisionRadius + playerRadius;
        
        if (distToModel > collisionThreshold) {
          player.x = next.x;
          player.z = next.z;
        } else {
          collisionCount++;
          const now = performance.now();
          if (now - lastCollisionTime > 1000) { // Log collision every 1 second max
            console.log(`🔴 COLLISION #${collisionCount}! Distance: ${distToModel.toFixed(2)} | Threshold: ${collisionThreshold.toFixed(2)} | Player: (${player.x.toFixed(1)}, ${player.z.toFixed(1)}) | Model: (${modelPos.x.toFixed(1)}, ${modelPos.z.toFixed(1)}) | Trying to move to: (${next.x.toFixed(1)}, ${next.z.toFixed(1)})`);
            lastCollisionTime = now;
          }
        }
      }
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
