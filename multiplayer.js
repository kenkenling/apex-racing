'use strict';
// Two players, direct WebRTC data channel; PeerJS Cloud only introduces the peers.
class ApexRoom {
  constructor(PeerType, onStatus, onMessage, onConnection) {
    Object.assign(this,{PeerType,onStatus,onMessage,onConnection,peer:null,connection:null,host:false,code:'',generation:0,timer:null});
  }
  static validCode(value){return /^[A-Z2-9]{8}$/.test(value)}
  static code(){const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);return Array.from(bytes,b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('')}
  close(){this.generation++;clearTimeout(this.timer);this.connection?.close();this.peer?.destroy();this.peer=null;this.connection=null;this.code='';this.onConnection(false)}
  open(host,code=''){
    this.close();this.host=host;
    if(!host&&!ApexRoom.validCode(code)){this.onStatus('Enter the 8-character room code your friend sent you.');return}
    if(!this.PeerType){this.onStatus('Multiplayer networking could not load. Refresh the page and try again.');return}
    this.code=host?ApexRoom.code():code;const generation=this.generation;
    this.onStatus(host?'Creating your room…':'Finding your friend’s room…');
    this.timer=setTimeout(()=>{if(generation!==this.generation)return;this.close();this.onStatus('Connection timed out. Check the code and try another network if needed.');},20000);
    try{this.peer=new this.PeerType(host?'apex-racing-v2-'+this.code:undefined,{debug:0});}catch{this.close();this.onStatus('This browser cannot start multiplayer. Try a current browser.');return}
    this.peer.on('open',()=>{if(generation!==this.generation)return;if(host){clearTimeout(this.timer);this.onStatus('Room ready. Copy the code and send it to your friend.')}else this.attach(this.peer.connect('apex-racing-v2-'+code,{reliable:true,serialization:'json',metadata:{game:'apex-v1'}}),generation)});
    this.peer.on('connection',connection=>{if(generation!==this.generation||!host||this.connection||connection.metadata?.game!=='apex-v1'){connection.close();return}this.attach(connection,generation)});
    this.peer.on('error',error=>{if(generation!==this.generation)return;const message=error.type==='peer-unavailable'?'Room not found. Ask your friend to keep the room open and check the code.':error.type==='unavailable-id'?'That room code is in use. Click Create Room again.':'Connection failed. Try again; some school or restricted networks block direct connections.';this.close();this.onStatus(message)});
    this.peer.on('disconnected',()=>{if(generation!==this.generation)return;if(this.connection?.open){this.onStatus('Connected to your friend. Room discovery is offline.');return}this.close();this.onStatus('Room connection lost. Create or join a room again.')});
  }
  attach(connection,generation){
    this.connection=connection;
    clearTimeout(this.timer);this.timer=setTimeout(()=>{if(generation!==this.generation)return;this.close();this.onStatus('Your friend could not connect. Try another network and create a fresh room.');},20000);
    connection.on('open',()=>{if(generation!==this.generation)return;clearTimeout(this.timer);this.onStatus(this.host?'Friend connected! Start the race when you are ready.':'Connected! Waiting for the host to start.');this.onConnection(true)});
    connection.on('data',data=>{if(generation===this.generation&&data&&typeof data==='object')this.onMessage(data)});
    const lost=()=>{if(generation!==this.generation)return;this.close();this.onStatus('Your friend disconnected. Create or join a room to race again.')};
    connection.on('close',lost);connection.on('error',lost);
  }
  send(data){if(this.connection?.open){try{this.connection.send(data);return true}catch{this.onStatus('Connection interrupted. Return Home and rejoin.')}}return false}
}
if(typeof module!=='undefined')module.exports=ApexRoom;
if(typeof document!=='undefined')installMultiplayer();
function installMultiplayer(){
  let connected=false,active=false,startAt=0,clockOffset=0,countdown=false,roundId='',networkClock=0,remotePose=null,remoteProgress=0,remoteTime=null,localTime=null,remoteCar=0,remoteSeq=-1,localSeq=0,remoteModel=null,remoteLook={},remoteLookKey='',lastSeen=0,launchPending=false;
  const base={reset,showHome,chooseMode,step,stepRivals,resolveRivalContact,updateCampaignHud,syncModeUI,campaignIntro,finishLap,togglePause,draw,drawRaceMap};
  const banner=$('#multiplayer-banner');
  function status(text){$('#room-status').textContent=text;$('#room-share').hidden=!room.code;$('#room-code').textContent=room.code;$('#leave-room').hidden=!room.peer;$('#create-room').disabled=!!room.peer;$('#join-room').disabled=!!room.peer}
  const room=new ApexRoom(typeof Peer==='undefined'?null:Peer,status,receive,isConnected=>{
    connected=isConnected;$('#start').disabled=!(isConnected&&room.host);
    if(!isConnected){active=false;countdown=false;remotePose=null;if(remoteModel)remoteModel.visible=false;banner.hidden=true;if(raceMode==='multiplayer'){running=false;paused=false;keys={};$('#overlay').classList.remove('hidden');$('#multiplayer-lobby').hidden=false;$('#start').innerHTML='WAITING FOR FRIEND';}}
    if(isConnected){room.send({type:'track',track:TRACK_ID});if(connected&&!room.host)room.send({type:'ping',sent:Date.now()})}
  });
  function selectMultiplayer(){base.showHome();raceMode='multiplayer';rivals.forEach(r=>r.model.visible=false);base.campaignIntro();multiplayerIntro()}
  function multiplayerIntro(){
    $('#multiplayer-lobby').hidden=false;$('#mode-multiplayer').setAttribute('aria-pressed','true');for(const mode of ['campaign','direct'])$('#mode-'+mode).setAttribute('aria-pressed','false');
    $('#overlay-label').textContent='MULTIPLAYER · TWO HUMAN DRIVERS';$('#overlay-title').textContent='Bring your rival.';$('#overlay-copy').textContent='Create a room and share its code. Your friend joins here. Select the same track as your friend. The host starts both cars together. Race clean: cars pass through each other.';
    $('#start').innerHTML=connected?(room.host?'START TOGETHER ↗':'WAITING FOR HOST'):'WAITING FOR FRIEND';$('#start').disabled=!(connected&&room.host);$('#pause').hidden=true;updateCampaignHud(true);
  }
  function leave(){room.close();active=false;roundId='';$('#multiplayer-lobby').hidden=true;$('#start').disabled=false;$('#pause').hidden=false;$('#mode-multiplayer').setAttribute('aria-pressed','false');rivals.forEach(r=>r.model.visible=true)}
  function sendPose(){const p=poseFrame();room.send({type:'pose',round:roundId,seq:localSeq++,pose:p,progress:s,car:selectedCar,appearance:carAppearance(selectedCar)});}
  function prepare(id,hostStart){
    if(!connected)return;roundId=id;localSeq=0;remoteSeq=-1;startAt=hostStart-clockOffset;localTime=null;remoteTime=null;remoteProgress=0;remotePose=null;lastSeen=Date.now();active=true;countdown=true;launchPending=true;
    base.reset();launchPending=false;running=false;keys={};ghost.visible=false;rivals.forEach(r=>r.model.visible=false);alignAt(0);lateral=room.host?-4:4;worldPosition.addScaledVector(frame(0).side,lateral);$('#multiplayer-lobby').hidden=true;$('#pause').hidden=true;$('#start').disabled=!room.host;banner.hidden=false;banner.textContent='GET READY';sendPose();
  }
  function startRace(){if(!connected||!room.host)return;const id=ApexRoom.code(),time=Date.now()+3500;room.send({type:'start',round:id,at:time,track:TRACK_ID});prepare(id,time)}
  function validPose(data){return Number.isInteger(data.seq)&&data.seq>remoteSeq&&Array.isArray(data.pose)&&data.pose.length===7&&data.pose.every(Number.isFinite)&&data.pose.slice(1,4).every(n=>Math.abs(n)<10000)&&Number.isFinite(data.progress)&&data.progress>=-100&&data.progress<=LENGTH+100&&Number.isInteger(data.car)&&data.car>=0&&data.car<10}
  function receive(data){
    if(data.type==='track'&&data.track!==TRACK_ID){room.close();status('Different tracks selected. Both players must choose '+TRACK_NAME+' before joining.');return}
    if(data.type==='ping'&&room.host&&Number.isFinite(data.sent)){room.send({type:'pong',sent:data.sent,now:Date.now()});return}
    if(data.type==='pong'&&!room.host&&Number.isFinite(data.now)&&Number.isFinite(data.sent)){clockOffset=data.now-(Date.now()+data.sent)/2;return}
    if(data.type==='start'&&data.track===TRACK_ID&&!room.host&&ApexRoom.validCode(data.round)&&Number.isFinite(data.at)&&Math.abs(data.at-(Date.now()+clockOffset))<10000){prepare(data.round,data.at);return}
    if(data.round!==roundId||!active)return;
    if(data.type==='pose'&&validPose(data)){remoteSeq=data.seq;remotePose=data.pose;remoteProgress=data.progress;remoteCar=data.car;remoteLook=cleanAppearance(data.appearance);lastSeen=Date.now();return}
    if(data.type==='finish'&&Number.isFinite(data.time)&&data.time>5&&data.time<7200&&remoteProgress>LENGTH*.9){remoteTime=data.time;if(localTime!==null)results();return}
  }
  function results(){
    running=false;keys={};roundEnded=true;$('#overlay').classList.add('results');$('#overlay').classList.remove('hidden');$('#mode-choices').hidden=true;$('#multiplayer-lobby').hidden=true;$('#overlay-label').textContent='MULTIPLAYER · FINISH';
    $('#overlay-title').textContent=remoteTime===null?'Lap complete!':Math.abs(localTime-remoteTime)<.01?'Photo finish!':localTime<remoteTime?'You win!':'Your friend wins!';
    $('#overlay-copy').textContent=remoteTime===null?'Waiting for your friend to finish. Their car is still racing.':'Both drivers finished the same circuit. Ready for a rematch?';
    const rows=[{name:'YOU',time:localTime},{name:'FRIEND',time:remoteTime}].sort((a,b)=>(a.time??Infinity)-(b.time??Infinity));$('#round-results').textContent='';for(const row of rows){const div=document.createElement('div'),name=document.createElement('span'),time=document.createElement('strong');name.textContent=row.name;time.textContent=row.time===null?'RACING…':formatTime(row.time);div.append(name,time);$('#round-results').append(div)}
    $('#learning-report').textContent='Live two-player race · campaign progress unchanged';$('#start').innerHTML=room.host?'REMATCH TOGETHER ↗':'WAITING FOR HOST TO REMATCH';$('#start').disabled=!room.host;banner.hidden=true;
  }
  reset=function(){if(raceMode!=='multiplayer')return base.reset();if(launchPending)return base.reset();if(connected&&room.host)startRace();else if(!connected){$('#overlay').classList.remove('hidden');multiplayerIntro()}};
  showHome=function(){if(raceMode==='multiplayer'){leave();raceMode='campaign'}base.showHome()};
  chooseMode=function(mode){leave();base.chooseMode(mode)};
  syncModeUI=function(){base.syncModeUI();if(raceMode==='multiplayer'){$('#mode-status').textContent='MULTIPLAYER · FRIEND RACE';$('#mode-multiplayer').setAttribute('aria-pressed','true')}};
  campaignIntro=function(){base.campaignIntro();if(raceMode==='multiplayer')multiplayerIntro()};
  stepRivals=function(dt){if(raceMode!=='multiplayer')base.stepRivals(dt)};
  resolveRivalContact=function(){if(raceMode!=='multiplayer')base.resolveRivalContact()};
  togglePause=function(){if(raceMode!=='multiplayer')base.togglePause()};
  step=function(dt){if(raceMode==='multiplayer'){
    if(countdown){const remaining=(startAt-Date.now())/1000;banner.hidden=false;banner.textContent=remaining>0?'START IN '+Math.ceil(remaining):'GO!';if(remaining<=0){countdown=false;running=true}return}
    if(active&&running){elapsed=Math.max(0,(Date.now()-startAt)/1000-dt);base.step(dt)}
  }else base.step(dt)};
  finishLap=function(){if(raceMode!=='multiplayer')return base.finishLap();localTime=Math.max(.001,(Date.now()-startAt)/1000);elapsed=localTime;sendPose();room.send({type:'finish',round:roundId,time:localTime});results()};
  updateCampaignHud=function(force){if(raceMode!=='multiplayer')return base.updateCampaignHud(force);$('#campaign-level').textContent='FRIEND RACE';$('#race-position').textContent=(localTime!==null?(remoteTime!==null&&remoteTime<localTime?2:1):remoteTime!==null||remoteProgress>s?2:1)+' / 2';$('#ai-status').textContent=connected?'HUMAN RIVAL · CONNECTED':'ROOM LOBBY';$('#ai-mastery').textContent='Two drivers. Same track. Fastest time wins.';$('#campaign-track').style.display='none';$('#rival-board').textContent='YOU  ·  '+Math.round(Math.max(0,s)/LENGTH*100)+'%     FRIEND  ·  '+Math.round(Math.max(0,remoteProgress)/LENGTH*100)+'%';$('#mode-status').textContent='MULTIPLAYER · FRIEND RACE'};
  drawRaceMap=function(dt,force){base.drawRaceMap(dt,force);if(raceMode==='multiplayer'&&remoteModel?.visible&&mapContext){const p=mapPoint(remoteModel.position);mapContext.beginPath();mapContext.arc(p.x,p.y,4,0,Math.PI*2);mapContext.fillStyle='#54e7f5';mapContext.fill()}};
  draw=function(dt){
    if(raceMode==='multiplayer'){
      ghost.visible=false;networkClock+=dt;
      if(connected&&networkClock>.05){networkClock=0;if(active)sendPose();else if(!room.host)room.send({type:'ping',sent:Date.now()})}
      if(remotePose){if(!remoteModel||remoteModel.userData.variant!==remoteCar||remoteLookKey!==JSON.stringify(remoteLook)){if(remoteModel){scene.remove(remoteModel);const materials=new Set();remoteModel.traverse(m=>{if(m.isMesh){m.geometry.dispose();materials.add(m.material)}});materials.forEach(m=>m.dispose())}remoteModel=makeCar('#54e7f5',false,remoteCar,remoteLook);remoteLookKey=JSON.stringify(remoteLook);remoteModel.userData.variant=remoteCar;remoteModel.position.set(...remotePose.slice(1,4))}remoteModel.visible=true;const blend=1-Math.exp(-dt*18);remoteModel.position.lerp(new THREE.Vector3(...remotePose.slice(1,4)),blend);remoteModel.rotation.set(remotePose[4],remoteModel.rotation.y+angleDelta(remotePose[5],remoteModel.rotation.y)*blend,remotePose[6],'YXZ')}
      updateCampaignHud();if(active&&!countdown&&localTime===null){banner.hidden=Date.now()-startAt>1200&&Date.now()-lastSeen<6000;banner.textContent=Date.now()-lastSeen>6000?'FRIEND CONNECTION SLOW…':'GO!'}
    }
    // Hide the personal-best ghost in the friend race without changing saved runs.
    const savedRun=bestRun;if(raceMode==='multiplayer')bestRun=null;base.draw(dt);bestRun=savedRun;
  };
  $('#mode-multiplayer').onclick=selectMultiplayer;
  $('#create-room').onclick=()=>room.open(true);
  $('#join-room').onclick=()=>room.open(false,$('#room-input').value.trim().toUpperCase());
  $('#room-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('#join-room').click()});
  $('#copy-room').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);$('#copy-room').textContent='COPIED!'}catch{$('#room-status').textContent='Select and copy this code: '+room.code}};
  $('#leave-room').onclick=()=>{room.close();status('Room closed. Create or join another room.');multiplayerIntro()};
  const newCampaign=$('#new-campaign').onclick;$('#new-campaign').onclick=()=>{if(raceMode==='multiplayer')showHome();newCampaign()};
  $('#home').onclick=()=>showHome();
  $('#start').onclick=()=>reset();
  addEventListener('beforeunload',()=>room.close());
}
