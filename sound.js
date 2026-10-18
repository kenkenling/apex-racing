'use strict';
// Original synthesized effects. No audio files or external sound service.
class RacingSound {
  constructor(context){
    this.context=context;this.enabled=false;this.volume=.55;this.previous={};this.master=context.createGain();this.master.gain.value=0;this.master.connect(context.destination);
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=5;compressor.connect(this.master);this.bus=compressor;
    this.engine=context.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=45;this.engineGain=context.createGain();this.engineGain.gain.value=0;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;this.engine.connect(filter);filter.connect(this.engineGain);this.engineGain.connect(this.bus);this.engine.start();
    this.harmonic=context.createOscillator();this.harmonic.type='triangle';this.harmonicGain=context.createGain();this.harmonicGain.gain.value=0;this.harmonic.connect(this.harmonicGain);this.harmonicGain.connect(this.bus);this.harmonic.start();
    const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);let seed=9731;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1}this.noise=buffer;
    this.tires=this.loopNoise('bandpass',1050);this.wind=this.loopNoise('highpass',700);
  }
  loopNoise(type,frequency){const source=this.context.createBufferSource();source.buffer=this.noise;source.loop=true;const filter=this.context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=1;const gain=this.context.createGain();gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this.bus);source.start();return{source,filter,gain}}
  setEnabled(enabled){this.enabled=enabled;this.master.gain.setTargetAtTime(enabled?this.volume:0,this.context.currentTime,.025)}
  setVolume(volume){this.volume=Math.max(0,Math.min(1,volume));this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.025)}
  tone(from,to,duration=.18,volume=.08,delay=0,type='sine'){
    if(!this.enabled)return;const ctx=this.context,t=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(Math.max(1,to),t+duration);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(this.bus);osc.onended=()=>{osc.disconnect();gain.disconnect()};osc.start(t);osc.stop(t+duration+.02)
  }
  burst(frequency,duration,volume){if(!this.enabled)return;const ctx=this.context,t=ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.noise;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(this.bus);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};source.start(t);source.stop(t+duration+.02)}
  update(state){
    const ctx=this.context,t=ctx.currentTime,active=this.enabled&&state.running&&!state.paused&&!state.hidden,ratio=Math.max(0,Math.min(1,state.speed/67.056)),gear=Math.min(5,Math.floor(ratio*6)),rpm=42+(ratio*6-gear)*55+ratio*45;
    this.engine.frequency.setTargetAtTime(rpm,t,.06);this.harmonic.frequency.setTargetAtTime(rpm*2,t,.06);this.engineGain.gain.setTargetAtTime(active?(state.gas?.047:.027):0,t,.06);this.harmonicGain.gain.setTargetAtTime(active?.017:0,t,.06);this.wind.gain.gain.setTargetAtTime(active?ratio*ratio*.045:0,t,.1);
    this.tires.gain.gain.setTargetAtTime(active&&state.drifting?Math.min(.13,.04+Math.abs(state.slip)*.14):0,t,.04);this.tires.filter.frequency.setTargetAtTime(700+ratio*1000,t,.05);
    const prev=this.previous;
    if(active&&prev.running&&!prev.paused){if(state.wall&&!prev.wall){this.burst(850,.2,.22);this.tone(95,32,.16,.16)}if(state.airborne&&!prev.airborne){this.burst(1800,.18,.06);this.tone(220,380,.16,.035)}if(state.jumps>prev.jumps){this.burst(450,.2,.18);this.tone(100,38,.18,.13)}}
    if(this.enabled&&state.ended&&!prev.ended){for(const [i,note] of [523.25,659.25,783.99].entries())this.tone(note,note,.18,.085,i*.12)}
    if(active&&!prev.running&&!state.ended)this.tone(440,660,.12,.045);
    if(this.enabled&&state.countdown!==prev.countdown&&/^START IN [1-4]$/.test(state.countdown))this.tone(440,440,.09,.07);
    this.previous={...state};
  }
}
if(typeof module!=='undefined')module.exports=RacingSound;
if(typeof document!=='undefined')installRacingSound();
function installRacingSound(){
  let effects=null,volume=.55;try{const stored=localStorage.getItem('apex-sound-volume');if(stored!==null&&Number.isFinite(Number(stored)))volume=Math.max(0,Math.min(1,Number(stored)))}catch{}
  $('#sound-volume').value=Math.round(volume*100);
  $('#sound').onclick=async()=>{try{if(!effects){const Context=window.AudioContext||window.webkitAudioContext;effects=new RacingSound(new Context());effects.setVolume(volume)}await effects.context.resume();sound=!sound;effects.setEnabled(sound);$('#sound').textContent=sound?'SOUND ON ↗':'SOUND OFF ↗';$('#sound').setAttribute('aria-pressed',String(sound));if(sound)effects.tone(520,700,.1,.05)}catch{$('#sound').textContent='SOUND UNAVAILABLE';sound=false;effects?.setEnabled(false)}};
  $('#sound-volume').oninput=e=>{volume=Math.max(0,Math.min(1,Number(e.target.value)/100));effects?.setVolume(volume);try{localStorage.setItem('apex-sound-volume',String(volume))}catch{}};
  const baseDraw=draw;draw=function(dt){baseDraw(dt);effects?.update({running,paused,speed,gas:!!(keys.w||keys.arrowup),drifting,slip:slipAngle,airborne,jumps,wall:wallFlash>0,ended:roundEnded,hidden:!!document.hidden,countdown:$('#multiplayer-banner').textContent})};
  addEventListener('beforeunload',()=>effects?.context.close());
}
