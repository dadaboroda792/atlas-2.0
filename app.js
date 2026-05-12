const canvas = document.getElementById('canvas');
const edgeLayer = document.getElementById('edgeLayer');
const wrap = document.getElementById('canvasWrap');

const state = {
  tool: 'select', nodes: [], edges: [], groups: [], selected: null,
  offsetX: 0, offsetY: 0, zoom: 1, isPanning: false, scratch: false,
  undo: [], redo: [], edgeStart: null
};

const uid = () => Math.random().toString(36).slice(2, 10);
const saveLocal = () => localStorage.setItem('nodal-atlas-state', JSON.stringify(serialize()));
setInterval(saveLocal, 2000);

function serialize() { return { version:1, nodes:state.nodes, edges:state.edges, groups:state.groups, view:{x:state.offsetX,y:state.offsetY,zoom:state.zoom} }; }
function snapshot() { state.undo.push(JSON.stringify(serialize())); if (state.undo.length > 100) state.undo.shift(); state.redo = []; }
function restore(raw) { const d = typeof raw === 'string' ? JSON.parse(raw):raw; state.nodes=d.nodes||[]; state.edges=d.edges||[]; state.groups=d.groups||[]; if(d.view){state.offsetX=d.view.x||0;state.offsetY=d.view.y||0;state.zoom=d.view.zoom||1;} render(); }

function setTool(t){ state.tool=t; document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t)); }

function worldPos(e){ const r=wrap.getBoundingClientRect(); return { x:(e.clientX-r.left-state.offsetX)/state.zoom, y:(e.clientY-r.top-state.offsetY)/state.zoom}; }
function addNode(x,y,type='node',text='Idea'){ snapshot(); const n={id:uid(),x,y,text,type,scratch:state.scratch,state:'default'}; state.nodes.push(n); render(); return n; }
function addGroup(x,y){ snapshot(); state.groups.push({id:uid(),x,y,w:240,h:140,text:'Group'}); render(); }
function addEdge(a,b){ snapshot(); state.edges.push({id:uid(),from:a,to:b}); render(); }
function deleteSelected(){ if(!state.selected) return; snapshot(); state.nodes=state.nodes.filter(n=>n.id!==state.selected); state.groups=state.groups.filter(g=>g.id!==state.selected); state.edges=state.edges.filter(e=>e.from!==state.selected&&e.to!==state.selected&&e.id!==state.selected); state.selected=null; render(); }

function render(){
  canvas.innerHTML=''; edgeLayer.innerHTML='';
  [...state.groups].forEach(g=>{
    const el=document.createElement('div'); el.className='group'+(state.selected===g.id?' selected':''); el.style.left=g.x+'px'; el.style.top=g.y+'px'; el.style.width=g.w+'px'; el.style.height=g.h+'px'; el.textContent=g.text;
    el.onmousedown=(e)=>dragStart(e,g,'group'); el.onclick=(e)=>selectOnly(e,g.id); canvas.append(el);
  });
  state.nodes.forEach(n=>{
    const el=document.createElement('div'); el.className=`node ${n.type==='page'?'page':''} ${n.scratch?'scratch':''}${state.selected===n.id?' selected':''}`; el.style.left=n.x+'px'; el.style.top=n.y+'px';
    const title=document.createElement('div'); title.textContent=`${n.text} [${n.state}]`; el.append(title);
    const mini=document.createElement('div'); mini.className='mini-toolbar';
    ['Child','Link','Dup','State'].forEach(a=>{ const b=document.createElement('button'); b.textContent=a; b.onclick=(e)=>miniAction(e,a,n); mini.append(b); });
    el.append(mini);
    el.onmousedown=(e)=>dragStart(e,n,'node');
    el.onclick=(e)=>{selectOnly(e,n.id); if(state.tool==='edge'){ if(!state.edgeStart) state.edgeStart=n.id; else { addEdge(state.edgeStart,n.id); state.edgeStart=null; } }};
    el.ondblclick=()=>{ const t=prompt('Quick-mode text',n.text); if(t!==null){ snapshot(); n.text=t; render(); }};
    canvas.append(el);
  });
  state.edges.forEach(ed=>{ const a=state.nodes.find(n=>n.id===ed.from), b=state.nodes.find(n=>n.id===ed.to); if(!a||!b) return; const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',a.x+60); line.setAttribute('y1',a.y+20); line.setAttribute('x2',b.x+60); line.setAttribute('y2',b.y+20); line.setAttribute('stroke','#9fc1ff'); line.setAttribute('stroke-width','2'); edgeLayer.append(line); });
  canvas.style.transform=edgeLayer.style.transform=`translate(${state.offsetX}px,${state.offsetY}px) scale(${state.zoom})`;
}

function miniAction(e,a,n){ e.stopPropagation(); if(a==='Child'){ const c=addNode(n.x+180,n.y+80,'node','Child'); addEdge(n.id,c.id);} if(a==='Link'){ state.tool='edge'; setTool('edge'); state.edgeStart=n.id;} if(a==='Dup'){ addNode(n.x+30,n.y+30,n.type,n.text+' copy'); } if(a==='State'){ snapshot(); n.state=n.state==='default'?'focus':'default'; render(); }}
function selectOnly(e,id){ e.stopPropagation(); state.selected=id; render(); }
function dragStart(e,obj,kind){ if(state.tool!=='select') return; e.preventDefault(); const p=worldPos(e); const dx=p.x-obj.x, dy=p.y-obj.y; const onMove=(ev)=>{ const q=worldPos(ev); obj.x=q.x-dx; obj.y=q.y-dy; render(); }; const onUp=()=>{ snapshot(); window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp);}; window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp); }

wrap.addEventListener('mousedown',e=>{ if(e.target!==wrap&&e.target!==canvas&&e.target!==edgeLayer) return; const p=worldPos(e);
  if(state.tool==='node') addNode(p.x,p.y,'node');
  else if(state.tool==='page') addNode(p.x,p.y,'page','Page');
  else if(state.tool==='group') addGroup(p.x,p.y);
  else if(state.tool==='edge'&&state.edgeStart){ const n=addNode(p.x,p.y,'node','New'); addEdge(state.edgeStart,n.id); state.edgeStart=null; }
  else state.selected=null, render();
});

wrap.addEventListener('wheel',e=>{ e.preventDefault(); const dir=e.deltaY>0?-0.1:0.1; state.zoom=Math.min(2.5,Math.max(0.3,state.zoom+dir)); render(); },{passive:false});
window.addEventListener('mousemove',e=>{ if(!state.isPanning) return; state.offsetX += e.movementX; state.offsetY += e.movementY; render(); });
window.addEventListener('keydown',e=>{ if(e.key===' '){ state.isPanning=true; }
  const k=e.key.toLowerCase(); if(['v','n','e','g','p'].includes(k)) setTool({v:'select',n:'node',e:'edge',g:'group',p:'page'}[k]);
  if((e.ctrlKey||e.metaKey)&&k==='z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); }
  if((e.ctrlKey||e.metaKey)&&k==='y'){ e.preventDefault(); redo(); }
  if(e.key==='Delete'||e.key==='Backspace') deleteSelected();
});
window.addEventListener('keyup',e=>{ if(e.key===' ') state.isPanning=false; });

function undo(){ if(!state.undo.length) return; state.redo.push(JSON.stringify(serialize())); restore(state.undo.pop()); }
function redo(){ if(!state.redo.length) return; state.undo.push(JSON.stringify(serialize())); restore(state.redo.pop()); }

document.getElementById('undoBtn').onclick=undo; document.getElementById('redoBtn').onclick=redo;
document.getElementById('toggleScratch').onclick=(e)=>{ state.scratch=!state.scratch; e.target.textContent=`Scratch: ${state.scratch?'on':'off'}`; };
document.getElementById('exportBtn').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'})); a.download='nodal-atlas.json'; a.click(); };
document.getElementById('importInput').onchange=(e)=>{ const f=e.target.files[0]; if(!f) return; f.text().then(t=>restore(JSON.parse(t))); };
document.getElementById('clearBtn').onclick=()=>{ snapshot(); state.nodes=[]; state.edges=[]; state.groups=[]; state.selected=null; render(); };

document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));

const saved=localStorage.getItem('nodal-atlas-state'); if(saved) restore(JSON.parse(saved)); setTool('select'); render();
