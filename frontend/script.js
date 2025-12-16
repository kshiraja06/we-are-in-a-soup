let canvas, ctx;
const base=560;
let dpr=Math.max(window.devicePixelRatio||1,1);

function circleParams(){const cx=base/2,cy=base/2,r=(base/2)-6;return {cx,cy,r}}

function drawBowlOutline(){
  const {cx,cy,r}=circleParams();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
}

function initializeCanvas(){
  canvas=document.getElementById("paintCanvas");
  ctx=canvas.getContext("2d");
  dpr=Math.max(window.devicePixelRatio||1,1);
  canvas.width=base*dpr; canvas.height=base*dpr; canvas.style.width=base+"px"; canvas.style.height=base+"px"; ctx.scale(dpr,dpr);
  drawBowlOutline();
}

document.addEventListener('DOMContentLoaded', function() {
  initializeCanvas();

let brushSize=12, brushColor="#6b4f9a", mode="brush";
let painting=false, last={x:0,y:0};
const paletteColors=["#3b3b3b","#ff6b6b","#ffb86b","#ffd97a","#7bd389","#5fb3ff","#9b7bff","#ffc0cb","#8b5a2b","#ffffff","#c5d6ff","#f6e7ff"];
const pal=document.getElementById("palette");
paletteColors.forEach(c=>{const s=document.createElement("div");s.className="pal-swatch";s.style.background=c;s.addEventListener("click",()=>{brushColor=c; document.getElementById("sizeVal").textContent=brushSize});pal.appendChild(s)});

const sizeRange=document.getElementById("sizeRange");
const sizeVal=document.getElementById("sizeVal");
sizeRange.addEventListener("input",e=>{brushSize=e.target.value;sizeVal.textContent=brushSize});

const colorWheel=document.getElementById("colorWheel");
if(colorWheel) colorWheel.addEventListener("input",e=>{brushColor=e.target.value;});

function posFromEvent(e){
  const r=canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {x: clientX - r.left, y: clientY - r.top};
}

function begin(e){
  console.log('Begin called, mode:', mode);
  painting=true;
  const p=posFromEvent(e);
  last.x=p.x; last.y=p.y;
  ctx.beginPath();
  ctx.moveTo(last.x,last.y);
  if(mode==="fill"){applyFakeFill(); painting=false}
}

function end(){painting=false;ctx.beginPath()}

function draw(e){
  console.log('Draw called, painting:', painting, 'mode:', mode);
  if(!painting||mode==="fill")return;
  const p=posFromEvent(e);
  const {cx,cy,r}=circleParams();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  ctx.lineWidth=brushSize; ctx.lineCap="round";
  ctx.strokeStyle = (mode==="eraser") ? "#ffffff" : brushColor;
  ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke();
  ctx.restore();
  last.x=p.x; last.y=p.y;
}

function applyFakeFill(){
  const {cx,cy,r}=circleParams();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  ctx.fillStyle = brushColor;
  ctx.fillRect(cx-r,cy-r,r*2,r*2);
  ctx.restore();
}

canvas.addEventListener("mousedown",begin);
canvas.addEventListener("touchstart",e=>{e.preventDefault();begin(e)},{passive:false});
window.addEventListener("mouseup",end);
canvas.addEventListener("touchend",end);
canvas.addEventListener("mousemove",draw);
canvas.addEventListener("touchmove",e=>{e.preventDefault();draw(e)},{passive:false});

console.log('Canvas event listeners attached to canvas:', canvas);

document.getElementById("brushTool").addEventListener("click",()=>{mode="brush"});
document.getElementById("eraserTool").addEventListener("click",()=>{mode="eraser"});
document.getElementById("fillTool").addEventListener("click",()=>{mode="fill"});
document.getElementById("clearBtn").addEventListener("click",()=>{
  ctx.clearRect(0,0,base,base);
  drawBowlOutline();
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const canvas = document.getElementById('paintCanvas');
  const statusbar = document.querySelector('.statusbar');
  const saveBtn = document.getElementById('saveBtn');
  
  // Update status
  if (statusbar) statusbar.textContent = 'Saving...';
  saveBtn.disabled = true;
  
  const imageData = canvas.toDataURL('image/png');
  const name = prompt('Name your soup painting:');
  
  if (!name) {
    if (statusbar) statusbar.textContent = 'Ready';
    saveBtn.disabled = false;
    return;
  }
  
  try {
    const response = await fetch('/api/paintings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, name })
    });
    
    if (!response.ok) {
      let errorData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: `Server error: ${response.status}` };
        }
      } else {
        const text = await response.text();
        errorData = { 
          message: text.includes('MongoDB') || text.includes('Database') 
            ? 'Database not configured. Please set MONGODB_URI in Vercel environment variables.'
            : `Server error: ${response.status}`
        };
      }
      throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
    }
    
    const result = await response.json();
    if (statusbar) statusbar.textContent = 'Painting saved!';
    alert('Painting saved successfully!');
    
    // Reload gallery after saving
    loadGallery();
    
    // Reset status after 2 seconds
    setTimeout(() => {
      if (statusbar) statusbar.textContent = 'Ready';
    }, 2000);
  } catch (error) {
    console.error('Error saving painting:', error);
    if (statusbar) statusbar.textContent = 'Error: ' + error.message;
    alert('Error saving: ' + error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

async function loadGallery() {
  try {
    console.log('loadGallery() called at startup');
    const response = await fetch('/api/paintings?t=' + Date.now());
    console.log('Fetch response status:', response.status);
    
    if (!response.ok) {
      let errorData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: `Server error: ${response.status}` };
        }
      } else {
        // Server returned HTML or other non-JSON response
        const text = await response.text();
        console.error('Non-JSON error response:', text.substring(0, 200));
        errorData = { 
          message: text.includes('MongoDB') || text.includes('Database') 
            ? 'Database not configured. Please set MONGODB_URI in Vercel environment variables.'
            : `Server error: ${response.status}. Please check server configuration.`
        };
      }
      console.error('Error loading gallery:', errorData);
      
      // Show error in gallery if it's open
      const galleryGrid = document.getElementById('galleryGrid');
      if (galleryGrid) {
        galleryGrid.innerHTML = `<div style='color:#f77;padding:12px'>Error: ${errorData.message || errorData.error || 'Failed to load gallery'}</div>`;
      }
      return;
    }
    
    const paintings = await response.json();
    console.log('Paintings loaded in loadGallery():', paintings.length, paintings);
    
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) {
      console.log('galleryGrid element not found on startup');
      return;
    }
    
    galleryGrid.innerHTML = '';
    
    if (paintings.length === 0) {
      console.log('No paintings in loadGallery, showing empty message');
      galleryGrid.innerHTML = "<div style='color:#777;padding:12px'>No soups saved yet. Paint something and click Save!</div>";
      return;
    }
    
    console.log('Adding', paintings.length, 'paintings to initial gallery');
    paintings.forEach((painting, idx) => {
      const box = document.createElement('div');
      box.className = 'thumb';
      const img = document.createElement('img');
      img.src = painting.imageData;
      img.alt = painting.name;
      const nameEl = document.createElement('div');
      nameEl.className = 'thumb-name';
      nameEl.textContent = painting.name + (painting.type === 'bowl' ? ' (Bowl)' : '');
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'tool';
      downloadBtn.textContent = 'Download';
      downloadBtn.style.width = '100%';
      downloadBtn.style.marginTop = '4px';
      downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = painting.imageData;
        link.download = painting.name + '.png';
        link.click();
      });
      box.appendChild(img);
      box.appendChild(nameEl);
      box.appendChild(downloadBtn);
      galleryGrid.appendChild(box);
    });
    console.log('loadGallery() complete - initial gallery populated');
  } catch (error) {
    console.error('Error loading gallery:', error);
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
      galleryGrid.innerHTML = `<div style='color:#f77;padding:12px'>Error loading gallery: ${error.message}</div>`;
    }
  }
}

// Load on startup
loadGallery();

function drawBowlOutline(){
  const {cx,cy,r}=circleParams();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
}

document.getElementById("galleryBtn").addEventListener("click",openGallery);
async function openGallery(){
  console.log('Gallery opened');
  const modal=document.getElementById("galleryModal");
  const galleryGrid=document.getElementById("galleryGrid");

  // Show modal immediately with loading message
  if (modal) {
    modal.classList.remove("hidden");
  }
  if (galleryGrid) {
    galleryGrid.innerHTML = "<div class='gallery-loading'>Loading soups… please wait…</div>";
  }

  try {
    const response = await fetch('/api/paintings?t=' + Date.now());
    console.log('Response status:', response.status, response.ok);
    
    if (!response.ok) {
      let errorData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: `Server error: ${response.status}` };
        }
      } else {
        // Server returned HTML or other non-JSON response
        const text = await response.text();
        console.error('Non-JSON error response:', text.substring(0, 200));
        errorData = { 
          message: text.includes('MongoDB') || text.includes('Database') 
            ? 'Database connection issue. Please check MONGODB_URI environment variable.' 
            : `Server error: ${response.status}. Please check server configuration.`
        };
      }
      console.error('Error loading gallery:', errorData);
      if (galleryGrid) {
        galleryGrid.innerHTML="<div style='color:#f77;padding:12px'>Error loading gallery: " + (errorData.message || 'Unknown error') + "</div>";
      }
      return;
    }
    
    const paintings = await response.json();
    console.log('Paintings received in openGallery:', paintings.length, paintings);
    
    if (!galleryGrid) {
      return;
    }

    galleryGrid.innerHTML = '';
    console.log('Gallery grid cleared');
    
    if(!paintings.length) {
      console.log('No paintings found');
      galleryGrid.innerHTML="<div style='color:#777;padding:12px'>No soups saved yet.</div>";
      return;
    }
    
    console.log('Adding', paintings.length, 'paintings to gallery');
    paintings.forEach((painting, index) => {
      console.log('Adding painting', index, ':', painting.name);
      const box=document.createElement("div"); 
      box.className="thumb";
      const img=document.createElement("img"); 
      img.src=painting.imageData;
      img.alt=painting.name;
      const nameEl=document.createElement("div");
      nameEl.className="thumb-name";
      nameEl.textContent=painting.name + (painting.type === 'bowl' ? ' (Bowl)' : '');
      const downloadBtn=document.createElement("button");
      downloadBtn.className="tool";
      downloadBtn.textContent="Download";
      downloadBtn.style.width="100%";
      downloadBtn.style.marginTop="4px";
      downloadBtn.addEventListener("click",()=>{
        const link=document.createElement("a");
        link.href=painting.imageData;
        link.download=painting.name+".png";
        link.click();
      });
      box.appendChild(img);
      box.appendChild(nameEl);
      box.appendChild(downloadBtn);
      galleryGrid.appendChild(box);
    });
    console.log('All paintings added to DOM');
    
  } catch (error) {
    console.error('Error loading gallery:', error);
    if (galleryGrid) {
      galleryGrid.innerHTML="<div style='color:#f77;padding:12px'>Error loading gallery: " + error.message + "</div>";
    }
  }
}
document.getElementById("closeGallery").addEventListener("click",()=>{const modal=document.getElementById("galleryModal"); modal.classList.add("hidden");});

// Bowl Gallery Functions
async function loadBowlGallery() {
  try {
    const response = await fetch('/api/paintings?t=' + Date.now());
    if (!response.ok) return;
    
    const paintings = await response.json();
    const bowlGalleryGrid = document.getElementById('bowlGalleryGrid');
    if (!bowlGalleryGrid) return;
    
    // Filter only bowl-type paintings
    const bowls = paintings.filter(p => p.type === 'bowl');
    bowlGalleryGrid.innerHTML = '';
    
    if (bowls.length === 0) {
      bowlGalleryGrid.innerHTML = "<div style='color:#777;padding:12px'>No bowls saved yet. Paint a bowl and save it!</div>";
      return;
    }
    
    bowls.forEach((bowl) => {
      const box = document.createElement('div');
      box.className = 'thumb';
      const img = document.createElement('img');
      img.src = bowl.imageData;
      img.alt = bowl.name;
      const nameEl = document.createElement('div');
      nameEl.className = 'thumb-name';
      nameEl.textContent = bowl.name;
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'tool';
      downloadBtn.textContent = 'Download';
      downloadBtn.style.width = '100%';
      downloadBtn.style.marginTop = '4px';
      downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = bowl.imageData;
        link.download = bowl.name + '.png';
        link.click();
      });
      box.appendChild(img);
      box.appendChild(nameEl);
      box.appendChild(downloadBtn);
      bowlGalleryGrid.appendChild(box);
    });
  } catch (error) {
    console.error('Error loading bowl gallery:', error);
  }
}

function openBowlGallery() {
  const modal = document.getElementById("bowlGalleryModal");
  if (modal) {
    modal.classList.remove("hidden");
    loadBowlGallery();
  }
}

document.getElementById("closeBowlGallery")?.addEventListener("click", () => {
  const modal = document.getElementById("bowlGalleryModal");
  if (modal) {
    modal.classList.add("hidden");
  }
});

document.getElementById("minBtn").addEventListener("click",()=>{ const w=document.getElementById("paintWindow"); w.style.display = (w.style.display==="none") ? "flex" : "none"; });
document.getElementById("maxBtn").addEventListener("click",()=>{
  const w=document.querySelector(".win");
  if(!w.classList.contains("max")){ w.style.position="fixed"; w.style.left="12px"; w.style.top="12px"; w.style.width="calc(100vw - 24px)"; w.style.height="calc(100vh - 24px)"; w.classList.add("max");
  } else { w.style.width="880px"; w.style.height=""; w.style.left=""; w.style.top=""; w.style.position=""; w.classList.remove("max"); }
});
document.getElementById("closeBtn").addEventListener("click",()=>{
  const paintWindow = document.getElementById("paintWindow");
  if (paintWindow) {
    paintWindow.style.display = "none";
    paintWindow.classList.add("hidden-init");
  }
});

let drag=false,off={x:0,y:0};
const win=document.querySelector(".win"); const title=document.querySelector(".titlebar");
title.addEventListener("mousedown",(e)=>{ if(e.target.closest(".tbtn")) return; drag=true; const r=win.getBoundingClientRect(); off.x=e.clientX-r.left; off.y=e.clientY-r.top; win.style.transition="none";});
window.addEventListener("mousemove",(e)=>{ if(!drag) return; win.style.left=(e.clientX-off.x)+"px"; win.style.top=(e.clientY-off.y)+"px"; win.style.position="fixed";});
window.addEventListener("mouseup",()=>{ drag=false; win.style.transition="box-shadow .2s";});

// Expose initializeCanvas globally for script2.js
window.initializeCanvas = initializeCanvas;

// Glazing System - Paint directly on 3D bowl
let glazing3DRenderer, glazing3DScene, glazing3DCamera, glazing3DBowl;
let glazingBrushSize = 12, glazingBrushColor = "#6b4f9a", glazingMode = "brush";
let glazingPainting = false;
let glazingRaycaster = new THREE.Raycaster();
let glazingPointer = new THREE.Vector2();
const TOTAL_TABLES = 9; // Total number of tables to visit
let tablesVisited = 0; // Track how many tables user has visited

function initializeGlazing() {
  const glazingCanvas = document.getElementById("glazing3DCanvas");
  if (!glazingCanvas) return;
  
  const THREE = window.THREE;
  if (!THREE) {
    console.error("THREE.js not available for glazing");
    return;
  }
  
  // Create 3D renderer for glazing window
  glazing3DRenderer = new THREE.WebGLRenderer({ canvas: glazingCanvas, antialias: true });
  glazing3DRenderer.setSize(580, 580);
  glazing3DRenderer.shadowMap.enabled = true;
  
  // Create scene
  glazing3DScene = new THREE.Scene();
  glazing3DScene.background = new THREE.Color(0xf5f5f5);
  
  // Create camera - position at an angle to show 3D shape better (adjusted for larger bowl)
  glazing3DCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  glazing3DCamera.position.set(4, 3, 5); // Moved back and up for larger bowl
  glazing3DCamera.lookAt(0, 0.5, 0); // Look slightly higher to center bowl
  
  // Create bowl for glazing view - use texture from main bowl if available, otherwise create new
  // Make it bigger and taller for better painting visibility
  // Use LatheGeometry to match the main bowl shape
  const points = [];
  points.push(new THREE.Vector2(1.2, 0.0));   // Top rim, wider
  points.push(new THREE.Vector2(1.125, 0.225)); // Curve down
  points.push(new THREE.Vector2(0.9, 0.6));   // Bowl wall
  points.push(new THREE.Vector2(0.75, 0.9));   // More curve
  points.push(new THREE.Vector2(0.675, 1.125)); // Lower curve
  points.push(new THREE.Vector2(0.6, 1.425));  // Bottom, narrow
  
  const bowlGeometry = new THREE.LatheGeometry(points, 32);
  
  let textureCanvas, textureCtx, texture;
  
  // Use main bowl's texture if available, otherwise create new
  if (window.glazingBowl && window.glazingBowl.userData.textureCanvas) {
    textureCanvas = window.glazingBowl.userData.textureCanvas;
    textureCtx = window.glazingBowl.userData.textureContext;
    texture = window.glazingBowl.userData.texture;
  } else {
    // Create new texture
    const textureSize = 512;
    textureCanvas = document.createElement('canvas');
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    textureCtx = textureCanvas.getContext('2d');
    // Fill with cream ceramic color
    textureCtx.fillStyle = '#d4c5a9';
    textureCtx.fillRect(0, 0, textureSize, textureSize);
    // Add blue stripe at top
    textureCtx.fillStyle = '#1e3a8a';
    textureCtx.fillRect(0, 0, textureSize, textureSize * 0.15);
    
    texture = new THREE.CanvasTexture(textureCanvas);
    texture.needsUpdate = true;
  }
  
  // Ceramic material - not metallic
  const bowlMaterial = new THREE.MeshStandardMaterial({ 
    map: texture,
    roughness: 0.5,  // Ceramic is semi-gloss
    metalness: 0.0   // No metalness
  });
  
  glazing3DBowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
  glazing3DBowl.rotation.x = Math.PI; // Flip bowl right-side up
  glazing3DBowl.userData.textureCanvas = textureCanvas;
  glazing3DBowl.userData.textureContext = textureCtx;
  glazing3DBowl.userData.texture = texture;
  glazing3DScene.add(glazing3DBowl);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  glazing3DScene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight.position.set(5, 5, 5);
  glazing3DScene.add(directionalLight);
  
  // Sync texture with main bowl
  window.glazing3DBowl = glazing3DBowl; // Make accessible
  
  // Load saved bowl texture if it exists
  const savedBowl = localStorage.getItem('glazedBowl');
  if (savedBowl) {
    const img = new Image();
    img.onload = () => {
      textureCtx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
      textureCtx.drawImage(img, 0, 0);
      texture.needsUpdate = true;
      
      // Also update main bowl if it exists
      if (window.glazingBowl && window.glazingBowl.userData.textureContext) {
        const mainCtx = window.glazingBowl.userData.textureContext;
        const mainCanvas = window.glazingBowl.userData.textureCanvas;
        const mainTexture = window.glazingBowl.userData.texture;
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        mainCtx.drawImage(img, 0, 0);
        mainTexture.needsUpdate = true;
      }
    };
    img.src = savedBowl;
  }
  
  // Initialize palette
  const glazingPal = document.getElementById("glazingPalette");
  if (glazingPal && glazingPal.children.length === 0) {
    paletteColors.forEach(c => {
      const s = document.createElement("div");
      s.className = "pal-swatch";
      s.style.background = c;
      s.addEventListener("click", () => {
        glazingBrushColor = c;
      });
      glazingPal.appendChild(s);
    });
  }
  
  // Setup controls
  const glazingSizeRange = document.getElementById("glazingSizeRange");
  const glazingSizeVal = document.getElementById("glazingSizeVal");
  if (glazingSizeRange && glazingSizeVal) {
    glazingSizeRange.addEventListener("input", e => {
      glazingBrushSize = e.target.value;
      glazingSizeVal.textContent = glazingBrushSize;
    });
  }
  
  const glazingColorWheel = document.getElementById("glazingColorWheel");
  if (glazingColorWheel) {
    glazingColorWheel.addEventListener("input", e => {
      glazingBrushColor = e.target.value;
    });
  }
  
  // Setup tool buttons
  document.getElementById("glazingBrushTool")?.addEventListener("click", () => {
    glazingMode = "brush";
    updateGlazingStatus("Brush tool selected - Paint on the 3D bowl");
  });
  
  document.getElementById("glazingEraserTool")?.addEventListener("click", () => {
    glazingMode = "eraser";
    updateGlazingStatus("Eraser tool selected");
  });
  
  document.getElementById("glazingClearBtn")?.addEventListener("click", () => {
    clearBowlTexture();
    updateGlazingStatus("Bowl cleared");
  });
  
  document.getElementById("glazingSaveBtn")?.addEventListener("click", () => {
    saveBowl();
  });
  
  document.getElementById("glazingGalleryBtn")?.addEventListener("click", () => {
    openBowlGallery();
  });
  
  // 3D canvas painting handlers - paint on the bowl texture
  glazingCanvas.addEventListener("mousedown", beginGlazing3D);
  glazingCanvas.addEventListener("mousemove", continueGlazing3D);
  glazingCanvas.addEventListener("mouseup", endGlazing3D);
  glazingCanvas.addEventListener("touchstart", beginGlazing3D);
  glazingCanvas.addEventListener("touchmove", continueGlazing3D);
  glazingCanvas.addEventListener("touchend", endGlazing3D);
  
  // Start render loop
  animateGlazing();
  
  // Window controls
  document.getElementById("glazingMinBtn")?.addEventListener("click", () => {
    const w = document.getElementById("glazingWindow");
    if (w) w.style.display = (w.style.display === "none") ? "flex" : "none";
  });
  
  document.getElementById("glazingMaxBtn")?.addEventListener("click", () => {
    const w = document.getElementById("glazingWindow");
    if (!w) return;
    if (!w.classList.contains("max")) {
      w.style.position = "fixed";
      w.style.left = "12px";
      w.style.top = "12px";
      w.style.width = "calc(100vw - 24px)";
      w.style.height = "calc(100vh - 24px)";
      w.classList.add("max");
    } else {
      w.style.width = "880px";
      w.style.height = "";
      w.style.left = "";
      w.style.top = "";
      w.style.position = "";
      w.classList.remove("max");
    }
  });
  
  document.getElementById("glazingCloseBtn")?.addEventListener("click", () => {
    const glazingWindow = document.getElementById("glazingWindow");
    if (glazingWindow) {
      glazingWindow.style.display = "none";
      glazingWindow.classList.add("hidden-init");
    }
  });
  
  // Make glazing window draggable
  const glazingWin = document.getElementById("glazingWindow");
  const glazingTitle = glazingWin?.querySelector(".titlebar");
  let glazingDrag = false, glazingOff = {x: 0, y: 0};
  
  if (glazingTitle) {
    glazingTitle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".tbtn")) return;
      glazingDrag = true;
      const r = glazingWin.getBoundingClientRect();
      glazingOff.x = e.clientX - r.left;
      glazingOff.y = e.clientY - r.top;
      glazingWin.style.transition = "none";
    });
  }
  
  window.addEventListener("mousemove", (e) => {
    if (!glazingDrag || !glazingWin) return;
    glazingWin.style.left = (e.clientX - glazingOff.x) + "px";
    glazingWin.style.top = (e.clientY - glazingOff.y) + "px";
    glazingWin.style.position = "fixed";
  });
  
  window.addEventListener("mouseup", () => {
    glazingDrag = false;
    if (glazingWin) glazingWin.style.transition = "box-shadow .2s";
  });
  
  updateTableProgress();
  updateGlazingStatus("Paint directly on the 3D bowl. Visit other tables to progress.");
}

// 3D Texture Painting Functions
function paintOnBowlTexture(uv, color, size) {
  if (!glazing3DBowl || !glazing3DBowl.userData.textureContext) return;
  
  const ctx = glazing3DBowl.userData.textureContext;
  const canvas = glazing3DBowl.userData.textureCanvas;
  const texture = glazing3DBowl.userData.texture;
  
  // Convert UV coordinates (0-1) to pixel coordinates
  const x = uv.x * canvas.width;
  const y = (1 - uv.y) * canvas.height; // Flip Y for canvas coordinate system
  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Update texture
  texture.needsUpdate = true;
  
  // Also update main bowl texture if it exists
  if (window.glazingBowl && window.glazingBowl.userData.texture) {
    const mainCtx = window.glazingBowl.userData.textureContext;
    const mainCanvas = window.glazingBowl.userData.textureCanvas;
    const mainTexture = window.glazingBowl.userData.texture;
    
    mainCtx.fillStyle = color;
    mainCtx.beginPath();
    mainCtx.arc(uv.x * mainCanvas.width, (1 - uv.y) * mainCanvas.height, size / 2, 0, Math.PI * 2);
    mainCtx.fill();
    mainTexture.needsUpdate = true;
  }
}

function eraseOnBowlTexture(uv, size) {
  if (!glazing3DBowl || !glazing3DBowl.userData.textureContext) return;
  
  const ctx = glazing3DBowl.userData.textureContext;
  const canvas = glazing3DBowl.userData.textureCanvas;
  const texture = glazing3DBowl.userData.texture;
  
  const x = uv.x * canvas.width;
  const y = (1 - uv.y) * canvas.height;
  
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  
  texture.needsUpdate = true;
  
  // Also update main bowl
  if (window.glazingBowl && window.glazingBowl.userData.texture) {
    const mainCtx = window.glazingBowl.userData.textureContext;
    const mainCanvas = window.glazingBowl.userData.textureCanvas;
    const mainTexture = window.glazingBowl.userData.texture;
    
    mainCtx.globalCompositeOperation = 'destination-out';
    mainCtx.beginPath();
    mainCtx.arc(uv.x * mainCanvas.width, (1 - uv.y) * mainCanvas.height, size / 2, 0, Math.PI * 2);
    mainCtx.fill();
    mainCtx.globalCompositeOperation = 'source-over';
    mainTexture.needsUpdate = true;
  }
}

function getUVFromMouse(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  
  glazingPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  glazingPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  
  glazingRaycaster.setFromCamera(glazingPointer, glazing3DCamera);
  const intersects = glazingRaycaster.intersectObject(glazing3DBowl);
  
  if (intersects.length > 0) {
    return intersects[0].uv;
  }
  return null;
}

function beginGlazing3D(e) {
  if (glazingPainting) return;
  const uv = getUVFromMouse(e, glazing3DRenderer.domElement);
  if (!uv) return;
  
  glazingPainting = true;
  if (glazingMode === "eraser") {
    eraseOnBowlTexture(uv, glazingBrushSize);
  } else {
    paintOnBowlTexture(uv, glazingBrushColor, glazingBrushSize);
  }
}

function continueGlazing3D(e) {
  if (!glazingPainting) return;
  e.preventDefault();
  const uv = getUVFromMouse(e, glazing3DRenderer.domElement);
  if (!uv) return;
  
  if (glazingMode === "eraser") {
    eraseOnBowlTexture(uv, glazingBrushSize);
  } else {
    paintOnBowlTexture(uv, glazingBrushColor, glazingBrushSize);
  }
}

function endGlazing3D() {
  glazingPainting = false;
}

function animateGlazing() {
  if (!glazing3DRenderer || !glazing3DScene || !glazing3DCamera) return;
  
  // Rotate the bowl slowly to show it's 3D
  if (glazing3DBowl) {
    glazing3DBowl.rotation.y += 0.005; // Slow rotation
  }
  
  requestAnimationFrame(animateGlazing);
  glazing3DRenderer.render(glazing3DScene, glazing3DCamera);
}

function clearBowlTexture() {
  if (!glazing3DBowl || !glazing3DBowl.userData.textureContext) return;
  
  const ctx = glazing3DBowl.userData.textureContext;
  const canvas = glazing3DBowl.userData.textureCanvas;
  const texture = glazing3DBowl.userData.texture;
  
  ctx.fillStyle = '#e8d5b7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  texture.needsUpdate = true;
  
  // Also clear main bowl
  if (window.glazingBowl && window.glazingBowl.userData.texture) {
    const mainCtx = window.glazingBowl.userData.textureContext;
    const mainCanvas = window.glazingBowl.userData.textureCanvas;
    const mainTexture = window.glazingBowl.userData.texture;
    
    // Clear with cream ceramic color
    mainCtx.fillStyle = '#d4c5a9';
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    // Add blue stripe at top
    mainCtx.fillStyle = '#1e3a8a';
    mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height * 0.15);
    mainTexture.needsUpdate = true;
  }
}

function updateGlazingStatus(message) {
  const status = document.getElementById("glazingStatus");
  if (status) {
    status.textContent = message;
  }
}

async function saveBowl() {
  if (!glazing3DBowl) {
    updateGlazingStatus("Error: Bowl not found");
    return;
  }
  
  const statusbar = document.getElementById("glazingStatus");
  const saveBtn = document.getElementById("glazingSaveBtn");
  
  // Update status
  if (statusbar) statusbar.textContent = 'Rendering bowl...';
  if (saveBtn) saveBtn.disabled = true;
  
  const name = prompt('Name your bowl:');
  
  if (!name) {
    if (statusbar) statusbar.textContent = 'Ready';
    if (saveBtn) saveBtn.disabled = false;
    return;
  }
  
  try {
    // Create a temporary canvas for rendering the 3D bowl
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 512;
    tempCanvas.height = 512;
    
    // Create a temporary 3D scene for rendering
    const tempRenderer = new THREE.WebGLRenderer({ canvas: tempCanvas, antialias: true, alpha: true });
    tempRenderer.setSize(512, 512);
    const tempScene = new THREE.Scene();
    tempScene.background = new THREE.Color(0xd4c5a9); // Ceramic cream background
    
    // Create camera for nice bowl view
    const tempCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    tempCamera.position.set(3, 2, 3);
    tempCamera.lookAt(0, 0, 0);
    
    // Clone the bowl for rendering
    const bowlGeometry = glazing3DBowl.geometry.clone();
    const bowlMaterial = glazing3DBowl.material.clone();
    const tempBowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
    tempScene.add(tempBowl);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    tempScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 5, 5);
    tempScene.add(directionalLight);
    
    // Render the bowl
    tempRenderer.render(tempScene, tempCamera);
    
    // Get canvas image data
    const imageData = tempCanvas.toDataURL('image/png');
    
    // Clean up
    tempRenderer.dispose();
    tempBowl.geometry.dispose();
    tempBowl.material.dispose();
    
    // Update status
    if (statusbar) statusbar.textContent = 'Saving bowl...';
    
    // Send to server
    const response = await fetch('/api/paintings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, name, type: 'bowl' })
    });
    
    if (!response.ok) {
      let errorData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: `Server error: ${response.status}` };
        }
      } else {
        const text = await response.text();
        errorData = { 
          message: text.includes('MongoDB') || text.includes('Database') 
            ? 'Database not configured. Please set MONGODB_URI in Vercel environment variables.'
            : `Server error: ${response.status}`
        };
      }
      throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
    }
    
    const result = await response.json();
    if (statusbar) statusbar.textContent = 'Bowl saved!';
    alert('Bowl saved successfully!');
    
    // Reload bowl gallery after saving
    loadBowlGallery();
    
    // Reset status after 2 seconds
    setTimeout(() => {
      if (statusbar) statusbar.textContent = 'Ready';
    }, 2000);
  } catch (error) {
    console.error('Error saving bowl:', error);
    if (statusbar) statusbar.textContent = 'Error: ' + error.message;
    alert('Error saving: ' + error.message);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}



// Function to update table progress overlay (called from script2.js)
function updateTableProgress() {
  const progressBar = document.getElementById("tableProgressBar");
  const progressText = document.getElementById("tableProgressText");
  
  if (!progressBar || !progressText) return;
  
  const visited = window.tablesVisited || 0;
  const total = window.TOTAL_TABLES || 2;
  const percent = (visited / total) * 100;
  
  progressBar.style.width = percent + "%";
  progressText.textContent = `${visited} / ${total} tables visited`;
}

// Expose functions globally
window.initializeGlazing = initializeGlazing;
window.updateTableProgress = updateTableProgress;
});
