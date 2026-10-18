'use strict';
// A small, local imitation learner. No pretrained driving policy or remote service.
class RivalLearning {
  constructor(saved=null){this.rounds=0;this.wins=0;this.acceleration=0;this.bins=Array(160).fill(null);this.history=[];
    if(saved&&Number.isInteger(saved.rounds)&&saved.rounds>=0&&saved.rounds<=50&&Array.isArray(saved.bins)&&saved.bins.length===160&&saved.bins.every(b=>b===null||['speed','line','brake','slip','mistakes','seconds'].every(k=>Number.isFinite(b[k])))){
      this.rounds=saved.rounds;this.wins=Math.max(0,Math.min(50,Number(saved.wins)||0));this.acceleration=Math.max(0,Math.min(31,Number(saved.acceleration)||0));this.bins=saved.bins.map(b=>b?{speed:Math.max(0,Math.min(67.06,b.speed)),line:Math.max(-10,Math.min(10,b.line)),brake:Math.max(0,Math.min(1,b.brake)),slip:Math.max(0,Math.min(1,b.slip)),mistakes:Math.max(0,Math.min(1,b.mistakes)),seconds:Math.max(0,b.seconds)}:null);this.history=Array.isArray(saved.history)?saved.history.filter(h=>h&&Number.isFinite(h.time)&&Number.isInteger(h.place)).slice(-50):[];
      if(this.rounds&&(!this.bins.some(Boolean)||!this.acceleration)){this.rounds=0;this.wins=0;this.bins.fill(null);this.history=[]}
    }
  }
  get level(){return Math.min(50,this.rounds+1)}
  get complete(){return this.rounds>=50}
  get coverage(){return this.bins.filter(Boolean).length/160}
  mastery(rate){return this.rounds===0?0:1-Math.exp(-this.rounds*rate)}
  profile(index){return this.bins[(Math.floor(index)%160+160)%160]}
  study(samples,summary){if(this.complete)return false;if(!samples.some(b=>b&&b.seconds>.01)||!(summary.time>0))return false;
    for(let i=0;i<160;i++){const b=samples[i];if(!b||b.seconds<=.01)continue;const t=b.seconds,old=this.bins[i],alpha=old?.3:1,mistakes=b.wall/t,line=mistakes>.08?0:b.line/t,speed=.5*b.speed/t+.5*b.peak;
      const blend=(key,value)=>old?old[key]*(1-alpha)+value*alpha:value;
      this.bins[i]={speed:Math.max(0,Math.min(67.06,blend('speed',speed))),line:Math.max(-10,Math.min(10,blend('line',line))),brake:blend('brake',b.brake/t),slip:blend('slip',b.slip/t),mistakes:blend('mistakes',mistakes),seconds:(old?.seconds||0)+t};
    }
    const learned=Math.max(5,Math.min(31,summary.acceleration||5));this.acceleration=this.rounds?this.acceleration*.7+learned*.3:learned;this.rounds++;if(summary.place===1)this.wins++;this.history.push({level:this.rounds,time:summary.time,place:summary.place,walls:summary.wallHits||0,brakes:summary.brakeEvents||0,average:summary.average||0});this.history=this.history.slice(-50);return true;
  }
  toJSON(){return{rounds:this.rounds,wins:this.wins,acceleration:this.acceleration,bins:this.bins,history:this.history}}
}
