var render = null
var audio = null
try { render = require('./js/render') } catch(e) { console.error('render load fail', e) }
try { audio = require('./js/audio') } catch(e) { console.error('audio load fail', e) }

if (!render) {
  render = {
    drawBG: function(){}, drawButton: function(){}, drawText: function(){},
    hitTest: function(){ return false }, roundRect: function(){}
  }
}
if (!audio) {
  audio = {
    startBGM: function(){}, stopBGM: function(){}, playHit: function(){},
    playMiss: function(){}, playEnd: function(){}
  }
}

// ★★★ 替换为你自己的云开发环境 ID ★★★
var CLOUD_ENV = 'cloud1-2g99echk2c92359d'

// ---------- 初始化 ----------
try { if (wx.cloud) wx.cloud.init({ env: CLOUD_ENV }) } catch (e) {}

var info = wx.getSystemInfoSync()
var W = info.screenWidth
var H = info.screenHeight
var dpr = info.pixelRatio
var safeTop = (info.safeArea && info.safeArea.top) ? info.safeArea.top : 0
var safeBottom = (info.safeArea && info.safeArea.bottom) ? (H - info.safeArea.bottom) : 0

var canvas = wx.createCanvas()
canvas.width = W * dpr
canvas.height = H * dpr
var ctx = canvas.getContext('2d')
ctx.scale(dpr, dpr)

// ---------- 全局状态 ----------
var scene = 'home' // home, play, transition, result
var nickname = wx.getStorageSync('nickname') || ''

// 昵称逻辑：首次进入弹键盘输入昵称
var _needNickname = !nickname
var _nickInputting = false

function askNickname(callback) {
  if (_nickInputting) return
  _nickInputting = true

  wx.showKeyboard({
    defaultValue: '',
    maxLength: 8,
    multiple: false,
    confirmHold: false,
    confirmType: 'done'
  })

  wx.onKeyboardConfirm(function (res) {
    wx.offKeyboardConfirm()
    wx.offKeyboardComplete()
    _nickInputting = false
    var name = (res.value || '').trim()
    if (name) {
      nickname = name.substring(0, 8)
      wx.setStorageSync('nickname', nickname)
      _needNickname = false
    }
    wx.hideKeyboard()
    if (callback) callback()
  })

  wx.onKeyboardComplete(function () {
    wx.offKeyboardConfirm()
    wx.offKeyboardComplete()
    _nickInputting = false
    wx.hideKeyboard()
  })
}

if (!nickname) {
  nickname = ''
}
var playCount = 0
var shareCount = 0  // 累计分享次数
var waitingShareReturn = false  // 分享后等待返回
var r3BaseDur = 10  // 第三局基础时长
var r3MaxDur = 30   // 第三局最大时长

// ---------- 三局配置 ----------
var ROUNDS = [
  { name: '指尖热身', sub: '第一局', dur: 0, autoHide: 0, diff: '点击3个圆点', cdSteps: 3, cdSpeed: 600, targetTaps: 3 },
  { name: '速点之王', sub: '第二局', dur: 10, autoHide: 900, diff: '限时10秒 · 圆点0.9秒消失', cdSteps: 1, cdSpeed: 400 },
  { name: '紫禁之巅', sub: '终极决战', dur: 10, autoHide: 380, diff: '圆点0.38秒极速消失', cdSteps: 1, cdSpeed: 400 }
]

var DOT_COLORS = ['#ff6b6b','#4ecdc4','#ffd700','#a29bfe','#fd79a8','#00cec9','#e17055','#6c5ce7']
var DOT_EMOJIS = ['😀','😂','🤣','😜','😎','🥳','😈','👻','🤩','😏','🔥','⭐','💥','✨','🎯','💎','🍀','🌟','😺','🐱']
var DOT_R = 34 // 圆点半径（逻辑像素）
var MAX_SCORE = 150

// ---------- 游戏变量 ----------
var roundIdx = 0
var roundScores = [0, 0, 0]
var score = 0, combo = 0, timeLeft = 9
var dotX = 0, dotY = 0, dotColor = '#ff6b6b', dotEmoji = '😀', dotVisible = false
var tapCount = 0, roundTaps = [0, 0, 0]
var maxCombo = 0, roundMaxCombo = [0, 0, 0]
var dotTime = 0, lastTapTime = 0
var gameTimer = null, hideTimer = null
var floats = [] // {x,y,text,color,born}
var ripples = [] // {x,y,color,born}
var particles = [] // {x,y,vx,vy,color,born,size}
var screenShake = 0 // 屏幕震动剩余时间
var transTimer = 0, transCount = 3, transStart = 0

// ---------- 结算变量 ----------
var rankTab = 3
var rankList = []
var rankLoading = false
var needShareUI = false  // 结算页是否显示分享按钮

// ========== 渲染帧 ==========
function frame() {
  try {
    ctx.clearRect(0, 0, W, H)

    if (scene === 'home') drawHome()
    else if (scene === 'transition') drawTransition()
    else if (scene === 'play') drawPlay()
    else if (scene === 'result') drawResult()
  } catch (e) {
    console.error('render error', e)
  }
  requestAnimationFrame(frame)
}

// ========== 首页 ==========
function drawHome() {
  render.drawBG(ctx, W, H)
  var cx = W / 2


  // 装饰圆点（更大）
  var t = Date.now() / 1000
  var st = safeTop
  var dotR = 24 + Math.sin(t * 3) * 6
  ctx.beginPath()
  ctx.arc(cx, st + H * 0.1, dotR, 0, Math.PI * 2)
  ctx.fillStyle = '#667eea'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, st + H * 0.1, dotR + 12, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(102,126,234,0.3)'
  ctx.lineWidth = 2
  ctx.stroke()
  // 第二层扩散
  ctx.beginPath()
  ctx.arc(cx, st + H * 0.1, dotR + 24 + Math.sin(t * 2) * 6, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(102,126,234,0.12)'
  ctx.stroke()

  // 游戏名
  render.drawText(ctx, '点呀~点', cx, st + H * 0.19, 'bold ' + (W * 0.1) + 'px sans-serif', '#fff')

  // 文案
  render.drawText(ctx, '手指够快吗？', cx, st + H * 0.26, 'bold ' + (W * 0.055) + 'px sans-serif', 'rgba(255,255,255,0.7)')
  render.drawText(ctx, '三局定胜负，最后一关没人能撑住', cx, st + H * 0.31, (W * 0.032) + 'px sans-serif', 'rgba(255,255,255,0.4)')
  render.drawText(ctx, '敢来试试吗 👆', cx, st + H * 0.35, (W * 0.033) + 'px sans-serif', 'rgba(255,255,255,0.5)')

  // 昵称显示
  if (nickname) {
    render.drawText(ctx, '👤 ' + nickname, cx, st + H * 0.43, (W * 0.035) + 'px sans-serif', 'rgba(255,255,255,0.6)')
  } else {
    var blink = 0.6 + Math.sin(t * 3) * 0.4
    ctx.globalAlpha = blink
    render.drawText(ctx, '👆 点击设置昵称', cx, st + H * 0.43, 'bold ' + (W * 0.038) + 'px sans-serif', '#ffd700')
    ctx.globalAlpha = 1
  }

  // 开始按钮
  var bw = W * 0.65, bh = W * 0.13
  var bx = cx - bw / 2, by = H * 0.52
  var scale = 1 + Math.sin(t * 2) * 0.02
  ctx.save()
  ctx.translate(cx, by + bh / 2)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -(by + bh / 2))
  if (playCount >= 1) {
    render.drawButton(ctx, bx, by, bw, bh, '📤 分享好友 继续挑战', ['#00b894', '#00cec9'])
  } else {
    render.drawButton(ctx, bx, by, bw, bh, '开始挑战', ['#667eea', '#764ba2'])
  }
  ctx.restore()

  // 排行榜按钮
  var by2 = H * 0.66
  render.drawButton(ctx, bx, by2, bw, bh * 0.9, '全国排行榜', ['rgba(102,126,234,0.15)', 'rgba(102,126,234,0.15)'], '#667eea')

  // 底部宣传
  render.drawText(ctx, '🎯 热身  →  ⚡ 加速  →  🔥 紫禁之巅', cx, H * 0.80, (W * 0.03) + 'px sans-serif', 'rgba(255,255,255,0.3)')
  render.drawText(ctx, '三局闯关 · 最后一关全国排名', cx, H * 0.85, (W * 0.028) + 'px sans-serif', 'rgba(255,255,255,0.2)')

  // 最高分 / 已玩过提示
  var best = wx.getStorageSync('bestScore') || 0
  if (best > 0) {
    render.drawText(ctx, '🏆 紫禁之巅最高 ' + best + ' 分', cx, H * 0.91, (W * 0.032) + 'px sans-serif', '#ffd700')
    render.drawText(ctx, '已有 ' + playCount + ' 人挑战过，你能超过他们吗？', cx, H * 0.95, (W * 0.024) + 'px sans-serif', 'rgba(255,255,255,0.2)')
  } else {
    render.drawText(ctx, '据说没人能在紫禁之巅撑过10秒', cx, H * 0.92, (W * 0.026) + 'px sans-serif', 'rgba(255,255,255,0.2)')
  }
}

// ========== 局间过渡（战报+规则+倒计时） ==========
function drawTransition() {
  var tints = ['rgba(78,205,196,0.06)', 'rgba(102,126,234,0.06)', 'rgba(255,50,50,0.06)']
  render.drawBG(ctx, W, H, tints[roundIdx])
  var cx = W / 2
  var r = ROUNDS[roundIdx]
  var elapsed = (Date.now() - transStart) / 1000
  var tagColors = ['#4ecdc4', '#667eea', '#ff4646']
  var tagColor = tagColors[roundIdx]
  var ease = Math.min(elapsed / 0.25, 1)
  ease = ease * (2 - ease)
  var st = safeTop
  var curY = st + 10

  // ============ 上半部：上局战报（非第一局） ============
  if (roundIdx > 0) {
    var prevScore = roundScores[roundIdx - 1]
    var prevTaps = roundTaps[roundIdx - 1]
    var prevCombo = roundMaxCombo[roundIdx - 1]
    var prevName = ROUNDS[roundIdx - 1].name
    var prevColor = tagColors[roundIdx - 1]

    // 战报卡片背景
    var reportH = H * 0.22
    ctx.globalAlpha = ease
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    render.roundRect(ctx, W * 0.06, curY, W * 0.88, reportH, 14)
    ctx.fill()

    // 上局名称
    render.drawText(ctx, prevName + ' 完成！', cx, curY + reportH * 0.18, (W * 0.03) + 'px sans-serif', prevColor)

    // 大分数
    render.drawText(ctx, '' + prevScore, cx, curY + reportH * 0.48, 'bold ' + (W * 0.1) + 'px sans-serif', '#ffd700')

    // 夸奖语
    var praise = ''
    if (roundIdx === 1) {
      // 第一局结束的夸奖
      if (prevScore >= 12) praise = '🔥 太猛了！热身就这么强'
      else if (prevScore >= 8) praise = '👏 不错！准备好加速了吗'
      else praise = '💪 热身完毕，真正的挑战开始'
    } else {
      // 第二局结束的夸奖
      if (prevScore >= 30) praise = '🔥 强者！最终关你也能行'
      else if (prevScore >= 18) praise = '👏 可以！但紫禁之巅更猛'
      else praise = '😏 接下来才是地狱难度'
    }
    render.drawText(ctx, praise, cx, curY + reportH * 0.72, (W * 0.03) + 'px sans-serif', 'rgba(255,255,255,0.5)')

    // 数据行
    render.drawText(ctx, prevTaps + '次点击  ·  最高' + prevCombo + '连击', cx, curY + reportH * 0.9, (W * 0.025) + 'px sans-serif', 'rgba(255,255,255,0.3)')

    ctx.globalAlpha = 1
    curY += reportH + 12
  }

  // ============ 分隔：箭头提示 ============
  if (roundIdx > 0) {
    render.drawText(ctx, '▼', cx, curY + 6, (W * 0.04) + 'px sans-serif', 'rgba(255,255,255,0.15)')
    curY += 18
  }

  // ============ 下半部：下一局信息 ============
  // 局序号
  ctx.globalAlpha = ease
  render.drawText(ctx, '— 第 ' + (roundIdx + 1) + ' / 3 局 —', cx, curY + 8, (W * 0.028) + 'px sans-serif', 'rgba(255,255,255,0.3)')
  ctx.globalAlpha = 1
  curY += 28

  // 局名（大）
  var nameSize = roundIdx === 2 ? W * 0.11 : W * 0.09
  var nameScale = ease < 1 ? 0.3 + ease * 0.7 : 1
  ctx.save()
  ctx.translate(cx, curY + 16)
  ctx.scale(nameScale, nameScale)
  ctx.globalAlpha = ease
  if (roundIdx === 2) {
    ctx.shadowColor = '#ff4646'
    ctx.shadowBlur = 12 + Math.sin(elapsed * 6) * 5
  }
  render.drawText(ctx, r.name, 0, 0, 'bold ' + nameSize + 'px sans-serif', roundIdx === 2 ? '#ff4646' : '#fff')
  ctx.shadowBlur = 0
  ctx.restore()
  curY += 44

  // 规则列表（紧凑）
  var rules = []
  if (roundIdx === 0) {
    rules = [
      { icon: '🎯', text: '点击表情圆点得分' },
      { icon: '⚡', text: '越快分越高' },
      { icon: '✅', text: '点满 3 个过关' }
    ]
  } else if (roundIdx === 1) {
    rules = [
      { icon: '⏱', text: '限时 ' + r.dur + ' 秒' },
      { icon: '💨', text: '圆点会消失！' },
      { icon: '🔥', text: '连击加成更高分' }
    ]
  } else {
    rules = [
      { icon: '⏱', text: '限时 ' + Math.min(r3BaseDur + shareCount, r3MaxDur) + ' 秒' },
      { icon: '⚡', text: '0.38秒极速消失！' },
      { icon: '🏆', text: '计入全国决战榜' }
    ]
  }

  ctx.globalAlpha = Math.min(1, Math.max(0, (elapsed - 0.1) * 4))
  for (var ri = 0; ri < rules.length; ri++) {
    var ry = curY + ri * (H * 0.055)
    render.drawText(ctx, rules[ri].icon + ' ' + rules[ri].text, cx, ry + 10, (W * 0.034) + 'px sans-serif', 'rgba(255,255,255,0.6)')
  }
  ctx.globalAlpha = 1
  curY += rules.length * H * 0.055 + 10

  // 难度条
  var barW2 = W * 0.25
  var barX2 = cx - barW2 / 2
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  render.roundRect(ctx, barX2, curY, barW2, 5, 3)
  ctx.fill()
  ctx.fillStyle = tagColor
  render.roundRect(ctx, barX2, curY, barW2 * ((roundIdx + 1) / 3) * ease, 5, 3)
  ctx.fill()
  var diffLabels = ['简单', '中等', '极难']
  render.drawText(ctx, diffLabels[roundIdx], cx, curY + 16, (W * 0.024) + 'px sans-serif', tagColor)

  // ============ 底部倒计时 ============
  if (transCount > 0) {
    var cdFrac = (elapsed * 1000 % (r.cdSpeed || 500)) / (r.cdSpeed || 500)
    var cdScale = 1 + Math.max(0, 0.3 - cdFrac * 0.3) * 2
    ctx.save()
    ctx.translate(cx, H * 0.88)
    ctx.scale(cdScale, cdScale)
    ctx.globalAlpha = 0.7 + (1 - cdFrac) * 0.3
    render.drawText(ctx, '' + transCount, 0, 0, 'bold ' + (W * 0.1) + 'px sans-serif', tagColor)
    ctx.restore()
    ctx.globalAlpha = 1
  } else {
    render.drawText(ctx, 'GO!', cx, H * 0.88, 'bold ' + (W * 0.12) + 'px sans-serif', tagColor)
  }
}

// ========== 游戏中 ==========
function drawPlay() {
  var r = ROUNDS[roundIdx]
  var tint = ['rgba(78,205,196,0.06)', 'rgba(102,126,234,0.08)', 'rgba(255,50,50,0.07)'][roundIdx]
  render.drawBG(ctx, W, H, tint)

  // 连击屏幕微震
  var shakeX = 0, shakeY = 0
  if (screenShake > 0) {
    var elapsed = Date.now() - screenShake
    if (elapsed < 150) {
      var intensity = 3 * (1 - elapsed / 150)
      shakeX = (Math.random() - 0.5) * intensity
      shakeY = (Math.random() - 0.5) * intensity
      ctx.save()
      ctx.translate(shakeX, shakeY)
    }
  }

  // HUD
  var hudY = safeTop + 10
  // 时间或剩余次数
  if (r.targetTaps) {
    var remain = r.targetTaps - tapCount
    render.drawText(ctx, remain + '', 36, hudY + 22, 'bold ' + (W * 0.08) + 'px sans-serif', '#4ecdc4', 'center')
    render.drawText(ctx, '个', 60, hudY + 22, (W * 0.03) + 'px sans-serif', 'rgba(255,255,255,0.4)', 'left')
  } else {
    var timerColor = timeLeft <= 3 ? '#ff6b6b' : '#4ecdc4'
    render.drawText(ctx, timeLeft + '', 36, hudY + 22, 'bold ' + (W * 0.08) + 'px sans-serif', timerColor, 'center')
    render.drawText(ctx, '秒', 60, hudY + 22, (W * 0.03) + 'px sans-serif', 'rgba(255,255,255,0.4)', 'left')
  }

  // 局名
  var tagColor = ['#4ecdc4', '#667eea', '#ff4646'][roundIdx]
  render.drawText(ctx, r.name, W / 2, hudY + 15, 'bold ' + (W * 0.035) + 'px sans-serif', tagColor)

  // 连击
  if (combo >= 3) {
    render.drawText(ctx, combo + '连击🔥', W / 2, hudY + 35, 'bold ' + (W * 0.03) + 'px sans-serif', '#ffd700')
  }

  // 得分
  render.drawText(ctx, score + '', W - 40, hudY + 22, 'bold ' + (W * 0.08) + 'px sans-serif', '#ffd700', 'right')
  render.drawText(ctx, '分', W - 12, hudY + 22, (W * 0.03) + 'px sans-serif', 'rgba(255,255,255,0.4)', 'right')

  // 进度条
  var barY = hudY + 50
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(0, barY, W, 3)
  var pct = r.targetTaps ? (tapCount / r.targetTaps) : (timeLeft / r.dur)
  var barColors = ['#4ecdc4', '#667eea', '#ff4646']
  ctx.fillStyle = timeLeft <= 3 ? '#ff4646' : barColors[roundIdx]
  ctx.fillRect(0, barY, W * pct, 3)

  // 提示
  render.drawText(ctx, '⚡ 反应越快分越高' + (r.autoHide > 0 ? ' · 圆点会消失！' : ''), W / 2, barY + 18, (W * 0.028) + 'px sans-serif', 'rgba(255,215,0,0.5)')

  // 圆点（表情版）
  if (dotVisible) {
    var age = Date.now() - dotTime
    // 渐入弹性缩放
    var scale = 1
    if (age < 120) {
      var t2 = age / 120
      scale = t2 < 0.6 ? (t2 / 0.6) * 1.3 : 1.3 - (t2 - 0.6) / 0.4 * 0.3
    }
    // 待机微微呼吸
    scale *= 1 + Math.sin(age / 300) * 0.05

    // 即将消失时平滑淡出
    var dotAlpha = 1
    if (r.autoHide > 0) {
      var hidePct = age / r.autoHide
      if (hidePct > 0.6) {
        // 后40%平滑淡出
        dotAlpha = 1 - (hidePct - 0.6) / 0.4
        // 缩小消失
        scale *= 0.5 + dotAlpha * 0.5
      }
    }

    ctx.save()
    ctx.translate(dotX, dotY)
    ctx.scale(scale, scale)
    ctx.globalAlpha = dotAlpha

    // 彩色光晕
    ctx.beginPath()
    ctx.arc(0, 0, DOT_R + 18, 0, Math.PI * 2)
    ctx.globalAlpha = dotAlpha * 0.15
    ctx.fillStyle = dotColor
    ctx.fill()
    ctx.globalAlpha = dotAlpha

    // 彩色底圆
    ctx.beginPath()
    ctx.arc(0, 0, DOT_R, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.fill()

    // 表情
    ctx.font = (DOT_R * 1.3) + 'px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(dotEmoji, 0, 1)

    // 扩散环
    var ring = (age % 900) / 900
    ctx.beginPath()
    ctx.arc(0, 0, DOT_R + ring * DOT_R * 1.2, 0, Math.PI * 2)
    ctx.strokeStyle = dotColor
    ctx.globalAlpha = dotAlpha * 0.3 * (1 - ring)
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.restore()
  }

  // 结束屏幕震动偏移
  if (screenShake > 0 && (Date.now() - screenShake) < 150) {
    ctx.restore()
  }

  // 涟漪
  var now = Date.now()
  for (var ri = ripples.length - 1; ri >= 0; ri--) {
    var rp = ripples[ri]
    var rAge = (now - rp.born) / 500
    if (rAge > 1) { ripples.splice(ri, 1); continue }
    ctx.beginPath()
    ctx.arc(rp.x, rp.y, DOT_R * (1 + rAge * 3), 0, Math.PI * 2)
    ctx.strokeStyle = rp.color
    ctx.globalAlpha = 0.6 * (1 - rAge)
    ctx.lineWidth = 3 * (1 - rAge)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // 粒子（圆点+表情）
  for (var pi = particles.length - 1; pi >= 0; pi--) {
    var pt = particles[pi]
    var pAge = (now - pt.born) / 600
    if (pAge > 1) { particles.splice(pi, 1); continue }
    pt.x += pt.vx
    pt.y += pt.vy
    pt.vy += 0.15  // 重力
    ctx.globalAlpha = 1 - pAge

    if (pt.emoji) {
      // 表情粒子：旋转飞出
      ctx.save()
      ctx.translate(pt.x, pt.y)
      ctx.rotate(pAge * 3)
      var eSize = (12 + pt.size * 2) * (1 - pAge * 0.3)
      ctx.font = eSize + 'px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(pt.emoji, 0, 0)
      ctx.restore()
    } else {
      // 普通彩色圆点
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, pt.size * (1 - pAge * 0.5), 0, Math.PI * 2)
      ctx.fillStyle = pt.color
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // 飘分（升级版：缩放+弹性）
  for (var i = floats.length - 1; i >= 0; i--) {
    var f = floats[i]
    var fAge = (now - f.born) / 900
    if (fAge > 1) { floats.splice(i, 1); continue }

    // 弹性缩放：先放大再缩回
    var fScale = 1
    if (fAge < 0.15) {
      fScale = 0.5 + (fAge / 0.15) * 1.0  // 0.5 -> 1.5
    } else if (fAge < 0.3) {
      fScale = 1.5 - ((fAge - 0.15) / 0.15) * 0.5 // 1.5 -> 1.0
    }
    if (f.big) fScale *= 1.3

    var fy = f.y - fAge * 80
    ctx.globalAlpha = fAge < 0.8 ? 1 : (1 - (fAge - 0.8) / 0.2)

    ctx.save()
    ctx.translate(f.x, fy)
    ctx.scale(fScale, fScale)

    // 分数文字带描边
    var fontSize = f.big ? W * 0.08 : W * 0.06
    ctx.font = 'bold ' + fontSize + 'px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 3
    ctx.strokeText(f.text, 0, 0)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, 0, 0)

    // 反应毫秒数
    if (f.ms) {
      var msSize = W * 0.025
      ctx.font = msSize + 'px sans-serif'
      ctx.fillStyle = f.msColor || 'rgba(255,255,255,0.4)'
      ctx.fillText(f.ms, 0, -fontSize * 0.55)
    }

    // 标签（连击/速度评价）
    if (f.label) {
      var lSize = f.big ? W * 0.035 : W * 0.028
      ctx.font = 'bold ' + lSize + 'px sans-serif'
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 2
      ctx.strokeText(f.label, 0, fontSize * 0.6)
      ctx.fillStyle = f.color
      ctx.fillText(f.label, 0, fontSize * 0.6)
    }

    ctx.restore()
    ctx.globalAlpha = 1
  }

  // 连击闪光背景
  if (screenShake > 0 && (now - screenShake) < 200) {
    var shakeAlpha = 0.08 * (1 - (now - screenShake) / 200)
    ctx.fillStyle = '#ffd700'
    ctx.globalAlpha = shakeAlpha
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }
}

// ========== 结算页 ==========
function drawResult() {
  render.drawBG(ctx, W, H, 'rgba(102,126,234,0.06)')
  var cx = W / 2

  // === 顶部：第三局突出 + 前两局小字 ===
  var rTop = safeTop + 10
  render.drawText(ctx, '🏆 紫禁之巅', cx, rTop + H * 0.02, 'bold ' + (W * 0.04) + 'px sans-serif', '#ff4646')
  render.drawText(ctx, '' + roundScores[2], cx, rTop + H * 0.07, 'bold ' + (W * 0.1) + 'px sans-serif', '#ffd700')
  var names12 = ['指尖热身', '速点之王']
  var colors12 = ['#4ecdc4', '#667eea']
  for (var i = 0; i < 2; i++) {
    var sx = W * 0.28 + i * W * 0.44
    render.drawText(ctx, names12[i] + ' ' + roundScores[i], sx, rTop + H * 0.115, (W * 0.025) + 'px sans-serif', colors12[i])
  }
  var total = roundScores[0] + roundScores[1] + roundScores[2]
  var totalTaps = roundTaps[0] + roundTaps[1] + roundTaps[2]
  var bestCombo = Math.max(roundMaxCombo[0], roundMaxCombo[1], roundMaxCombo[2])
  render.drawText(ctx, '总分 ' + total + '  ·  点击 ' + totalTaps + '次  ·  最高' + bestCombo + '连击', cx, rTop + H * 0.145, (W * 0.025) + 'px sans-serif', 'rgba(255,255,255,0.35)')

  // === 中间：紫禁之巅决战榜 ===
  var tabY = rTop + H * 0.17
  render.drawText(ctx, '🏆 紫禁之巅决战榜', cx, tabY + 10, 'bold ' + (W * 0.038) + 'px sans-serif', '#ff4646')

  // 排行榜列表
  var listY = tabY + 30
  var rowH = 52
  var btnAreaH = needShareUI ? H * 0.18 : H * 0.12  // 底部按钮区预留高度
  if (rankLoading) {
    render.drawText(ctx, '加载中...', cx, listY + 40, (W * 0.04) + 'px sans-serif', 'rgba(255,255,255,0.3)')
  } else if (rankList.length === 0) {
    render.drawText(ctx, '暂无记录，快来争第一！', cx, listY + 40, (W * 0.04) + 'px sans-serif', 'rgba(255,255,255,0.3)')
  } else {
    var medals = ['🥇', '🥈', '🥉']
    var maxShow = Math.min(rankList.length, 10)
    for (var ri = 0; ri < maxShow; ri++) {
      var ry = listY + ri * rowH
      if (ry > H - btnAreaH - 10) break
      var item = rankList[ri]
      if (ri < 3) {
        ctx.fillStyle = 'rgba(255,215,0,0.04)'
        ctx.fillRect(W * 0.04, ry, W * 0.92, rowH - 4)
      }
      var rankStr = ri < 3 ? medals[ri] : '' + (ri + 1)
      render.drawText(ctx, rankStr, W * 0.1, ry + rowH / 2, (W * 0.05) + 'px sans-serif', ri < 3 ? '#ffd700' : 'rgba(255,255,255,0.35)', 'center')
      render.drawText(ctx, (item.nickname || '匿名').substring(0, 6), W * 0.28, ry + rowH / 2, (W * 0.042) + 'px sans-serif', ri < 3 ? '#fff' : 'rgba(255,255,255,0.65)', 'left')
      render.drawText(ctx, item.score + '分', W * 0.9, ry + rowH / 2, 'bold ' + (W * 0.05) + 'px sans-serif', ri < 3 ? '#ffd700' : 'rgba(255,215,0,0.7)', 'right')
    }
  }

  // === 底部：按钮区域 ===
  var bw = W * 0.5, bh = W * 0.085
  var bx = cx - bw / 2

  if (needShareUI) {
    var btnY = H - bh * 2 - 30
    render.drawText(ctx, '分享好友即可继续挑战', cx, btnY - 14, (W * 0.026) + 'px sans-serif', 'rgba(255,255,255,0.4)')
    render.drawButton(ctx, bx, btnY, bw, bh, '📤 分享好友 再来一局', ['#00b894', '#00cec9'])
    render.drawText(ctx, '返回首页', cx, H - 18, (W * 0.028) + 'px sans-serif', 'rgba(255,255,255,0.25)')
  } else {
    var btnY = H - bh - 36
    render.drawButton(ctx, bx, btnY, bw, bh, '再来一局', ['#667eea', '#764ba2'])
    render.drawText(ctx, '返回首页', cx, H - 18, (W * 0.028) + 'px sans-serif', 'rgba(255,255,255,0.25)')
  }
}

// ========== 场景切换 ==========
function goHome() { scene = 'home' }

function startGame() {
  if (!nickname) {
    askNickname(function () {
      if (nickname) startGame()
    })
    return
  }
  // 超过免费次数，必须分享
  if (playCount >= 1) {
    shareGame()
    return
  }
  beginRound(0)
}

function beginRound(idx) {
  roundIdx = idx
  score = 0; combo = 0; tapCount = 0; maxCombo = 0; floats = []; ripples = []; particles = []; screenShake = 0
  // 第三局时长 = 基础10秒 + 分享次数（上限30秒）
  if (idx === 2) {
    timeLeft = Math.min(r3BaseDur + shareCount, r3MaxDur)
  } else {
    timeLeft = ROUNDS[idx].dur
  }
  dotVisible = false
  lastTapTime = 0
  scene = 'transition'
  var r = ROUNDS[idx]
  transCount = r.cdSteps  // 第一局3-2-1，第二局2-1，第三局直接1
  transStart = Date.now()

  var cdTimer = setInterval(function () {
    transCount--
    if (transCount <= 0) {
      clearInterval(cdTimer)
      scene = 'play'
      if (idx === 0) audio.startBGM()
      spawnDot()

      // 第一局：不限时，点满targetTaps个就结束（由tapDot里触发endRound）
      // 其他局：倒计时模式
      if (r.dur > 0) {
        gameTimer = setInterval(function () {
          timeLeft--
          if (timeLeft <= 0) {
            endRound(idx)
          }
        }, 1000)
      }
    }
  }, r.cdSpeed)  // 第一局0.6秒/跳，第二局0.5秒，第三局0.4秒
}

function endRound(idx) {
  clearInterval(gameTimer)
  clearTimeout(hideTimer)
  dotVisible = false
  audio.playEnd()
  try { wx.vibrateShort({ type: 'heavy' }) } catch (e) { }
  roundScores[idx] = score
  roundTaps[idx] = tapCount
  roundMaxCombo[idx] = maxCombo
  var next = idx + 1
  if (next < ROUNDS.length) {
    setTimeout(function () { beginRound(next) }, 600)
  } else {
    audio.stopBGM()
    finishGame()
  }
}

function spawnDot() {
  clearTimeout(hideTimer)
  var pad = DOT_R + 20
  var topPad = safeTop + 90
  dotX = pad + Math.random() * (W - pad * 2)
  dotY = topPad + pad + Math.random() * (H - topPad - pad * 2 - safeBottom)
  dotColor = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)]
  dotEmoji = DOT_EMOJIS[Math.floor(Math.random() * DOT_EMOJIS.length)]
  dotVisible = true
  dotTime = Date.now()

  var r = ROUNDS[roundIdx]
  if (r.autoHide > 0) {
    hideTimer = setTimeout(function () {
      if (dotVisible) {
        dotVisible = false
        combo = 0
        setTimeout(function () { if (scene === 'play') spawnDot() }, 200)
      }
    }, r.autoHide)
  }
}

function tapDot(tx, ty) {
  var curR = ROUNDS[roundIdx]
  if (!dotVisible) return
  if (!curR.targetTaps && timeLeft <= 0) return
  var dist = Math.sqrt((tx - dotX) * (tx - dotX) + (ty - dotY) * (ty - dotY))
  if (dist > DOT_R + 15) {
    // miss
    try { wx.vibrateShort({ type: 'heavy' }) } catch (e) { }
    audio.playMiss()
    combo = 0
    return
  }

  clearTimeout(hideTimer)
  var now = Date.now()
  var reaction = now - dotTime
  var points
  if (reaction < 200) points = 5
  else if (reaction < 400) points = 4
  else if (reaction < 600) points = 3
  else if (reaction < 900) points = 2
  else points = 1

  var newScore = Math.min(score + points, MAX_SCORE)
  points = newScore - score
  if (points <= 0) return

  // 点击计数
  tapCount++

  // 连击
  if (lastTapTime > 0 && (now - lastTapTime) < 1200 && reaction < 600) combo++
  else combo = 1
  if (combo > maxCombo) maxCombo = combo
  lastTapTime = now

  score = newScore
  try { wx.vibrateShort({ type: combo >= 5 ? 'medium' : 'light' }) } catch (e) { }

  audio.playHit(points)

  var labels = { 5: '极速!', 4: '超快!', 3: '不错!' }
  var fcolor = points >= 4 ? '#ffd700' : points >= 3 ? '#4ecdc4' : 'rgba(255,255,255,0.7)'

  // 飘分（含反应毫秒数）
  var msText = reaction + 'ms'
  var comboLabel = combo >= 3 ? combo + '连击!' : (labels[points] || '')
  floats.push({
    x: dotX, y: dotY,
    text: '+' + points,
    label: comboLabel,
    ms: msText,
    color: fcolor,
    msColor: reaction < 200 ? '#ffd700' : reaction < 400 ? '#4ecdc4' : reaction < 600 ? '#a29bfe' : 'rgba(255,255,255,0.4)',
    born: now,
    big: combo >= 5 || points >= 5
  })

  // 涟漪扩散
  ripples.push({ x: dotX, y: dotY, color: dotColor, born: now })
  if (combo >= 3) {
    ripples.push({ x: dotX, y: dotY, color: '#ffd700', born: now + 80 })
  }

  // 粒子爆发（彩色圆点+表情）
  var pCount = combo >= 5 ? 10 : combo >= 3 ? 7 : 4
  for (var p = 0; p < pCount; p++) {
    var angle = Math.PI * 2 * p / pCount + Math.random() * 0.5
    var speed = 1.5 + Math.random() * 2.5
    particles.push({
      x: dotX, y: dotY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: p % 2 === 0 ? dotColor : fcolor,
      born: now,
      size: 2 + Math.random() * 3,
      emoji: p < 3 ? dotEmoji : ''  // 前3个粒子是表情
    })
  }

  // 连击屏幕震动
  if (combo >= 3) screenShake = now

  dotVisible = false

  // 第一局：点满目标数结束
  var curRound = ROUNDS[roundIdx]
  if (curRound.targetTaps && tapCount >= curRound.targetTaps) {
    endRound(roundIdx)
    return
  }

  setTimeout(function () { if (scene === 'play') spawnDot() }, 120)
}

function finishGame() {
  playCount++
  // 只有第1把免费，之后必须分享才能继续
  needShareUI = playCount >= 1
  scene = 'result'
  rankTab = 3
  loadRanking(rankTab)
  submitScores()

  // 保存最高分
  for (var i = 0; i < 3; i++) {
    var key = 'bestScore_r' + (i + 1)
    var old = wx.getStorageSync(key) || 0
    if (roundScores[i] > old) wx.setStorageSync(key, roundScores[i])
  }
  var maxS = Math.max(roundScores[0], roundScores[1], roundScores[2])
  var oldBest = wx.getStorageSync('bestScore') || 0
  if (maxS > oldBest) wx.setStorageSync('bestScore', maxS)
}

function submitScores() {
  for (var i = 0; i < 3; i++) {
    if (roundScores[i] <= 0) continue
    try {
      (function (s, r) {
        wx.cloud.callFunction({
          name: 'updateScore',
          data: { score: s, nickname: nickname, round: r }
        })
      })(roundScores[i], i + 1)
    } catch (e) { }
  }
}

function loadRanking(tab) {
  rankLoading = true; rankList = []
  try {
    var db = wx.cloud.database()
    db.collection('ranking')
      .where({ round: tab })
      .orderBy('score', 'desc')
      .limit(50)
      .get()
      .then(function (res) { rankList = res.data; rankLoading = false })
      .catch(function () { rankLoading = false })
  } catch (e) { rankLoading = false }
}

// ========== 触摸事件 ==========
wx.onTouchStart(function (e) {
  var touch = e.touches[0]
  var tx = touch.clientX, ty = touch.clientY
  var cx = W / 2
  var bw = W * 0.6, bh = W * 0.12
  var bx = cx - bw / 2

  if (scene === 'home') {
    // 开始按钮
    if (render.hitTest(tx, ty, bx, H * 0.52, bw, bh)) {
      startGame(); return
    }
    // 点击昵称区域
    if (ty > H * 0.40 && ty < H * 0.48) {
      askNickname(null)
      return
    }
    // 排行榜
    if (render.hitTest(tx, ty, bx, H * 0.66, bw, bh * 0.9)) {
      scene = 'result'; needShareUI = false; rankTab = 3
      loadRanking(2); return
    }
  } else if (scene === 'play') {
    tapDot(tx, ty)
  } else if (scene === 'result') {
    // 底部按钮区域
    var bw2 = W * 0.5, bh2 = W * 0.085
    var bx2 = cx - bw2 / 2

    // 返回首页（底部小字，两种模式通用）
    if (render.hitTest(tx, ty, cx - W * 0.15, H - 32, W * 0.3, 28)) {
      goHome(); return
    }

    if (needShareUI) {
      var btnY2 = H - bh2 * 2 - 30
      if (render.hitTest(tx, ty, bx2, btnY2, bw2, bh2)) {
        shareGame(); return
      }
    } else {
      var btnY2 = H - bh2 - 36
      if (render.hitTest(tx, ty, bx2, btnY2, bw2, bh2)) {
        startGame(); return
      }
    }
  }
})

// ========== 分享 ==========
function shareGame() {
  waitingShareReturn = true
  wx.shareAppMessage({
    title: '点呀~点·紫禁之巅我拿了' + roundScores[2] + '分！你敢来战吗？'
  })
}

wx.onShow(function () {
  if (waitingShareReturn) {
    waitingShareReturn = false
    shareCount++
    needShareUI = false
    wx.showModal({
      title: '分享成功',
      content: '分享成功，再来一局！',
      showCancel: false,
      success: function () {
        beginRound(0)
      }
    })
  }
})

wx.onShareAppMessage(function () {
  return {
    title: '点呀~点！紫禁之巅等你来战！',
    query: ''
  }
})

// ========== 启动 ==========
requestAnimationFrame(frame)
