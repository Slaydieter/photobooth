import { navigate, goBack } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

export async function renderPrecaptureScreen() {
  const el = document.getElementById('screen-precapture')

  el.innerHTML = `
    <button class="back-btn" onclick="goBack()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Quay lại
    </button>

    <div class="precap-layout">
      <!-- Camera preview -->
      <div class="precap-camera-wrap">
        <video id="precap-video" autoplay playsinline muted></video>
        <canvas id="precap-canvas"></canvas>
        <canvas id="sticker-canvas"></canvas>
        <div class="precap-frame-overlay">
          <div class="frame-corner tl"></div>
          <div class="frame-corner tr"></div>
          <div class="frame-corner bl"></div>
          <div class="frame-corner br"></div>
        </div>
        <div class="precap-hint">Nhìn thẳng vào camera 📷</div>
      </div>

      <!-- Sticker panel -->
      <div class="precap-panel">
        <div class="precap-panel-header">
          <h3 class="display-md">Chọn <span class="text-accent">sticker</span></h3>
          <p class="text-muted text-sm" style="margin-top:8px">Sticker sẽ hiện realtime lên camera</p>
        </div>

        <div class="sticker-grid scroll-area" id="sticker-grid">
          <div class="loading-spinner"></div>
        </div>

        <div class="precap-selected" id="precap-selected" style="display:none">
          <p class="text-sm text-muted">Đã chọn:</p>
          <div class="selected-tags" id="selected-tags"></div>
        </div>

        <div class="precap-actions">
          <button class="btn btn-ghost btn-sm" onclick="clearStickers()">Bỏ chọn tất cả</button>
          <button class="btn btn-primary btn-lg" id="start-capture-btn" onclick="startCapture()">
            Bắt đầu chụp
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10,8 16,12 10,16" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `

  // ── Setup camera ─────────────────────────────────────────────────────────
  const video  = document.getElementById('precap-video')
  const stickerCanvas = document.getElementById('sticker-canvas')
  const stickerCtx    = stickerCanvas.getContext('2d')
  let stream = null
  let selectedStickerIds = []
  let allStickers = []
  let faceLandmarks = null

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    })
    video.srcObject = stream
    video.onloadedmetadata = () => {
      stickerCanvas.width  = video.videoWidth
      stickerCanvas.height = video.videoHeight
    }
  } catch (err) {
    console.warn('Camera error:', err)
  }

  // ── Load MediaPipe FaceMesh ───────────────────────────────────────────────
  let faceMesh = null
  if (window.FaceMesh) {
    faceMesh = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    })
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    faceMesh.onResults((results) => {
      faceLandmarks = results.multiFaceLandmarks?.[0] || null
      drawStickers()
    })

    // Gửi frame vào FaceMesh liên tục
    async function processFrame() {
      if (video.readyState === 4) await faceMesh.send({ image: video })
      requestAnimationFrame(processFrame)
    }
    processFrame()
  }

  // ── Vẽ sticker theo landmarks ─────────────────────────────────────────────
  const stickerImages = {}

  function getLandmarkPos(zone) {
    if (!faceLandmarks) return null
    const lm = faceLandmarks
    const w  = stickerCanvas.width
    const h  = stickerCanvas.height

    // Landmark indices (MediaPipe FaceMesh)
    const ZONES = {
      forehead:    [10],              // đỉnh trán
      nose:        [4],               // mũi
      cheek_left:  [234],             // má trái
      cheek_right: [454],             // má phải
      chin:        [152],             // cằm
    }

    const indices = ZONES[zone] || ZONES.nose
    const pts = indices.map(i => lm[i])
    const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const avgY = pts.reduce((s, p) => s + p.y, 0) / pts.length

    // Ước lượng kích thước khuôn mặt để scale sticker
    const faceWidth = Math.abs(lm[234].x - lm[454].x) * w

    return { x: avgX * w, y: avgY * h, faceWidth }
  }

  function drawStickers() {
    stickerCtx.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height)
    if (!faceLandmarks) return

    const activeStickers = allStickers.filter(s => selectedStickerIds.includes(s._id))
    for (const sticker of activeStickers) {
      const img = stickerImages[sticker._id]
      if (!img || !img.complete) continue

      const pos = getLandmarkPos(sticker.detectZone)
      if (!pos) continue

      const size   = pos.faceWidth * 0.65 * (sticker.scale || 1)
      const drawX  = pos.x - size / 2 + (sticker.offsetX || 0)
      const drawY  = pos.y - size / 2 + (sticker.offsetY || 0)

      // Offset thêm cho forehead (lên trên)
      const zoneOffsets = { forehead: -size * 0.7, chin: size * 0.2 }
      const extraY = zoneOffsets[sticker.detectZone] || 0

      stickerCtx.drawImage(img, drawX, drawY + extraY, size, size)
    }
  }

  // ── Load stickers ─────────────────────────────────────────────────────────
  try {
    const { data: stickers } = await API.getStickers()
    allStickers = stickers

    // Preload images
    stickers.forEach(s => {
      const img = new Image()
      img.src = `http://localhost:3001/${s.imagePath}`
      stickerImages[s._id] = img
    })

    const grid = document.getElementById('sticker-grid')
    if (!stickers.length) {
      grid.innerHTML = `<p class="text-sm text-muted text-center" style="padding:20px">Chưa có sticker nào</p>`
    } else {
      grid.innerHTML = stickers.map(s => `
        <div class="sticker-item" data-id="${s._id}" data-name="${s.name}" title="${s.name}">
          <div class="sticker-img-wrap">
            <img src="http://localhost:3001/${s.imagePath}"
                 alt="${s.name}"
                 onerror="this.style.opacity='0.2'">
          </div>
          <span class="sticker-label">${s.name}</span>
        </div>
      `).join('')

      grid.querySelectorAll('.sticker-item').forEach(item => {
        item.addEventListener('click', () => toggleSticker(item))
      })
    }
  } catch (err) {
    document.getElementById('sticker-grid').innerHTML =
      `<p class="text-sm text-muted">Lỗi: ${err.message}</p>`
  }

  function toggleSticker(item) {
    const id   = item.dataset.id
    const name = item.dataset.name
    const idx  = selectedStickerIds.indexOf(id)
    if (idx === -1) {
      selectedStickerIds.push(id)
      item.classList.add('selected')
    } else {
      selectedStickerIds.splice(idx, 1)
      item.classList.remove('selected')
    }
    updateSelectedDisplay()
  }

  function updateSelectedDisplay() {
    const box  = document.getElementById('precap-selected')
    const tags = document.getElementById('selected-tags')
    if (!selectedStickerIds.length) {
      box.style.display = 'none'
      return
    }
    box.style.display = 'block'
    tags.innerHTML = selectedStickerIds.map(id => {
      const s = allStickers.find(x => x._id === id)
      return `<span class="selected-tag">${s?.name || id}</span>`
    }).join('')
  }

  window.clearStickers = () => {
    selectedStickerIds = []
    document.querySelectorAll('.sticker-item.selected').forEach(el => el.classList.remove('selected'))
    updateSelectedDisplay()
    stickerCtx.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height)
  }

  window.startCapture = async () => {
    // Lưu sticker đã chọn vào session
    setState('session.selectedStickers', selectedStickerIds)
    if (selectedStickerIds.length) {
      await API.saveStickers(state.session.id, selectedStickerIds)
    }

    // Dừng camera ở đây, màn hình capture sẽ mở lại
    if (stream) stream.getTracks().forEach(t => t.stop())

    // Truyền danh sách sticker sang màn hình capture
    window._precaptureData = { selectedStickerIds, allStickers, stickerImages }
    navigate('capture')
  }

  // Cleanup khi rời màn hình
  window._cleanupPrecapture = () => {
    if (stream) stream.getTracks().forEach(t => t.stop())
  }
}

export const precaptureStyles = `
  .precap-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 380px;
  }

  /* Camera */
  .precap-camera-wrap {
    position: relative;
    background: #000;
    overflow: hidden;
  }
  #precap-video {
    width: 100%; height: 100%;
    object-fit: cover;
    transform: scaleX(-1); /* mirror */
  }
  #precap-canvas { display: none; }
  #sticker-canvas {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    transform: scaleX(-1);
  }
  .precap-frame-overlay {
    position: absolute; inset: 20px;
    pointer-events: none;
  }
  .frame-corner {
    position: absolute;
    width: 40px; height: 40px;
    border-color: var(--accent);
    border-style: solid;
    opacity: 0.7;
  }
  .frame-corner.tl { top: 0; left: 0; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
  .frame-corner.tr { top: 0; right: 0; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
  .frame-corner.bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
  .frame-corner.br { bottom: 0; right: 0; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
  .precap-hint {
    position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.6);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 8px 20px;
    font-size: 0.875rem; color: var(--text-muted);
    backdrop-filter: blur(8px);
  }

  /* Panel */
  .precap-panel {
    display: flex; flex-direction: column;
    padding: 40px 28px;
    gap: 24px;
    border-left: 1px solid var(--border);
    background: var(--bg-2);
  }
  .precap-panel-header {}

  /* Sticker grid */
  .sticker-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    align-content: start;
  }
  .sticker-item {
    display: flex; flex-direction: column;
    align-items: center; gap: 6px;
    padding: 10px 6px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--border);
    background: var(--surface);
    cursor: pointer;
    transition: var(--transition);
  }
  .sticker-item:hover { border-color: var(--border-hover); }
  .sticker-item.selected { border-color: var(--accent); background: var(--accent-glow); }
  .sticker-img-wrap {
    width: 56px; height: 56px;
    display: flex; align-items: center; justify-content: center;
  }
  .sticker-img-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .sticker-label {
    font-size: 0.65rem; color: var(--text-muted);
    text-align: center; line-height: 1.2;
  }

  /* Selected */
  .precap-selected {
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .selected-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .selected-tag {
    padding: 3px 10px;
    background: var(--accent-glow);
    border: 1px solid var(--accent-dark);
    border-radius: 12px;
    font-size: 0.75rem; color: var(--accent-light);
  }

  .precap-actions {
    display: flex; flex-direction: column; gap: 10px;
    margin-top: auto;
  }
`
