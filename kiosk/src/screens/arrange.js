import { navigate } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

export function renderArrangeScreen() {
  console.log('[Arrange] renderArrangeScreen called')
  console.log('[Arrange] session.theme:', state.session.theme)
  console.log('[Arrange] session.photos count:', state.session.photos?.length)

  const el          = document.getElementById('screen-arrange')
  const photos      = state.session.photos || []
  const copyCount   = state.session.copyCount
  const theme       = state.session.theme
  const photoCount  = theme?.photoCount || 4
  const placeholder = theme?.placeholderColor || '#ffffff'

  console.log('[Arrange] copyCount:', copyCount, '| photoCount:', photoCount, '| placeholderColor:', placeholder)
  console.log('[Arrange] templateLayer:', theme?.templateLayer)

  // layouts[copyIdx][slotIdx] = photo | null
  const layouts = Array.from({ length: copyCount }, () => Array(photoCount).fill(null))

  // selectedSlot = { ci, si } — ô đang chờ chọn ảnh
  let selectedSlot = null

  const templateURL = theme?.templateLayer
    ? `http://localhost:3001/${theme.templateLayer}`
    : null

  console.log('[Arrange] templateURL:', templateURL)

  el.innerHTML = `
    <div class="arrange-layout">
      <!-- Left: pool ảnh đã chụp -->
      <div class="arrange-pool-wrap">
        <div class="arrange-pool-header">
          <p class="text-sm text-muted" style="letter-spacing:.12em;text-transform:uppercase">Ảnh đã chụp</p>
          <p class="text-sm text-muted" id="pool-hint">${photos.length} bức · Click ô rồi click ảnh</p>
        </div>
        <div class="arrange-pool scroll-area" id="photo-pool">
          ${photos.map((p, i) => `
            <div class="pool-photo" data-idx="${i}">
              <img src="http://localhost:3001/${p.filePath}" alt="Ảnh ${i+1}"
                   onerror="this.style.opacity='.2'">
              <span class="pool-num">${p.takeRound === 2 ? 'R' : ''}${i+1}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right: template preview -->
      <div class="arrange-preview-wrap">
        <div class="arrange-preview-header">
          <div>
            <p class="text-sm text-muted" style="letter-spacing:.12em;text-transform:uppercase">Ghép ảnh vào template</p>
            <h2 class="display-md" style="margin-top:6px">
              Click ô → click <span class="text-accent">ảnh</span>
            </h2>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <button class="btn btn-ghost btn-sm" onclick="clearAll()">Xóa hết</button>
            <button class="btn btn-primary btn-lg" id="confirm-btn"
                    onclick="confirmArrange()" disabled style="opacity:.4">
              Hoàn tất &nbsp;→
            </button>
          </div>
        </div>

        ${copyCount > 1 ? `
          <div class="copy-tabs" id="copy-tabs">
            ${Array.from({length: copyCount}, (_,i) => `
              <button class="copy-tab ${i===0?'active':''}" onclick="switchCopy(${i})">
                Tấm ${i+1}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div class="template-previews scroll-area" id="template-previews">
          ${Array.from({length: copyCount}, (_,ci) => `
            <div class="template-copy ${ci===0?'active':''}" id="copy-${ci}">
              <div class="template-frame" id="frame-${ci}">
                ${templateURL
                  ? `<img src="${templateURL}" class="template-overlay"
                          id="tmpl-img-${ci}" crossorigin="anonymous"
                          alt="template">`
                  : `<div class="template-overlay template-placeholder">
                      <p class="text-sm text-muted">Chưa có template</p>
                     </div>`
                }
                <div class="slot-container" id="slots-${ci}">
                  ${Array.from({length: photoCount}, (_,si) => `
                    <div class="photo-slot empty"
                         id="slot-${ci}-${si}"
                         data-copy="${ci}" data-slot="${si}">
                      <div class="slot-hint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="1.5" width="20" height="20">
                          <rect x="3" y="3" width="18" height="18" rx="3"/>
                          <path d="M12 8v8M8 12h8"/>
                        </svg>
                        <span>${si+1}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
              <p class="text-sm text-muted" style="text-align:center;margin-top:10px">
                Tấm ${ci+1} —
                <span id="fill-count-${ci}">0</span>/${photoCount} ảnh
              </p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `

  // ── Detect zones sau khi render ──────────────────────────────────────────
  if (templateURL) {
    for (let ci = 0; ci < copyCount; ci++) {
      detectAndPositionSlots(ci, templateURL, photoCount, placeholder)
    }
  } else {
    console.log('[Arrange] Không có template, dùng fallback chia đều')
    for (let ci = 0; ci < copyCount; ci++) {
      positionSlotsEven(ci, photoCount)
    }
  }

  // ── Click handler: slot ───────────────────────────────────────────────────
  function onSlotClick(ci, si) {
    const slotEl = document.getElementById(`slot-${ci}-${si}`)
    console.log(`[Arrange] Slot clicked: copy=${ci} slot=${si}`)

    // Nếu slot đã có ảnh → xóa
    if (layouts[ci][si]) {
      console.log(`[Arrange] Xóa ảnh khỏi slot ${ci}-${si}`)
      removeSlotFn(ci, si)
      return
    }

    // Bỏ chọn slot cũ nếu có
    if (selectedSlot) {
      const prev = document.getElementById(`slot-${selectedSlot.ci}-${selectedSlot.si}`)
      prev?.classList.remove('selected')
      // Nếu click cùng slot → bỏ chọn
      if (selectedSlot.ci === ci && selectedSlot.si === si) {
        selectedSlot = null
        updateHint()
        return
      }
    }

    // Chọn slot mới
    selectedSlot = { ci, si }
    slotEl.classList.add('selected')
    updateHint(`Đang chọn ô ${si+1} tấm ${ci+1} — click ảnh bên trái`)
    console.log(`[Arrange] Slot ${ci}-${si} được chọn, chờ click ảnh`)
  }

  // ── Click handler: pool photo ─────────────────────────────────────────────
  function onPhotoClick(idx) {
    console.log(`[Arrange] Photo clicked: idx=${idx}`, photos[idx]?.filePath)

    if (!selectedSlot) {
      console.log('[Arrange] Chưa chọn ô nào — bỏ qua')
      updateHint('Hãy click vào 1 ô trong template trước!')
      setTimeout(() => updateHint(), 2000)
      return
    }

    const { ci, si } = selectedSlot
    const photo = photos[idx]
    console.log(`[Arrange] Đặt ảnh ${idx} vào slot ${ci}-${si}`)

    fillSlot(ci, si, photo)
    selectedSlot = null
    updateHint()
  }

  function fillSlot(ci, si, photo) {
    layouts[ci][si] = photo
    const slotEl = document.getElementById(`slot-${ci}-${si}`)
    if (!slotEl) return
    slotEl.classList.remove('empty', 'selected')
    slotEl.dataset.filled = '1'
    slotEl.style.zIndex = '3'  // đè lên template overlay (z-index:2)
    slotEl.innerHTML = `
      <img src="http://localhost:3001/${photo.filePath}"
           alt="Ảnh" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none"
           onerror="this.style.opacity='.2'">
      <div class="slot-remove-btn">✕</div>
    `
    updateFillCount(ci)
    updateConfirmBtn()
    console.log(`[Arrange] fillSlot done: ci=${ci} si=${si} | filled:`, layouts[ci].filter(Boolean).length)
  }

  function removeSlotFn(ci, si) {
    layouts[ci][si] = null
    const slotEl = document.getElementById(`slot-${ci}-${si}`)
    if (!slotEl) return
    slotEl.classList.add('empty')
    slotEl.classList.remove('selected')
    slotEl.dataset.filled = '0'
    slotEl.style.zIndex = '1'  // trả về dưới template khi trống
    slotEl.innerHTML = `
      <div class="slot-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" width="20" height="20">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
        <span>${si+1}</span>
      </div>
    `
    updateFillCount(ci)
    updateConfirmBtn()
    console.log(`[Arrange] removeSlot done: ci=${ci} si=${si}`)
  }

  function updateHint(msg) {
    const el = document.getElementById('pool-hint')
    if (el) el.textContent = msg || `${photos.length} bức · Click ô rồi click ảnh`
  }

  function updateFillCount(ci) {
    const filled = layouts[ci].filter(p => p !== null).length
    const el = document.getElementById(`fill-count-${ci}`)
    if (el) el.textContent = filled
  }

  function updateConfirmBtn() {
    const allFilled = layouts.every(copy => copy.every(slot => slot !== null))
    const btn = document.getElementById('confirm-btn')
    if (btn) { btn.disabled = !allFilled; btn.style.opacity = allFilled ? '1' : '.4' }
    console.log('[Arrange] updateConfirmBtn: allFilled=', allFilled)
  }

  window.switchCopy = (ci) => {
    console.log('[Arrange] switchCopy:', ci)
    document.querySelectorAll('.copy-tab').forEach((t,i) => t.classList.toggle('active', i===ci))
    document.querySelectorAll('.template-copy').forEach((c,i) => c.classList.toggle('active', i===ci))
  }

  window.clearAll = () => {
    console.log('[Arrange] clearAll')
    for (let ci = 0; ci < copyCount; ci++) {
      for (let si = 0; si < photoCount; si++) {
        if (layouts[ci][si]) removeSlotFn(ci, si)
      }
    }
    selectedSlot = null
    updateHint()
  }

  window.confirmArrange = async () => {
    console.log('[Arrange] confirmArrange called, layouts:', JSON.stringify(layouts.map(c => c.map(p => p?._id))))
    const btn = document.getElementById('confirm-btn')
    btn.disabled = true; btn.textContent = 'Đang xử lý...'
    try {
      const layoutPayload = layouts.map((copy, ci) => ({
        copyIndex: ci,
        photoArrangement: copy.map(p => p?._id || null),
      }))
      console.log('[Arrange] Sending layoutPayload:', layoutPayload)
      const outputData = await API.saveOutput(state.session.id, layoutPayload)
      console.log('[Arrange] saveOutput response:', outputData)
      setState('session.layouts', layouts)
      setState('session.outputs', outputData.data || [])
      navigate('thankyou')
    } catch (err) {
      console.error('[Arrange] confirmArrange error:', err)
      btn.disabled = false; btn.textContent = 'Hoàn tất →'
    }
  }

  // ── Gắn click handlers sau khi render xong ───────────────────────────────
  setTimeout(() => {
    // Event delegation cho toàn bộ slot-container — 1 listener duy nhất
    for (let ci = 0; ci < copyCount; ci++) {
      const container = document.getElementById(`slots-${ci}`)
      if (!container) continue
      container.addEventListener('click', (e) => {
        // Click nút xóa
        const removeBtn = e.target.closest('.slot-remove-btn')
        if (removeBtn) {
          const slot = removeBtn.closest('.photo-slot')
          if (!slot) return
          const c = parseInt(slot.dataset.copy)
          const s = parseInt(slot.dataset.slot)
          console.log(`[Arrange] Remove btn clicked: copy=${c} slot=${s}`)
          removeSlotFn(c, s)
          return
        }
        // Click slot
        const slot = e.target.closest('.photo-slot')
        if (!slot) return
        const c = parseInt(slot.dataset.copy)
        const s = parseInt(slot.dataset.slot)
        onSlotClick(c, s)
      })
    }
    // Pool photos — event delegation trên pool
    const pool = document.getElementById('photo-pool')
    if (pool) {
      pool.addEventListener('click', (e) => {
        const photo = e.target.closest('.pool-photo')
        if (!photo) return
        onPhotoClick(parseInt(photo.dataset.idx))
      })
    }
    console.log('[Arrange] Event delegation attached (single listeners)')
  }, 150)
}

// ── Zone detection theo màu ────────────────────────────────────────────────
function detectAndPositionSlots(ci, templateURL, photoCount, hexColor) {
  console.log(`[Arrange][Detect] ci=${ci} | color=${hexColor} | photoCount=${photoCount}`)
  const img = document.getElementById(`tmpl-img-${ci}`)
  if (!img) {
    console.warn(`[Arrange][Detect] Không tìm thấy tmpl-img-${ci}`)
    return
  }

  const run = () => {
    const frame = document.getElementById(`frame-${ci}`)
    if (!frame) return

    // Đảm bảo frame đã có kích thước thực — retry nếu chưa có
    const frameW = frame.offsetWidth
    const frameH = frame.offsetHeight
    console.log(`[Arrange][Detect] frame size: ${frameW}x${frameH}`)

    if (!frameW || !frameH) {
      console.warn(`[Arrange][Detect] Frame chưa có kích thước (${frameW}x${frameH}), retry sau 300ms...`)
      setTimeout(run, 300)
      return
    }

    // Dùng kích thước ảnh gốc để detect chính xác hơn
    const natW = img.naturalWidth  || frameW
    const natH = img.naturalHeight || frameH
    console.log(`[Arrange][Detect] natural size: ${natW}x${natH}`)

    const canvas = document.createElement('canvas')
    // Detect trên ảnh gốc để tọa độ chính xác, rồi scale về frame
    canvas.width  = natW
    canvas.height = natH
    const ctx = canvas.getContext('2d')

    try {
      ctx.drawImage(img, 0, 0, natW, natH)
      const imageData = ctx.getImageData(0, 0, natW, natH)
      const target    = hexToRgb(hexColor)
      console.log(`[Arrange][Detect] Target RGB: r=${target.r} g=${target.g} b=${target.b}`)

      // Thử detect transparent (alpha=0) trước — dành cho PNG đã xử lý
      let zonesNat = findTransparentZones(imageData, natW, natH, photoCount)
      console.log(`[Arrange][Detect] Transparent zones: ${zonesNat.length}`)

      // Nếu không đủ zones transparent → fallback detect theo màu
      if (zonesNat.length < photoCount) {
        console.log(`[Arrange][Detect] Thử detect theo màu ${hexColor}...`)
        zonesNat = findColorZones(imageData, natW, natH, photoCount, target)
        console.log(`[Arrange][Detect] Color zones: ${zonesNat.length}`)
      }

      console.log(`[Arrange][Detect] Tìm được ${zonesNat.length} zones (natural):`, zonesNat)

      if (zonesNat.length >= photoCount) {
        const scaleX = frameW / natW
        const scaleY = frameH / natH
        console.log(`[Arrange][Detect] Scale: ${scaleX.toFixed(3)} x ${scaleY.toFixed(3)}`)
        const zonesScaled = zonesNat.map(z => ({
          x: Math.round(z.x * scaleX),
          y: Math.round(z.y * scaleY),
          w: Math.round(z.w * scaleX),
          h: Math.round(z.h * scaleY),
        }))
        console.log(`[Arrange][Detect] Zones scaled:`, zonesScaled)
        positionSlotsByZones(ci, zonesScaled)
        console.log(`[Arrange][Detect] ✅ Đặt slots theo zones đã scale`)
      } else {
        console.warn(`[Arrange][Detect] ⚠️ Chỉ tìm được ${zonesNat.length}/${photoCount} zones → dùng fallback`)
        positionSlotsEven(ci, photoCount)
      }
    } catch (e) {
      console.error('[Arrange][Detect] Lỗi đọc canvas (CORS?):', e.message)
      positionSlotsEven(ci, photoCount)
    }
  }

  // Dùng setTimeout 500ms để chắc chắn DOM + ảnh đã sẵn sàng
  const startDetect = () => {
    console.log(`[Arrange][Detect] startDetect ci=${ci} | img.complete=${img.complete} | naturalW=${img.naturalWidth}`)
    if (img.complete && img.naturalWidth > 0) {
      console.log(`[Arrange][Detect] Ảnh đã load → chạy detect sau 500ms`)
      setTimeout(run, 500)
    } else {
      console.log(`[Arrange][Detect] Chờ ảnh load...`)
      img.addEventListener('load', () => {
        console.log(`[Arrange][Detect] Ảnh load xong → chạy detect sau 500ms`)
        setTimeout(run, 500)
      })
      img.addEventListener('error', () => {
        console.error(`[Arrange][Detect] Ảnh load lỗi: ${img.src}`)
        positionSlotsEven(ci, photoCount)
      })
    }
  }
  startDetect()
}

function hexToRgb(hex) {
  const clean = (hex || '#ffffff').replace('#', '')
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  }
}

function colorMatch(data, idx, target, tolerance = 15) {
  const r = data[idx],  g = data[idx+1], b = data[idx+2]
  const match = Math.abs(r - target.r) <= tolerance &&
                Math.abs(g - target.g) <= tolerance &&
                Math.abs(b - target.b) <= tolerance
  return match
}

// Detect vùng transparent (alpha < 30)
function findTransparentZones(imageData, w, h, count) {
  const data    = imageData.data
  const mask    = new Uint8Array(w * h)
  let   matches = 0

  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 30) { mask[i] = 1; matches++ }
  }
  console.log(`[Arrange][Detect] Transparent pixels: ${matches} / ${w*h} (${(matches/w/h*100).toFixed(1)}%)`)

  const visited = new Uint8Array(w * h)
  const regions = []

  function bfs(start) {
    const queue = [start]
    let minX = w, minY = h, maxX = 0, maxY = 0, pixels = 0
    visited[start] = 1
    while (queue.length) {
      const idx = queue.shift()
      const x = idx % w, y = Math.floor(idx / w)
      pixels++
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (x > 0   && !visited[idx-1] && mask[idx-1]) { visited[idx-1]=1; queue.push(idx-1) }
      if (x < w-1 && !visited[idx+1] && mask[idx+1]) { visited[idx+1]=1; queue.push(idx+1) }
      if (y > 0   && !visited[idx-w] && mask[idx-w]) { visited[idx-w]=1; queue.push(idx-w) }
      if (y < h-1 && !visited[idx+w] && mask[idx+w]) { visited[idx+w]=1; queue.push(idx+w) }
    }
    return { minX, minY, maxX, maxY, pixels }
  }

  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 1 && !visited[i]) {
      const r = bfs(i)
      if (r.pixels > w * h * 0.02) regions.push(r)
    }
  }

  regions.sort((a, b) => b.pixels - a.pixels)
  const top = regions.slice(0, count)
  top.sort((a, b) => a.minY - b.minY)

  return top.map(r => ({
    x: r.minX, y: r.minY,
    w: r.maxX - r.minX + 1,
    h: r.maxY - r.minY + 1,
  }))
}

function findColorZones(imageData, w, h, count, targetColor) {
  const data    = imageData.data
  const mask    = new Uint8Array(w * h)
  let   matches = 0

  for (let i = 0; i < w * h; i++) {
    if (colorMatch(data, i * 4, targetColor)) { mask[i] = 1; matches++ }
  }
  console.log(`[Arrange][Detect] Pixels khớp màu: ${matches} / ${w*h} (${(matches/w/h*100).toFixed(1)}%)`)

  const visited = new Uint8Array(w * h)
  const regions = []

  function bfs(start) {
    const queue = [start]
    let minX = w, minY = h, maxX = 0, maxY = 0, pixels = 0
    visited[start] = 1
    while (queue.length) {
      const idx = queue.shift()
      const x = idx % w, y = Math.floor(idx / w)
      pixels++
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (x > 0   && !visited[idx-1] && mask[idx-1]) { visited[idx-1]=1; queue.push(idx-1) }
      if (x < w-1 && !visited[idx+1] && mask[idx+1]) { visited[idx+1]=1; queue.push(idx+1) }
      if (y > 0   && !visited[idx-w] && mask[idx-w]) { visited[idx-w]=1; queue.push(idx-w) }
      if (y < h-1 && !visited[idx+w] && mask[idx+w]) { visited[idx+w]=1; queue.push(idx+w) }
    }
    return { minX, minY, maxX, maxY, pixels }
  }

  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 1 && !visited[i]) {
      const r = bfs(i)
      const minSize = w * h * 0.02 // > 2% diện tích
      if (r.pixels > minSize) {
        regions.push(r)
        console.log(`[Arrange][Detect] Region: x=${r.minX} y=${r.minY} w=${r.maxX-r.minX} h=${r.maxY-r.minY} pixels=${r.pixels}`)
      }
    }
  }

  regions.sort((a, b) => b.pixels - a.pixels)
  const top = regions.slice(0, count)
  top.sort((a, b) => a.minY - b.minY)

  return top.map(r => ({
    x: r.minX, y: r.minY,
    w: r.maxX - r.minX + 1,
    h: r.maxY - r.minY + 1,
  }))
}

function positionSlotsByZones(ci, zones) {
  zones.forEach((zone, si) => {
    const slot = document.getElementById(`slot-${ci}-${si}`)
    if (!slot) return
    slot.style.position = 'absolute'
    slot.style.left   = zone.x + 'px'
    slot.style.top    = zone.y + 'px'
    slot.style.width  = zone.w + 'px'
    slot.style.height = zone.h + 'px'
    slot.style.zIndex = '1'
    console.log(`[Arrange] Slot ${ci}-${si} positioned: x=${zone.x} y=${zone.y} w=${zone.w} h=${zone.h}`)
  })
}

function positionSlotsEven(ci, photoCount) {
  const frame = document.getElementById(`frame-${ci}`)
  const fw = frame?.offsetWidth  || 240
  const fh = frame?.offsetHeight || 640
  console.log(`[Arrange] positionSlotsEven ci=${ci} photoCount=${photoCount} frame=${fw}x${fh}`)
  if (!frame) return
  const w = fw
  const h = fh
  const pad   = 8
  const photoH = Math.round((h - pad * (photoCount + 1)) / photoCount)
  const photoW = w - pad * 2
  for (let si = 0; si < photoCount; si++) {
    const slot = document.getElementById(`slot-${ci}-${si}`)
    if (!slot) continue
    slot.style.position = 'absolute'
    slot.style.left   = pad + 'px'
    slot.style.top    = (pad + si * (photoH + pad)) + 'px'
    slot.style.width  = photoW + 'px'
    slot.style.height = photoH + 'px'
    slot.style.zIndex = '1'
  }
}

export const arrangeStyles = `
  .arrange-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 280px 1fr;
  }
  .arrange-pool-wrap {
    display: flex; flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-2);
    padding: 32px 16px;
    gap: 16px;
  }
  .arrange-pool {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    align-content: start;
  }
  .pool-photo {
    position: relative;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 2px solid var(--border);
    cursor: pointer;
    transition: var(--transition);
    background: var(--surface);
    aspect-ratio: 4/3;
  }
  .pool-photo:hover { border-color: var(--accent); transform: scale(1.03); }
  .pool-photo.used  { opacity: .45; }
  .pool-photo img   { width:100%;height:100%;object-fit:cover;display:block;pointer-events:none }
  .pool-num {
    position: absolute; top: 4px; right: 4px;
    padding: 1px 6px;
    background: rgba(0,0,0,.65);
    color: var(--accent);
    border-radius: 8px;
    font-size: .65rem; font-weight: 700;
  }
  .arrange-preview-wrap {
    display: flex; flex-direction: column;
    padding: 32px 40px;
    gap: 20px;
    overflow: hidden;
  }
  .arrange-preview-header {
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .copy-tabs {
    display: flex; gap: 6px;
    background: var(--bg-3);
    border-radius: var(--radius-md);
    padding: 4px; width: fit-content;
  }
  .copy-tab {
    padding: 6px 18px; border-radius: 10px;
    border: none; background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: .875rem; font-weight: 500;
    cursor: pointer; transition: var(--transition);
  }
  .copy-tab.active { background: var(--surface-2); color: var(--text); }
  .template-previews {
    flex: 1;
    display: flex; gap: 24px;
    align-items: flex-start;
  }
  .template-copy { display: none; flex-direction: column; align-items: center; }
  .template-copy.active { display: flex; }
  .template-frame {
    position: relative;
    width: 240px; height: 640px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 8px 32px rgba(0,0,0,.3);
  }
  .template-overlay {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: fill;
    z-index: 2;
    pointer-events: none;
  }
  .template-placeholder {
    display: flex; align-items: center; justify-content: center;
  }
  .slot-container { position: absolute; inset: 0; z-index: 1; }
  .photo-slot {
    position: absolute;
    overflow: hidden;
    cursor: pointer;
    border-radius: 2px;
    transition: box-shadow .2s, transform .2s;
  }
  .photo-slot.empty {
    background: rgba(255,255,255,.05);
    border: 2px dashed rgba(201,168,76,.35);
  }
  .photo-slot.empty:hover {
    border-color: var(--accent);
    background: rgba(201,168,76,.08);
  }
  .photo-slot.selected {
    border: 2.5px solid var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-glow);
    transform: scale(1.02);
    z-index: 3 !important;
  }
  .slot-hint {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 4px; color: rgba(201,168,76,.45);
    font-size: .7rem;
  }
  .slot-remove-btn {
    position: absolute; top: 3px; right: 3px;
    width: 20px; height: 20px;
    background: rgba(0,0,0,.7); color: white;
    border: none; border-radius: 50%;
    font-size: .65rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 4; transition: var(--transition);
  }
  .slot-remove-btn:hover { background: var(--danger); }
`