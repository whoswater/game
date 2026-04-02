// Canvas 渲染工具函数

// 圆角矩形
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// 渐变按钮
function drawButton(ctx, x, y, w, h, text, colors, textColor) {
  var grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, colors[0])
  grad.addColorStop(1, colors[1])
  ctx.fillStyle = grad
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.fill()

  ctx.fillStyle = textColor || '#fff'
  ctx.font = 'bold ' + Math.floor(h * 0.38) + 'px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}

// 点击检测
function hitTest(tx, ty, x, y, w, h) {
  return tx >= x && tx <= x + w && ty >= y && ty <= y + h
}

// 居中文字
function drawText(ctx, text, x, y, font, color, align) {
  ctx.fillStyle = color || '#fff'
  ctx.font = font || '16px sans-serif'
  ctx.textAlign = align || 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

// 背景
function drawBG(ctx, W, H, tint) {
  ctx.fillStyle = '#0a0a1a'
  ctx.fillRect(0, 0, W, H)
  // 光球
  var grad = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.5)
  grad.addColorStop(0, tint || 'rgba(102,126,234,0.08)')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

module.exports = {
  roundRect: roundRect,
  drawButton: drawButton,
  hitTest: hitTest,
  drawText: drawText,
  drawBG: drawBG
}
