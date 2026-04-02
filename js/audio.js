// 音符频率
var N = { C4:261.63,D4:293.66,E4:329.63,G4:392,A4:440,C5:523.25,D5:587.33,E5:659.25,G5:784,A5:880,C6:1046.5 }
var MELODY = ['E5','G5','A5','G5','E5','D5','E5','G5','A5','C6','A5','G5','E5','G5','A5','C6',
  'A5','G5','E5','D5','C5','D5','E5','G5','E5','D5','C5','E5','G5','A5','G5','E5',
  'C5','E5','C5','G5','E5','A5','G5','E5','D5','G5','D5','A5','G5','C6','A5','G5',
  'E5','E5','G5','G5','A5','A5','C6','C6','A5','G5','E5','G5','A5','G5','E5','D5']
var BASS = ['C4','C4','A4','A4','C4','C4','G4','G4','C4','E4','D4','G4','C4','C4','A4','G4']

var _ctx = null, _timer = null, _playing = false

function getCtx() {
  if (_ctx) return _ctx
  try { _ctx = wx.createWebAudioContext() } catch(e) { _ctx = null }
  return _ctx
}

function note(ctx, freq, t, dur, type, vol) {
  if (!ctx) return
  try {
    var o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type || 'square'; o.frequency.value = freq
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol||0.1, t+0.01)
    g.gain.linearRampToValueAtTime(0, t+dur*0.95)
    o.connect(g); g.connect(ctx.destination)
    o.start(t); o.stop(t+dur)
  } catch(e){}
}

function scheduleLoop(ctx, t) {
  var b = 0.13
  for (var i=0;i<MELODY.length;i++) note(ctx, N[MELODY[i]], t+i*b, b*0.85, 'square', 0.08)
  for (var j=0;j<BASS.length;j++) note(ctx, N[BASS[j]]*0.5, t+j*b*4, b*3.5, 'triangle', 0.12)
  return MELODY.length * b
}

module.exports = {
  startBGM: function() {
    var ctx = getCtx(); if(!ctx) return; this.stopBGM(); _playing = true
    var loop = function() { if(!_playing) return; var len = scheduleLoop(ctx, ctx.currentTime+0.05); _timer = setTimeout(loop, len*1000-50) }
    loop()
  },
  stopBGM: function() { _playing = false; if(_timer){clearTimeout(_timer);_timer=null} },
  playHit: function(p) {
    var ctx = getCtx(); if(!ctx) return; var f=800+(p||0)*100, t=ctx.currentTime
    try { var o=ctx.createOscillator(),g=ctx.createGain(); o.type='square'
      o.frequency.setValueAtTime(f,t); o.frequency.linearRampToValueAtTime(f*1.5,t+0.06)
      g.gain.setValueAtTime(0.1,t); g.gain.linearRampToValueAtTime(0,t+0.08)
      o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.08)
    } catch(e){}
  },
  playMiss: function() {
    var ctx = getCtx(); if(!ctx) return; var t=ctx.currentTime
    try { var o=ctx.createOscillator(),g=ctx.createGain(); o.type='sawtooth'
      o.frequency.setValueAtTime(200,t); o.frequency.linearRampToValueAtTime(80,t+0.15)
      g.gain.setValueAtTime(0.06,t); g.gain.linearRampToValueAtTime(0,t+0.15)
      o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.15)
    } catch(e){}
  },
  playEnd: function() {
    var ctx = getCtx(); if(!ctx) return; var t=ctx.currentTime
    try { var o=ctx.createOscillator(),g=ctx.createGain(); o.type='triangle'
      o.frequency.setValueAtTime(880,t); o.frequency.linearRampToValueAtTime(220,t+0.4)
      g.gain.setValueAtTime(0.12,t); g.gain.linearRampToValueAtTime(0,t+0.4)
      o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.4)
    } catch(e){}
  }
}
