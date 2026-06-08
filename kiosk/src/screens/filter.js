import { navigate } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

export async function renderFilterScreen() {
  console.log('[Filter] renderFilterScreen called')
  const el     = document.getElementById('screen-filter')
  const photos = state.session.photos || []

  // Load settings và filters
  let overlayEnabled   = true
  let mediapipeEnabled = true
  let allFilters       = []

  try {
    const [settingsRes, filtersRes] = await Promise.all([
      API.getSettings(),
      API.getFilters(),
    ])
    const s = settingsRes.data || {}
    // Nếu key chưa có trong DB → mặc định bật
    overlayEnabled   = s.filter_overlay_enabled   !== 'false'
    mediapipeEnabled = s.filter_mediapipe_enabled !== 'false'
    allFilters       = filtersRes.data || []
    console.log('[Filter] overlay:', overlayEnabled, '| mediapipe:', mediapipeEnabled)
    console.log('[Filter] filters loaded:', allFilters.length)
  } catch (err) {
    console.warn('[Filter] Load error:', err)
  }

  const toneFilters = allFilters.filter(f => f.group === 'tone')
  const faceFilters = allFilters.filter(f => f.group === 'face')
  const bothModes   = overlayEnabled && mediapipeEnabled

  // State
  let currentPhotoIdx = 0
  let currentMode     = mediapipeEnabled ? 'mediapipe' : 'overlay'
  let faceMesh        = null
  let isFaceDetecting = false

  // selectedFilters[photoIdx] = { tone: filterId|null, face: filterId|null }
  const selectedFilters = photos.map(() => ({ tone: null, face: null }))
  // filteredPhotos[photoIdx] = { filePath, dataURL } — ảnh sau filter
  const filteredResults = photos.map(p => ({ filePath: p.filePath, dataURL: null, _id: p._id }))

  el.innerHTML = `
    <div class="filter-layout">
      <!-- Left: danh sách ảnh -->
      <div class="filter-thumbs-wrap">
        <p class="text-sm text-muted" style="letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px">
          Ảnh đã chụp
        </p>
        <div class="filter-thumbs scroll-area" id="filter-thumbs">
          ${photos.map((p, i) => `
            <div class="filter-thumb ${i===0?'active':''}" id="thumb-${i}" data-idx="${i}">
              <img src="http://localhost:3001/${p.filePath}" alt="Ảnh ${i+1}"
                   onerror="this.style.opacity='.2'" id="thumb-img-${i}">
              <span class="thumb-num">${i+1}</span>
              <div class="thumb-check hidden" id="thumb-check-${i}">✓</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Center: preview ảnh lớn -->
      <div class="filter-preview-wrap">
        <div class="filter-preview-frame" id="preview-frame">
          <canvas id="filter-canvas"></canvas>
          <!-- loading removed - dùng button state thay thế -->
        </div>
        <div class="filter-preview-actions">
          <span id="filter-status" style="font-size:.8rem;color:var(--text-muted);flex:1"></span>
          <button class="btn btn-ghost btn-sm" id="reset-btn" onclick="resetFilter()">
            Xóa filter
          </button>
          <button class="btn btn-primary" id="apply-btn" onclick="applyCurrentFilter()">
            Áp dụng ✓
          </button>
        </div>
      </div>

      <!-- Right: filter panel -->
      <div class="filter-panel-wrap">
        <div class="filter-panel-header">

          <!-- Mode selector — chỉ hiện khi cả 2 bật -->
          ${bothModes ? `
            <div class="filter-mode-selector" id="mode-selector">
              <button class="mode-btn ${currentMode==='mediapipe'?'active':''}"
                      id="btn-mediapipe" onclick="switchMode('mediapipe')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                </svg>
                Face Detect
              </button>
              <button class="mode-btn ${currentMode==='overlay'?'active':''}"
                      id="btn-overlay" onclick="switchMode('overlay')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 3v18M3 12h18"/>
                </svg>
                Overlay
              </button>
            </div>
          ` : `
            <div class="filter-mode-label">
              ${mediapipeEnabled ? '🎯 Face Detect mode' : '🎨 Overlay mode'}
            </div>
          `}

          <div class="filter-progress-text" id="filter-progress">
            <span id="applied-count">0</span>/${photos.length} ảnh đã chọn filter
          </div>
        </div>

        <!-- Tone filters -->
        ${toneFilters.length ? `
          <div class="filter-group">
            <p class="filter-group-label">🎨 Tone màu</p>
            <div class="filter-grid" id="tone-grid">
              ${toneFilters.map(f => `
                <div class="filter-chip" id="chip-tone-${f._id}" data-id="${f._id}" data-group="tone"
                     onclick="selectFilterById('tone','${f._id}')">
                  <div class="filter-chip-preview" style="filter:${f.cssFilter}"></div>
                  <span>${f.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Face filters -->
        ${faceFilters.length ? `
          <div class="filter-group">
            <p class="filter-group-label">💄 Khuôn mặt</p>
            <div class="filter-grid" id="face-grid">
              ${faceFilters.map(f => `
                <div class="filter-chip" id="chip-face-${f._id}" data-id="${f._id}" data-group="face"
                     onclick="selectFilterById('face','${f._id}')">
                  <div class="filter-chip-preview" style="filter:${f.cssFilter}"></div>
                  <span>${f.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="margin-top:auto;padding-top:16px">
          <button class="btn btn-primary btn-lg" style="width:100%" onclick="doneFiltering()">
            Xong, chọn ảnh ghép →
          </button>
        </div>
      </div>
    </div>
  `

  // ── Processing state helper ──────────────────────────────────────────────
  function setProcessing(on, msg = '') {
    const applyBtn = document.getElementById('apply-btn')
    const resetBtn = document.getElementById('reset-btn')
    const doneBtn  = document.querySelector('.filter-panel-wrap .btn-primary.btn-lg')
    const statusEl = document.getElementById('filter-status')
    if (applyBtn) applyBtn.disabled = on
    if (resetBtn) resetBtn.disabled = on
    if (doneBtn)  doneBtn.disabled  = on
    if (statusEl) statusEl.textContent = on ? (msg || 'Đang xử lý...') : ''
  }

  // ── Canvas setup ─────────────────────────────────────────────────────────
  const canvas = document.getElementById('filter-canvas')
  const ctx    = canvas.getContext('2d')
  let   currentImg = new Image()
  let   landmarks  = null

  async function loadPhotoToCanvas(idx) {
    console.log(`[Filter] Loading photo ${idx}`)
    const photo = photos[idx]
    currentImg  = new Image()
    currentImg.crossOrigin = 'anonymous'
    currentImg.src = `http://localhost:3001/${photo.filePath}`

    await new Promise((res, rej) => {
      currentImg.onload = res
      currentImg.onerror = rej
    })

    canvas.width  = currentImg.naturalWidth
    canvas.height = currentImg.naturalHeight
    const frame   = document.getElementById('preview-frame')
    const maxH    = frame.offsetHeight - 60
    const maxW    = frame.offsetWidth  - 20
    const ratio   = Math.min(maxW / canvas.width, maxH / canvas.height)
    canvas.style.width  = Math.round(canvas.width  * ratio) + 'px'
    canvas.style.height = Math.round(canvas.height * ratio) + 'px'

    drawBase()
    restoreFilters(idx)

    // Nếu mediapipe đang bật → detect face ở background (không show loading)
    if (currentMode === 'mediapipe' && mediapipeEnabled) {
      // Chạy background, không await → không block UI
      detectFaceBackground()
    }
  }

  function drawBase() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(currentImg, 0, 0)
  }

  function restoreFilters(idx) {
    const sel = selectedFilters[idx]
    if (sel.tone) {
      const f = allFilters.find(x => x._id === sel.tone)
      if (f) applyToneFilter(f.cssFilter, f.overlayColor)
    }
    if (sel.face) {
      const f = allFilters.find(x => x._id === sel.face)
      if (f) applyFaceFilter(f, currentMode)
    }
  }

  // ── Tone filter (CSS → canvas via offscreen) ──────────────────────────────
  function applyToneFilter(cssFilter, overlayColor) {
    console.log(`[Filter] Apply tone: css="${cssFilter}" overlay="${overlayColor}"`)
    // Dùng offscreen canvas với filter CSS
    const off = document.createElement('canvas')
    off.width  = canvas.width
    off.height = canvas.height
    const octx = off.getContext('2d')
    octx.filter = cssFilter || 'none'
    octx.drawImage(currentImg, 0, 0)
    octx.filter = 'none'

    // Overlay màu
    if (overlayColor && overlayColor !== 'rgba(0,0,0,0)') {
      octx.fillStyle = overlayColor
      octx.fillRect(0, 0, off.width, off.height)
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(off, 0, 0)
  }

  // ── Face filter ───────────────────────────────────────────────────────────
  async function applyFaceFilter(filterData, mode) {
    console.log(`[Filter] Apply face: ${filterData.name} mode=${mode}`)
    if (mode === 'overlay') {
      ctx.fillStyle = filterData.overlayColor || 'rgba(255,150,150,0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return
    }

    // MediaPipe mode — nếu chưa có landmarks thì detect
    if (!landmarks) {
      console.log('[Filter] No landmarks, detecting...')
      // Show status text nhỏ thay vì full spinner
      const statusEl = document.getElementById('filter-status')
      if (statusEl) statusEl.textContent = 'Đang nhận diện khuôn mặt...'
      await detectFace()
      if (statusEl) statusEl.textContent = ''
    } else {
      console.log('[Filter] Using cached landmarks:', landmarks.length, 'pts')
    }

    if (!landmarks || !landmarks.length) {
      console.warn('[Filter] No face detected, fallback overlay')
      ctx.fillStyle = filterData.overlayColor || 'rgba(255,150,150,0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return
    }

    const lm   = landmarks
    const w    = canvas.width
    const h    = canvas.height
    const mp   = filterData.mediapipe || {}
    const color = mp.color || filterData.overlayColor || 'rgba(255,100,100,0.3)'

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    if (mp.type === 'cheeks') {
      // Vẽ blush 2 bên má
      drawFaceZone(ctx, lm, w, h, 'cheek_left',  color, mp.intensity || 0.5)
      drawFaceZone(ctx, lm, w, h, 'cheek_right', color, mp.intensity || 0.5)
    } else if (mp.type === 'lips') {
      drawFaceZone(ctx, lm, w, h, 'lips', color, mp.intensity || 0.6)
    } else if (mp.type === 'skin') {
      drawFaceZone(ctx, lm, w, h, 'face_oval', color, mp.intensity || 0.3)
    } else {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, w, h)
    }

    ctx.restore()
  }

  // ── Vẽ vùng mặt theo landmarks ───────────────────────────────────────────
  function drawFaceZone(ctx, lm, w, h, zone, color, intensity) {
    // MediaPipe FaceMesh landmark indices
    const ZONES = {
      cheek_left:  [234, 227, 116, 123, 147, 213, 192, 214, 212, 216, 206, 203],
      cheek_right: [454, 447, 345, 352, 376, 433, 416, 434, 432, 436, 426, 423],
      lips: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
      face_oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    }

    const indices = ZONES[zone]
    if (!indices) return

    ctx.beginPath()
    indices.forEach((idx, i) => {
      const pt = lm[idx]
      if (!pt) return
      const x = pt.x * w
      const y = pt.y * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()

    // Gradient radial cho tự nhiên hơn
    const pts    = indices.map(idx => lm[idx]).filter(Boolean)
    const cx     = pts.reduce((s, p) => s + p.x, 0) / pts.length * w
    const cy     = pts.reduce((s, p) => s + p.y, 0) / pts.length * h
    const radius = Math.max(...pts.map(p => Math.hypot(p.x * w - cx, p.y * h - cy)))

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.2)
    const baseColor = color.replace(/[\d.]+\)$/, `${intensity})`)
    grad.addColorStop(0,   baseColor)
    grad.addColorStop(0.6, baseColor)
    grad.addColorStop(1,   color.replace(/[\d.]+\)$/, '0)'))

    ctx.fillStyle = grad
    ctx.fill()
    console.log(`[Filter] Drew zone ${zone} at (${cx.toFixed(0)},${cy.toFixed(0)}) r=${radius.toFixed(0)}`)
  }

  // ── detectFaceBackground — detect không show loading spinner ───────────────
  function detectFaceBackground() {
    if (!window.FaceMesh || isFaceDetecting) return
    console.log('[Filter] Background face detect...')
    isFaceDetecting = true

    if (!faceMesh) {
      faceMesh = new window.FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      })
      faceMesh.setOptions({
        maxNumFaces: 1, refineLandmarks: true,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      })
    }

    let resolved = false
    faceMesh.onResults(results => {
      if (resolved) return
      resolved = true
      isFaceDetecting = false
      landmarks = results.multiFaceLandmarks?.[0] || null
      console.log('[Filter] BG landmarks:', landmarks ? `${landmarks.length} pts` : 'none')
    })

    faceMesh.send({ image: currentImg }).catch(err => {
      if (!resolved) { resolved = true; isFaceDetecting = false }
      console.warn('[Filter] BG send error:', err)
    })

    setTimeout(() => {
      if (!resolved) { resolved = true; isFaceDetecting = false }
    }, 4000)
  }

  // ── detectFace — detect và đợi kết quả (không show/hide loading) ────────────
  async function detectFace() {
    if (!window.FaceMesh) {
      console.warn('[Filter] FaceMesh not loaded')
      return
    }

    // Nếu đang detect background thì đợi xong
    if (isFaceDetecting) {
      console.log('[Filter] Waiting for bg detect to finish...')
      await new Promise(r => {
        const check = setInterval(() => {
          if (!isFaceDetecting) { clearInterval(check); r() }
        }, 100)
        setTimeout(() => { clearInterval(check); r() }, 5000)
      })
      console.log('[Filter] BG detect done, landmarks:', landmarks ? 'yes' : 'no')
      return // dùng landmarks từ bg detect luôn
    }

    isFaceDetecting = true
    console.log('[Filter] detectFace (foreground)...')

    await new Promise((resolve) => {
      let resolved = false
      const done = (label) => {
        if (resolved) return
        resolved = true
        isFaceDetecting = false
        resolve()
        console.log('[Filter] detectFace done via:', label)
      }

      if (!faceMesh) {
        faceMesh = new window.FaceMesh({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        })
        faceMesh.setOptions({
          maxNumFaces: 1, refineLandmarks: true,
          minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
        })
      }

      faceMesh.onResults(results => {
        landmarks = results.multiFaceLandmarks?.[0] || null
        console.log('[Filter] Landmarks:', landmarks ? `${landmarks.length} pts` : 'none')
        done('onResults')
      })

      faceMesh.send({ image: currentImg })
        .then(() => { /* onResults sẽ gọi done */ })
        .catch(err => { console.warn('[Filter] send error:', err); done('catch') })

      setTimeout(() => done('timeout'), 4000)
    })
  }

  // ── UI handlers ───────────────────────────────────────────────────────────
  // selectFilterById: lookup từ allFilters array thay vì truyền data qua onclick
  window.selectFilterById = async (group, id) => {
    const filterData = allFilters.find(f => f._id === id)
    if (!filterData) { console.warn('[Filter] Filter not found:', id); return }
    await window.selectFilter(group, id, filterData.cssFilter, filterData.overlayColor, filterData.mediapipe)
  }

  window.selectFilter = async (group, id, cssFilter, overlayColor, mediapipeCfg) => {
    console.log(`[Filter] selectFilter group=${group} id=${id} mode=${currentMode}`)
    const idx = currentPhotoIdx
    const prev = selectedFilters[idx][group]

    // Toggle — click lại cùng filter thì bỏ
    if (prev === id) {
      selectedFilters[idx][group] = null
      document.getElementById(`chip-${group}-${id}`)?.classList.remove('active')
    } else {
      if (prev) document.getElementById(`chip-${group}-${prev}`)?.classList.remove('active')
      selectedFilters[idx][group] = id
      document.getElementById(`chip-${group}-${id}`)?.classList.add('active')
    }

    // Redraw
    drawBase()
    const sel = selectedFilters[idx]
    if (sel.tone) {
      const f = allFilters.find(x => x._id === sel.tone)
      if (f) applyToneFilter(f.cssFilter, f.overlayColor)
    }
    if (sel.face) {
      const f = allFilters.find(x => x._id === sel.face)
      if (f) await applyFaceFilter(f, currentMode)
    }
  }

  window.switchMode = async (mode) => {
    console.log(`[Filter] switchMode: ${mode}`)
    currentMode = mode
    document.getElementById('btn-mediapipe')?.classList.toggle('active', mode === 'mediapipe')
    document.getElementById('btn-overlay')?.classList.toggle('active',   mode === 'overlay')

    // Reset landmarks để detect lại với ảnh hiện tại nếu cần
    landmarks = null
    console.log('[Filter] Mode switched, landmarks reset')

    // Redraw với mode mới
    drawBase()
    await restoreFiltersAsync(currentPhotoIdx)
  }

  async function restoreFiltersAsync(idx) {
    const sel = selectedFilters[idx]
    if (sel.tone) {
      const f = allFilters.find(x => x._id === sel.tone)
      if (f) applyToneFilter(f.cssFilter, f.overlayColor)
    }
    if (sel.face) {
      const f = allFilters.find(x => x._id === sel.face)
      if (f) await applyFaceFilter(f, currentMode)
    }
  }

  window.resetFilter = () => {
    const idx = currentPhotoIdx
    console.log(`[Filter] resetFilter photo ${idx}`)
    selectedFilters[idx] = { tone: null, face: null }
    document.querySelectorAll('.filter-chip.active').forEach(c => c.classList.remove('active'))
    filteredResults[idx].dataURL = null
    document.getElementById(`thumb-check-${idx}`)?.classList.add('hidden')
    drawBase()
    updateProgress()
  }

  window.applyCurrentFilter = async () => {
    const idx = currentPhotoIdx
    console.log(`[Filter] Apply filter to photo ${idx}`)
    setProcessing(true, 'Đang lưu...')

    try {
      const dataURL = canvas.toDataURL('image/jpeg', 0.92)
      filteredResults[idx].dataURL = dataURL
      filteredResults[idx]._id     = photos[idx]._id

      const photoId = photos[idx]._id || idx
      const res = await API.saveFilterPhoto(state.session.id, { imageData: dataURL, photoId })
      filteredResults[idx].filePath = res.data.filePath
      console.log(`[Filter] ✅ Photo ${idx} saved:`, res.data.filePath)

      const thumbImg = document.getElementById(`thumb-img-${idx}`)
      if (thumbImg) thumbImg.src = dataURL
      document.getElementById(`thumb-check-${idx}`)?.classList.remove('hidden')
      updateProgress()
    } catch (err) {
      console.error('[Filter] Apply error:', err)
    } finally {
      setProcessing(false)
      // Auto chuyển sang ảnh tiếp theo SAU KHI đã enable lại button
      if (idx < photos.length - 1) {
        setTimeout(() => switchPhoto(idx + 1), 400)
      }
    }
  }

  async function switchPhoto(idx) {
    console.log(`[Filter] switchPhoto: ${idx}`)
    currentPhotoIdx = idx
    landmarks       = null

    // Update thumb highlight
    document.querySelectorAll('.filter-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === idx)
    })

    // Reset chip selections visually, restore for this photo
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'))
    const sel = selectedFilters[idx]
    if (sel.tone) document.getElementById(`chip-tone-${sel.tone}`)?.classList.add('active')
    if (sel.face) document.getElementById(`chip-face-${sel.face}`)?.classList.add('active')

    await loadPhotoToCanvas(idx)
  }

  function updateProgress() {
    const applied = filteredResults.filter(r => r.dataURL).length
    const el = document.getElementById('applied-count')
    if (el) el.textContent = applied
  }

  window.doneFiltering = async () => {
    console.log('[Filter] doneFiltering start')
    setProcessing(true, 'Đang xử lý...')

    try {
      // Tự động apply filter cho ảnh nào có filter được chọn nhưng chưa bấm "Áp dụng"
      for (let i = 0; i < photos.length; i++) {
        const sel = selectedFilters[i]
        const hasFilter = sel.tone || sel.face
        if (hasFilter && !filteredResults[i].dataURL) {
          console.log(`[Filter] Auto-apply filter for photo ${i}`)
          // Switch sang ảnh đó để render đúng
          if (i !== currentPhotoIdx) {
            currentPhotoIdx = i
            landmarks = null
            await loadPhotoToCanvas(i)
          }
          // Apply filter
          drawBase()
          if (sel.tone) {
            const f = allFilters.find(x => x._id === sel.tone)
            if (f) applyToneFilter(f.cssFilter, f.overlayColor)
          }
          if (sel.face) {
            const f = allFilters.find(x => x._id === sel.face)
            if (f) await applyFaceFilter(f, currentMode)
          }
          // Lưu
          const dataURL = canvas.toDataURL('image/jpeg', 0.92)
          filteredResults[i].dataURL = dataURL
          const photoId = photos[i]._id || i
          const res = await API.saveFilterPhoto(state.session.id, { imageData: dataURL, photoId })
          filteredResults[i].filePath = res.data.filePath
          console.log(`[Filter] Auto-saved photo ${i}:`, res.data.filePath)
        }
      }
    } catch (err) {
      console.error('[Filter] Auto-apply error:', err)
    } finally {
      setProcessing(false)
    }

    // Build finalPhotos — dùng filtered nếu có, giữ gốc nếu không có filter
    const finalPhotos = photos.map((p, i) => {
      if (filteredResults[i].dataURL && filteredResults[i].filePath) {
        console.log(`[Filter] Photo ${i} → filtered: ${filteredResults[i].filePath}`)
        return { ...p, filePath: filteredResults[i].filePath }
      }
      console.log(`[Filter] Photo ${i} → original: ${p.filePath}`)
      return p
    })

    console.log('[Filter] finalPhotos:', finalPhotos.map(p => p.filePath))
    setState('session.filteredPhotos', finalPhotos)
    setState('session.photos', finalPhotos)

    const { renderArrangeScreen } = window._screens
    renderArrangeScreen()
    navigate('arrange')
  }

  // Gắn click thumb
  setTimeout(() => {
    document.querySelectorAll('.filter-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => switchPhoto(parseInt(thumb.dataset.idx)))
    })
    console.log('[Filter] Thumb click handlers attached')
  }, 100)

  // Load ảnh đầu tiên
  await loadPhotoToCanvas(0)
}

export const filterStyles = `
  .filter-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 140px 1fr 260px;
  }

  /* Thumbs */
  .filter-thumbs-wrap {
    padding: 28px 12px;
    border-right: 1px solid var(--border);
    background: var(--bg-2);
    display: flex; flex-direction: column;
  }
  .filter-thumbs {
    flex: 1;
    display: flex; flex-direction: column;
    gap: 8px;
  }
  .filter-thumb {
    position: relative;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 2px solid var(--border);
    cursor: pointer;
    transition: var(--transition);
    aspect-ratio: 4/3;
  }
  .filter-thumb:hover  { border-color: var(--border-hover); }
  .filter-thumb.active { border-color: var(--accent); }
  .filter-thumb img    { width:100%;height:100%;object-fit:cover;display:block }
  .thumb-num {
    position: absolute; top:3px; right:3px;
    background: rgba(0,0,0,.65); color: var(--accent);
    border-radius: 6px; padding: 1px 5px;
    font-size: .65rem; font-weight: 700;
  }
  .thumb-check {
    position: absolute; inset: 0;
    background: rgba(76,175,125,.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem; color: white; font-weight: 700;
  }

  /* Preview */
  .filter-preview-wrap {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 24px;
    gap: 16px;
  }
  .filter-preview-frame {
    flex: 1;
    width: 100%;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-3);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  #filter-canvas {
    max-width: 100%;
    max-height: 100%;
    border-radius: var(--radius-sm);
    display: block;
  }
  /* filter-loading removed */
  .filter-preview-actions {
    display: flex; gap: 12px; align-items: center;
    flex-shrink: 0;
  }

  /* Filter panel */
  .filter-panel-wrap {
    display: flex; flex-direction: column;
    padding: 24px 20px;
    gap: 20px;
    border-left: 1px solid var(--border);
    background: var(--bg-2);
  }
  .filter-panel-header { display: flex; flex-direction: column; gap: 10px; }
  .filter-mode-selector {
    display: flex; gap: 6px;
    background: var(--bg-3);
    border-radius: var(--radius-md);
    padding: 4px;
  }
  .mode-btn {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 8px;
    border-radius: 8px; border: none;
    background: transparent; color: var(--text-muted);
    font-family: var(--font-body); font-size: .8rem;
    font-weight: 500; cursor: pointer; transition: var(--transition);
  }
  .mode-btn.active { background: var(--surface-2); color: var(--accent); }
  .filter-mode-label {
    font-size: .8rem; color: var(--text-muted);
    padding: 8px 12px; background: var(--surface);
    border-radius: var(--radius-sm); text-align: center;
  }
  .filter-progress-text {
    font-size: .8rem; color: var(--text-muted); text-align: center;
  }

  /* Filter groups */
  .filter-group { display: flex; flex-direction: column; gap: 8px; }
  .filter-group-label {
    font-size: .8rem; font-weight: 600; color: var(--text-muted);
    letter-spacing: .08em; text-transform: uppercase;
  }
  .filter-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .filter-chip {
    display: flex; flex-direction: column; align-items: center;
    gap: 4px; padding: 8px 4px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    background: var(--surface);
    cursor: pointer; transition: var(--transition);
    font-size: .68rem; color: var(--text-muted);
    text-align: center;
  }
  .filter-chip:hover  { border-color: var(--border-hover); color: var(--text); }
  .filter-chip.active { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }
  .filter-chip-preview {
    width: 36px; height: 36px;
    border-radius: 6px;
    background: linear-gradient(135deg, #f5c6a0, #e8a0c0, #a0c8e8);
    flex-shrink: 0;
  }
`