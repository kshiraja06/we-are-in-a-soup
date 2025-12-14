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
    const response = await fetch('/api/paintings');
    
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
    
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = '';
    
    if (paintings.length === 0) {
      galleryGrid.innerHTML = "<div style='color:#777;padding:12px'>No soups saved yet. Paint something and click Save!</div>";
      return;
    }
    
    paintings.forEach(painting => {
      const box = document.createElement('div');
      box.className = 'thumb';
      const img = document.createElement('img');
      img.src = painting.imageData;
      img.alt = painting.name;
      box.appendChild(img);
      galleryGrid.appendChild(box);
    });
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
const modal=document.getElementById("galleryModal");
const galleryGrid=document.getElementById("galleryGrid");
async function openGallery(){
  console.log('Gallery opened');
  try {
    const response = await fetch('/api/paintings');
    
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
      galleryGrid.innerHTML="<div style='color:#f77;padding:12px'>Error loading gallery: " + (errorData.message || 'Unknown error') + "</div>";
      modal.classList.remove("hidden");
      return;
    }
    
    const paintings = await response.json();
    
    galleryGrid.innerHTML = '';
    
    if(!paintings.length) {
      galleryGrid.innerHTML="<div style='color:#777;padding:12px'>No soups saved yet.</div>";
      modal.classList.remove("hidden");
      return;
    }
    
    paintings.forEach(painting => {
      const box=document.createElement("div"); 
      box.className="thumb";
      const img=document.createElement("img"); 
      img.src=painting.imageData;
      img.alt=painting.name;
      box.appendChild(img); 
      galleryGrid.appendChild(box);
    });
    
    modal.classList.remove("hidden");
  } catch (error) {
    console.error('Error loading gallery:', error);
    galleryGrid.innerHTML="<div style='color:#f77;padding:12px'>Error loading gallery: " + error.message + "</div>";
    modal.classList.remove("hidden");
  }
}
document.getElementById("closeGallery").addEventListener("click",()=>modal.classList.add("hidden"));

document.getElementById("minBtn").addEventListener("click",()=>{ const b=document.querySelector(".body"); b.style.display = (b.style.display==="none") ? "flex" : "none"; document.querySelector(".statusbar").style.display = (b.style.display==="none") ? "none" : "block";});
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
});
