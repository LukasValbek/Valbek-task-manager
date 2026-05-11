// Canvas-based image annotation editor
// Usage: openAnnotator(imageBlob, onConfirm)
// onConfirm(annotatedBlob) – called with PNG blob containing annotations

function openAnnotator(imageBlob, onConfirm) {
  const url = URL.createObjectURL(imageBlob)
  const img = new Image()
  img.onload = () => _buildAnnotator(img, url, onConfirm)
  img.onerror = () => { URL.revokeObjectURL(url); showError('Nelze načíst obrázek.') }
  img.src = url
}

function _buildAnnotator(img, blobUrl, onConfirm) {
  const maxW  = window.innerWidth  * 0.88
  const maxH  = window.innerHeight * 0.66
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
  const cw    = Math.round(img.naturalWidth  * scale)
  const ch    = Math.round(img.naturalHeight * scale)

  const COLORS = [
    { hex: '#ef4444', label: 'Červená' },
    { hex: '#eab308', label: 'Žlutá'   },
    { hex: '#3b82f6', label: 'Modrá'   },
    { hex: '#111827', label: 'Černá'   },
  ]

  const overlay = document.createElement('div')
  overlay.className = 'annotator-overlay'
  overlay.innerHTML = `
    <div class="annotator-toolbar">
      <span class="ann-label">Pero:</span>
      ${COLORS.map((c, i) => `
        <button class="ann-color ${i === 0 ? 'ann-color-active' : ''}"
          data-color="${c.hex}" style="background:${c.hex}" title="${c.label}"></button>
      `).join('')}
      <div class="ann-sep"></div>
      <button class="ann-btn" id="ann-undo">↩ Undo</button>
      <div style="flex:1"></div>
      <button class="ann-btn ann-btn-cancel" id="ann-cancel">Zrušit</button>
      <button class="ann-btn ann-btn-confirm" id="ann-confirm">Vložit</button>
    </div>
    <canvas id="ann-canvas" class="annotator-canvas" width="${cw}" height="${ch}"></canvas>
    <p class="ann-hint">Kreslete myší · Undo odstraní poslední tah</p>
  `
  document.body.appendChild(overlay)

  const canvas = overlay.querySelector('#ann-canvas')
  const ctx    = canvas.getContext('2d')
  let color    = COLORS[0].hex
  let drawing  = false
  let paths    = []
  let current  = null

  ctx.drawImage(img, 0, 0, cw, ch)
  const baseSnap = ctx.getImageData(0, 0, cw, ch)

  function redraw() {
    ctx.putImageData(baseSnap, 0, 0)
    paths.forEach(path => _drawPath(ctx, path))
  }

  function _drawPath(ctx, path) {
    if (path.length < 2) return
    ctx.beginPath()
    ctx.strokeStyle = path[0].color
    ctx.lineWidth   = 3
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
    ctx.stroke()
  }

  function _drawSegment(from, to) {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth   = 3
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  function getPos(e) {
    const r  = canvas.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (cx - r.left) * (cw / r.width), y: (cy - r.top) * (ch / r.height), color }
  }

  // Mouse events
  canvas.addEventListener('mousedown', e => {
    drawing = true; current = [getPos(e)]; e.preventDefault()
  })
  canvas.addEventListener('mousemove', e => {
    if (!drawing || !current) return
    const pt = getPos(e)
    _drawSegment(current[current.length - 1], pt)
    current.push(pt)
  })
  function endStroke() {
    if (drawing && current && current.length > 1) paths.push(current)
    current = null; drawing = false
  }
  canvas.addEventListener('mouseup',    endStroke)
  canvas.addEventListener('mouseleave', endStroke)

  // Touch events
  canvas.addEventListener('touchstart', e => {
    drawing = true; current = [getPos(e)]; e.preventDefault()
  }, { passive: false })
  canvas.addEventListener('touchmove', e => {
    if (!drawing || !current) return
    const pt = getPos(e)
    _drawSegment(current[current.length - 1], pt)
    current.push(pt)
    e.preventDefault()
  }, { passive: false })
  canvas.addEventListener('touchend', endStroke)

  // Color picker
  overlay.querySelectorAll('.ann-color').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.ann-color').forEach(b => b.classList.remove('ann-color-active'))
      btn.classList.add('ann-color-active')
      color = btn.dataset.color
    })
  })

  // Undo
  overlay.querySelector('#ann-undo').addEventListener('click', () => {
    paths.pop(); redraw()
  })

  // Cancel
  overlay.querySelector('#ann-cancel').addEventListener('click', () => {
    URL.revokeObjectURL(blobUrl)
    overlay.remove()
  })

  // Confirm
  overlay.querySelector('#ann-confirm').addEventListener('click', () => {
    canvas.toBlob(blob => {
      URL.revokeObjectURL(blobUrl)
      overlay.remove()
      onConfirm(blob)
    }, 'image/png')
  })
}
