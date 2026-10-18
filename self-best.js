'use strict';
class IndexedGhostStore {
  constructor(){this.database=null}
  open(){if(this.database)return this.database;this.database=new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('Browser storage unavailable'));return}
    const request=indexedDB.open('apex-ghost-history-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('runs',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Storage unavailable'));
    request.onblocked=()=>reject(new Error('Close older game tabs and refresh to enable storage'));
  });return this.database}
  async load(){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('runs','readonly'),request=tx.objectStore('runs').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.onabort=()=>reject(tx.error)})}
  async put(run){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put(run);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
}
class GhostHistory {
  constructor(store=new IndexedGhostStore()){
    this.store=store;this.runs=[];this.pending=new Map();this.error=null;this.ready=store.load().then(runs=>{this.runs=runs.filter(GhostHistory.valid).sort((a,b)=>a.time-b.time)}).catch(error=>{this.error=error;});
  }
  static valid(run){return run&&typeof run.id==='string'&&Number.isFinite(run.time)&&run.time>0&&Number.isInteger(run.car)&&run.car>=0&&run.car<10&&run.frames instanceof Float32Array&&run.frames.length>=16&&run.frames.length%8===0&&run.frames.every(Number.isFinite)}
  async add(run){await this.ready;if(!GhostHistory.valid(run))throw new Error('Invalid ghost recording');if(this.runs.some(r=>r.id===run.id))return true;this.runs.push(run);this.runs.sort((a,b)=>a.time-b.time);this.pending.set(run.id,run);try{for(const [id,pending] of this.pending){await this.store.put(pending);this.pending.delete(id)}this.error=null;return true}catch(error){this.error=error;return false}}
  static at(run,time){const f=run.frames,n=f.length/8;if(time<0||time>run.time)return null;let lo=0,hi=n-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(f[mid*8]<=time)lo=mid;else hi=mid}const a=lo*8,b=hi*8,blend=Math.max(0,Math.min(1,(time-f[a])/(f[b]-f[a]||1)));return Array.from({length:8},(_,i)=>i===0?time:i===5?f[a+i]+Math.atan2(Math.sin(f[b+i]-f[a+i]),Math.cos(f[b+i]-f[a+i]))*blend:f[a+i]+(f[b+i]-f[a+i])*blend)}
}
if(typeof module!=='undefined')module.exports={GhostHistory,IndexedGhostStore};
if(typeof document!=='undefined')installSelfBest();
function installSelfBest(){
  const history=new GhostHistory(),base={reset,showHome,chooseMode,syncModeUI,campaignIntro,stepRivals,resolveRivalContact,finishLap,draw,drawRaceMap,updateCampaignHud};
  let trackArchive=[],racingGhosts=[],batches=[],loading=true,lastArchiveMessage='',lapLook=null,lapCar=selectedCar,session=0,previewRenderer=null,previewScene=null,previewCamera=null,previewCar=null,previewDirty=true,previewFailed=false;
  function refreshRuns(){trackArchive=history.runs.filter(r=>(r.track||'classic-v1')===TRACK_ID)}
  function currentRuns(){return trackArchive}
  const archiveStatus=$('#archive-status');
  function message(text){lastArchiveMessage=text;archiveStatus.textContent=text}
  function appearanceUI(){previewDirty=true;const look=carAppearance(selectedCar);$('#paint-color').value=look.color||CAR_MODELS[selectedCar].color;$('#stripe-color').value=look.stripe||'#eef0e3';$('#rim-color').value=look.rims||'#bfc4cb';$('#paint-finish').value=look.finish||'gloss';$('#wing-style').value=look.wing||'stock'}
  function disposeCar(car){car.parent?.remove(car);const materials=new Set();car.traverse(m=>{if(m.isMesh){m.geometry.dispose();materials.add(m.material)}});materials.forEach(m=>m.dispose())}
  function rebuild(){previewDirty=true;const pose=poseFrame();disposeCar(player);player=makeCar(CAR_MODELS[selectedCar].color,false,selectedCar,carAppearance(selectedCar));player.position.set(...pose.slice(1,4));player.rotation.set(pose[4],pose[5],pose[6],'YXZ')}
  function editLook(){if(running||raceMode==='multiplayer'&&$('#room-code').textContent){$('#customize-status').textContent='Finish the race or return Home to customize.';appearanceUI();return}carLooks[selectedCar]=cleanAppearance({color:$('#paint-color').value,stripe:$('#stripe-color').value,rims:$('#rim-color').value,finish:$('#paint-finish').value,wing:$('#wing-style').value});try{localStorage.setItem('apex-car-looks',JSON.stringify(carLooks));$('#customize-status').textContent='Look saved for '+CAR_MODELS[selectedCar].name}catch{$('#customize-status').textContent='Look applied. Browser storage is unavailable.'}rebuild()}
  for(const id of ['paint-color','stripe-color','rim-color','paint-finish','wing-style'])$('#'+id).oninput=editLook;
  $('#reset-look').onclick=()=>{if(running||raceMode==='multiplayer'&&$('#room-code').textContent)return;delete carLooks[selectedCar];try{localStorage.setItem('apex-car-looks',JSON.stringify(carLooks))}catch{}appearanceUI();rebuild()};
  const changeCar=$('#car-model').onchange;$('#car-model').onchange=e=>{if(running||raceMode==='multiplayer'&&$('#room-code').textContent){$('#car-model').value=selectedCar;return}changeCar(e);appearanceUI()};appearanceUI();
  function pack(frames){let prior=-Infinity,progress=0;const rows=[];for(let i=0;i<frames.length;i++){const f=frames[i];if(i!==frames.length-1&&f[0]-prior<.095)continue;progress=surfaceNear({x:f[1],z:f[3]},progress).s;rows.push(...f,Math.max(0,Math.min(LENGTH,progress)));prior=f[0]}return new Float32Array(rows)}
  function makeRun(frames,time,mode,id){return{id:id||crypto.randomUUID(),created:Date.now(),time,car:lapCar,appearance:cleanAppearance(lapLook||carAppearance(lapCar)),mode,track:TRACK_ID,frames:pack(frames)}}
  function updateCount(){$('#self-count').textContent=currentRuns().length+' saved ghost'+(currentRuns().length===1?'':'s')+' · race your past'}
  function personalBest(){const fastest=currentRuns()[0];if(fastest&&(!best||fastest.time<=best)){best=fastest.time;bestRun={time:fastest.time,frames:Array.from({length:fastest.frames.length/8},(_,i)=>Array.from(fastest.frames.slice(i*8,i*8+7)))}}updateHud()}
  history.ready.then(async()=>{refreshRuns();
    if(bestRun&&currentRuns().length===0){lapCar=selectedCar;lapLook=carAppearance(selectedCar);await history.add(makeRun(bestRun.frames,bestRun.time,'imported best','legacy-best-'+TRACK_ID))}
    refreshRuns();loading=false;updateCount();personalBest();message(history.error?'Ghost storage is unavailable. New ghosts will last for this tab only.':'Ghosts stay with each track. The same AI rivals learn across all tracks. Classic keeps your older ghosts.');if(raceMode==='self'){selfIntro();if(running)reset()}
  });
  function clearGhosts(){for(const batch of batches){scene.remove(batch.mesh);batch.mesh.geometry.dispose();batch.mesh.material.dispose()}batches=[]}
  function prepareGhosts(){clearGhosts();racingGhosts=currentRuns().slice();for(let variant=0;variant<10;variant++){
    const runs=racingGhosts.filter(r=>r.car===variant);if(!runs.length)continue;const spec=CAR_MODELS[variant];
    const parts=[{geometry:new THREE.BoxGeometry(spec.width,.48,spec.length),y:.5,z:0},{geometry:new THREE.BoxGeometry(spec.width*.65,spec.open?.2:Math.max(.2,spec.roof-.7),spec.open?1.2:2.1),y:spec.open?.85:(spec.roof+.7)/2,z:-.3},{wing:true,geometry:new THREE.BoxGeometry(3.05,.13,.65),y:spec.wing,z:-spec.length/2+.15}];
    for(const x of [-1.25,1.25])for(const z of [-1.65,1.55])parts.push({geometry:new THREE.CylinderGeometry(.46,.46,.44,8),x,y:.46,z,rotate:Math.PI/2});
    for(const part of parts){const material=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.22,depthWrite:false}),mesh=new THREE.InstancedMesh(part.geometry,material,runs.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);for(let i=0;i<runs.length;i++)mesh.setColorAt(i,new THREE.Color(runs[i]===currentRuns()[0]?'#ffe597':runs[i].appearance?.color||'#80edff'));batches.push({mesh,runs,part})}
  }}
  function selfIntro(){
    for(const mode of ['campaign','direct','multiplayer'])$('#mode-'+mode).setAttribute('aria-pressed','false');$('#mode-self').setAttribute('aria-pressed','true');$('#mode-status').textContent='SELF BEST · GHOST RACING';$('#multiplayer-lobby').hidden=true;$('#overlay-label').textContent='SELF BEST · ALL YOUR SAVED RUNS';$('#overlay-title').textContent='Race your past.';$('#overlay-copy').textContent=loading?'Loading your saved ghosts…':currentRuns().length?'Every past finish joins you as a transparent ghost. The gold ghost is your personal best.':'Your first race creates your first ghost. Finish a lap in any mode to grow your field.';$('#start').innerHTML=loading?'LOADING GHOSTS…':currentRuns().length?'RACE '+currentRuns().length+' GHOSTS ↗':'SET YOUR FIRST TIME ↗';$('#start').disabled=loading;$('#pause').hidden=false;archiveStatus.textContent=lastArchiveMessage;updateCampaignHud(true)
  }
  function selectSelf(){showHome();raceMode='self';base.campaignIntro();rivals.forEach(r=>r.model.visible=false);selfIntro()}
  reset=function(){if(raceMode==='self'&&loading)return;session++;lapCar=selectedCar;lapLook=carAppearance(selectedCar);base.reset();$('#customize').open=false;if(raceMode==='self'){prepareGhosts();rivals.forEach(r=>r.model.visible=false);ghost.visible=false;$('#mode-self').setAttribute('aria-pressed','true');updateCampaignHud(true)}else clearGhosts()};
  showHome=function(){clearGhosts();$('#start').disabled=false;$('#mode-self').setAttribute('aria-pressed','false');if(raceMode==='self'){raceMode='campaign';rivals.forEach(r=>r.model.visible=true)}base.showHome()};
  chooseMode=function(mode){clearGhosts();$('#mode-self').setAttribute('aria-pressed','false');base.chooseMode(mode)};
  syncModeUI=function(){base.syncModeUI();if(raceMode==='self'){$('#mode-status').textContent='SELF BEST · GHOST RACING';$('#mode-self').setAttribute('aria-pressed','true')}};
  campaignIntro=function(){base.campaignIntro();if(raceMode==='self')selfIntro()};
  stepRivals=function(dt){if(raceMode!=='self')base.stepRivals(dt)};
  resolveRivalContact=function(){if(raceMode!=='self')base.resolveRivalContact()};
  finishLap=function(){
    if(roundEnded)return;const finishedMode=raceMode;if(finishedMode!=='self')base.finishLap();capture(true);lapCar=selectedCar;lapLook=carAppearance(selectedCar);const run=makeRun(recording.map(f=>f.slice()),elapsed,finishedMode),savedSession=session;
    history.add(run).then(saved=>{refreshRuns();updateCount();personalBest();if(session===savedSession)message(saved?'Ghost saved · '+currentRuns().length+' completed races in your archive.':'Ghost active for this tab, but could not be saved. Browser storage may be full. Existing ghosts are kept.')}).catch(()=>message('This race could not be archived. Existing ghosts are kept.'));
    if(finishedMode!=='self')return;
    running=false;paused=false;keys={};roundEnded=true;const place=1+racingGhosts.filter(r=>r.time<elapsed).length;$('#overlay').classList.add('results');$('#overlay').classList.remove('hidden');$('#mode-choices').hidden=true;$('#overlay-label').textContent='SELF BEST · FINISH';$('#overlay-title').textContent=racingGhosts.length===0?'Your first ghost.':place===1?'A new personal best!':'Keep chasing your best.';$('#overlay-copy').textContent='You finished in '+formatTime(elapsed)+' · '+place+' / '+(racingGhosts.length+1)+'. Your next race includes this run.';$('#round-results').textContent='';$('#learning-report').textContent='All completed races become ghosts · campaign progress unchanged';$('#start').innerHTML='RACE YOUR GHOSTS AGAIN ↗';$('#start').disabled=false;
  };
  updateCampaignHud=function(force){if(raceMode!=='self')return base.updateCampaignHud(force);const ahead=racingGhosts.filter(r=>{const p=GhostHistory.at(r,elapsed);return p?p[7]>s:r.time<=elapsed}).length;$('#campaign-level').textContent='SELF BEST';$('#race-position').textContent=(ahead+1)+' / '+(racingGhosts.length+1);$('#ai-status').textContent=racingGhosts.length+' PERSONAL GHOSTS';$('#ai-mastery').textContent='Gold = your best · transparent cars cannot collide';$('#campaign-track').style.display='none';$('#rival-board').textContent=currentRuns()[0]?'BEST  '+formatTime(currentRuns()[0].time)+'  ·  '+currentRuns().length+' saved races':'Finish a race to create a ghost.'};
  function preview(dt){if(!$('#customize').open||previewFailed)return;try{
    if(!previewRenderer){previewRenderer=new THREE.WebGLRenderer({canvas:$('#garage-preview'),antialias:true,alpha:false});previewRenderer.setSize(240,135,false);previewRenderer.setPixelRatio(Math.min(devicePixelRatio,2));previewRenderer.outputEncoding=THREE.sRGBEncoding;previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#11283f');previewScene.add(new THREE.HemisphereLight('#e7f6ff','#334555',1.6));const light=new THREE.DirectionalLight('#ffffff',1.5);light.position.set(4,8,6);previewScene.add(light);previewCamera=new THREE.PerspectiveCamera(36,240/135,.1,100);previewCamera.position.set(8,5,10);previewCamera.lookAt(0,.7,0)}
    if(previewDirty){if(previewCar)disposeCar(previewCar);previewCar=makeCar(CAR_MODELS[selectedCar].color,false,selectedCar,carAppearance(selectedCar));scene.remove(previewCar);previewScene.add(previewCar);previewDirty=false}previewCar.rotation.y+=dt*.35;previewRenderer.render(previewScene,previewCamera);
  }catch{previewFailed=true;$('#garage-preview').hidden=true}}
  const poseObject=new THREE.Object3D(),partObject=new THREE.Object3D(),matrix=new THREE.Matrix4();
  draw=function(dt){
    preview(dt);const locked=running||raceMode==='multiplayer'&&!!$('#room-code').textContent;for(const id of ['track-select','car-model','paint-color','stripe-color','rim-color','paint-finish','wing-style','reset-look'])$('#'+id).disabled=locked;
    if(raceMode==='self'){for(const batch of batches){let visible=0;for(const run of batch.runs){const p=GhostHistory.at(run,elapsed);if(!p)continue;poseObject.position.set(p[1],p[2],p[3]);poseObject.rotation.set(p[4],p[5],p[6],'YXZ');poseObject.updateMatrix();partObject.position.set(batch.part.x||0,batch.part.wing?(run.appearance?.wing==='high'?2.2:run.appearance?.wing==='low'?.85:batch.part.y):batch.part.y,batch.part.z);partObject.rotation.set(0,0,batch.part.rotate||0);partObject.updateMatrix();matrix.multiplyMatrices(poseObject.matrix,partObject.matrix);batch.mesh.setMatrixAt(visible,matrix);batch.mesh.setColorAt(visible,new THREE.Color(run===currentRuns()[0]?'#ffe597':run.appearance?.color||'#80edff'));visible++}batch.mesh.count=visible;batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true}updateCampaignHud();const saved=bestRun;bestRun=null;base.draw(dt);bestRun=saved}else base.draw(dt)
  };
  drawRaceMap=function(dt,force){base.drawRaceMap(dt,force);if(raceMode==='self'&&mapContext)for(const run of racingGhosts){const p=GhostHistory.at(run,elapsed);if(!p)continue;const point=mapPoint({x:p[1],z:p[3]});mapContext.beginPath();mapContext.arc(point.x,point.y,2.5,0,Math.PI*2);mapContext.fillStyle=run===currentRuns()[0]?'#ffe597':'#80edff';mapContext.fill()}};
  const selectMultiplayer=$('#mode-multiplayer').onclick;$('#mode-multiplayer').onclick=()=>{clearGhosts();$('#mode-self').setAttribute('aria-pressed','false');selectMultiplayer()};
  const newCampaign=$('#new-campaign').onclick;$('#new-campaign').onclick=()=>{newCampaign();if(raceMode!=='self'){clearGhosts();rivals.forEach(r=>r.model.visible=true);$('#mode-self').setAttribute('aria-pressed','false')}};
  $('#mode-self').onclick=selectSelf;$('#home').onclick=()=>showHome();$('#start').onclick=()=>reset();
}
