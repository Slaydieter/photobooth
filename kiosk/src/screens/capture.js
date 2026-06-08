import { navigate } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

export async function renderCaptureScreen() {
  const el = document.getElementById('screen-capture')
  const totalShots   = state.session.copyCount * (state.session.theme?.photoCount || 4)
  const countdownSec = parseInt(state.settings.countdown_seconds || '10')

  el.innerHTML = `
    <div class="capture-layout">
      <!-- Camera -->
      <div class="capture-cam-wrap">
        <video id="cap-video" autoplay playsinline muted></video>
        <canvas id="cap-sticker-canvas"></canvas>
        <div class="capture-overlay" id="capture-overlay">
          <!-- Đếm ngược -->
          <div class="capture-countdown hidden" id="countdown-display">
            <div class="countdown-ring">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="88" fill="none"
                  stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
                <circle cx="100" cy="100" r="88" fill="none"
                  stroke="var(--accent)" stroke-width="8"
                  stroke-dasharray="553" stroke-dashoffset="0"
                  stroke-linecap="round"
                  id="countdown-circle"/>
              </svg>
              <span class="number" id="countdown-number">10</span>
            </div>
          </div>
          <!-- Flash -->
          <div class="flash-overlay" id="cap-flash"></div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="capture-panel">
        <div class="capture-status">
          <p class="text-sm text-muted" style="letter-spacing:0.12em;text-transform:uppercase">
            Đang chụp
          </p>
          <h2 class="display-md" style="margin-top:8px">
            Bức <span class="text-accent" id="shot-current">1</span>
            <span class="text-muted" style="font-size:1.2rem"> / ${totalShots}</span>
          </h2>
          <div class="divider" style="margin:16px 0"></div>
          <p class="text-muted text-md" id="capture-hint">Chuẩn bị tư thế...</p>
        </div>

        <!-- Shot thumbnails -->
        <div class="shot-thumbs scroll-area" id="shot-thumbs"></div>

        <!-- Progress bar -->
        <div class="capture-progress-wrap">
          <div class="capture-progress-bar">
            <div class="capture-progress-fill" id="progress-fill" style="width:0%"></div>
          </div>
          <p class="text-sm text-muted" style="margin-top:8px; text-align:center">
            <span id="progress-label">0 / ${totalShots} ảnh</span>
          </p>
        </div>
      </div>
    </div>
  `

  // ── Setup camera ─────────────────────────────────────────────────────────
  const video         = document.getElementById('cap-video')
  let   mediaRecorder = null
  let   recordedChunks = []
  const stickerCanvas = document.getElementById('cap-sticker-canvas')
  const stickerCtx    = stickerCanvas.getContext('2d')
  let stream = null

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    })
    video.srcObject = stream
    video.onloadedmetadata = () => {
      stickerCanvas.width  = video.videoWidth
      stickerCanvas.height = video.videoHeight

      // Bắt đầu record video
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9' : 'video/webm'
        mediaRecorder = new MediaRecorder(stream, { mimeType })
        mediaRecorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) recordedChunks.push(e.data)
        }
        mediaRecorder.start(1000) // chunk mỗi 1s
        console.log('[Capture] Recording started:', mimeType)
      } catch (err) {
        console.warn('[Capture] MediaRecorder error:', err.message)
      }
    }
  } catch (err) {
    console.warn('Camera error:', err)
  }

  // ── Sticker overlay từ precapture ─────────────────────────────────────────
  const { selectedStickerIds = [], allStickers = [], stickerImages = {} } =
    window._precaptureData || {}

  let faceLandmarks = null
  if (window.FaceMesh && selectedStickerIds.length) {
    const faceMesh = new window.FaceMesh({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    })
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
    faceMesh.onResults(r => { faceLandmarks = r.multiFaceLandmarks?.[0] || null })

    const CIRCUMFERENCE = 2 * Math.PI * 88
    const ZONES = {
      forehead: [10], nose: [4], cheek_left: [234], cheek_right: [454], chin: [152],
    }

    function drawStickerOverlay() {
      stickerCtx.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height)
      if (!faceLandmarks) return
      const activeStickers = allStickers.filter(s => selectedStickerIds.includes(s._id))
      for (const sticker of activeStickers) {
        const img = stickerImages[sticker._id]
        if (!img?.complete) continue
        const pts = (ZONES[sticker.detectZone] || [4]).map(i => faceLandmarks[i])
        const ax  = pts.reduce((s, p) => s + p.x, 0) / pts.length * stickerCanvas.width
        const ay  = pts.reduce((s, p) => s + p.y, 0) / pts.length * stickerCanvas.height
        const fw  = Math.abs(faceLandmarks[234].x - faceLandmarks[454].x) * stickerCanvas.width
        const sz  = fw * 0.65 * (sticker.scale || 1)
        const extraY = sticker.detectZone === 'forehead' ? -sz * 0.7 : sticker.detectZone === 'chin' ? sz * 0.2 : 0
        stickerCtx.drawImage(img, ax - sz / 2, ay - sz / 2 + extraY, sz, sz)
      }
    }

    async function loopFaceMesh() {
      if (video.readyState === 4) { await faceMesh.send({ image: video }); drawStickerOverlay() }
      requestAnimationFrame(loopFaceMesh)
    }
    loopFaceMesh()
  }

  // ── Chụp ảnh ─────────────────────────────────────────────────────────────
  const capturedPhotos = []
  let  currentShot     = 0
  let  isCapturing     = false

  async function capturePhoto() {
    // Flash
    const flash = document.getElementById('cap-flash')
    flash.classList.add('active')
    setTimeout(() => flash.classList.remove('active'), 600)

    // Composite video + sticker vào canvas ẩn
    const offscreen = document.createElement('canvas')
    offscreen.width  = video.videoWidth  || 1280
    offscreen.height = video.videoHeight || 720
    const ctx = offscreen.getContext('2d')
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -offscreen.width, 0, offscreen.width, offscreen.height)
    ctx.restore()
    if (selectedStickerIds.length) {
      ctx.drawImage(stickerCanvas, 0, 0)
    }

    const imageData  = offscreen.toDataURL('image/jpeg', 0.92)
    const takeRound  = state.session.retakeCount + 1
    const shotIndex  = currentShot

    try {
      await API.savePhoto(state.session.id, { imageData, takeRound, shotIndex })
    } catch (err) {
      console.warn('Save photo error:', err)
    }

    capturedPhotos.push({ dataURL: imageData, takeRound, shotIndex })

    // Thêm thumbnail
    const thumbs = document.getElementById('shot-thumbs')
    const thumb  = document.createElement('div')
    thumb.className = 'shot-thumb animate-scale'
    thumb.innerHTML = `
      <img src="${imageData}" alt="Ảnh ${currentShot + 1}">
      <span class="shot-thumb-num">${currentShot + 1}</span>
    `
    thumbs.appendChild(thumb)
    thumbs.scrollTop = thumbs.scrollHeight

    currentShot++
    const pct = Math.round((currentShot / totalShots) * 100)
    document.getElementById('progress-fill').style.width = `${pct}%`
    document.getElementById('progress-label').textContent = `${currentShot} / ${totalShots} ảnh`
  }

  // ── Countdown loop ────────────────────────────────────────────────────────
  async function runCountdown() {
    if (currentShot >= totalShots) {
      console.log('[Capture] Chụp xong, dừng record và lưu video...')

      // 1. Dừng MediaRecorder trước, chờ data flush
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        await new Promise(resolve => {
          mediaRecorder.onstop = async () => {
            try {
              if (recordedChunks.length > 0) {
                const blob      = new Blob(recordedChunks, { type: 'video/webm' })
                const takeRound = state.session.retakeCount + 1
                console.log(`[Capture] Saving video blob: ${blob.size} bytes, round ${takeRound}`)
                try {
                  // Dùng FormData + fetch trực tiếp thay vì base64 để tránh memory issue
                  const formData = new FormData()
                  formData.append('video', blob, `video-round${takeRound}.webm`)
                  formData.append('takeRound', String(takeRound))
                  const res = await fetch(
                    `http://localhost:3001/api/sessions/${state.session.id}/video-upload`,
                    { method: 'POST', body: formData }
                  )
                  const data = await res.json()
                  if (data.success) {
                    const videos = [...(state.session.videos || []), { takeRound, filePath: data.data.filePath }]
                    setState('session.videos', videos)
                    console.log(`[Capture] ✅ Video round ${takeRound} saved:`, data.data.filePath)
                  } else {
                    console.warn('[Capture] Save video failed:', data.message)
                  }
                } catch (err) {
                  console.warn('[Capture] Save video error:', err)
                }
                resolve()
              } else {
                console.warn('[Capture] No recorded chunks!')
                resolve()
              }
            } catch (err) {
              console.warn('[Capture] onstop error:', err)
              resolve()
            }
          }
          mediaRecorder.stop()
        })
      } else {
        console.warn('[Capture] MediaRecorder không hoạt động:', mediaRecorder?.state)
      }

      // 2. Dừng stream
      if (stream) stream.getTracks().forEach(t => t.stop())

      // 3. Chuyển sang review
      const allPhotos = await API.getPhotos(state.session.id)
      setState('session.photos', allPhotos.data)
      navigate('review')
      return
    }

    isCapturing = true
    document.getElementById('shot-current').textContent = currentShot + 1
    document.getElementById('capture-hint').textContent = 'Chuẩn bị tư thế nhé! 😊'

    const display = document.getElementById('countdown-display')
    const numEl   = document.getElementById('countdown-number')
    const circle  = document.getElementById('countdown-circle')
    const CIRCUM  = 2 * Math.PI * 88

    display.classList.remove('hidden')

    for (let t = countdownSec; t >= 1; t--) {
      if (!document.getElementById('cap-video')) return // màn hình đã đổi
      numEl.textContent  = t
      const offset = CIRCUM * (1 - t / countdownSec)
      circle.style.strokeDashoffset = offset

      if (t <= 3) {
        numEl.style.color = '#e05555'
        numEl.style.transform = 'scale(1.2)'
        setTimeout(() => { if (numEl) numEl.style.transform = 'scale(1)' }, 200)
      } else {
        numEl.style.color = 'var(--accent)'
      }
      await delay(1000)
    }

    display.classList.add('hidden')
    document.getElementById('capture-hint').textContent = '📸 Chụp!'
    await capturePhoto()
    await delay(800)

    // Chụp tiếp
    runCountdown()
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

  // Bắt đầu sau 1.5s khi màn hình load xong
  setTimeout(runCountdown, 1500)
}

export const captureStyles = `
  .capture-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 340px;
  }
  .capture-cam-wrap {
    position: relative;
    background: #000;
    overflow: hidden;
  }
  #cap-video {
    width: 100%; height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  }
  #cap-sticker-canvas {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    transform: scaleX(-1);
  }
  .capture-overlay {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .capture-countdown {
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.5);
    border-radius: 50%;
    backdrop-filter: blur(4px);
  }
  .capture-countdown.hidden { display: none; }

  .capture-panel {
    display: flex; flex-direction: column;
    padding: 40px 28px;
    gap: 24px;
    background: var(--bg-2);
    border-left: 1px solid var(--border);
  }
  .shot-thumbs {
    flex: 1;
    display: flex; flex-direction: column; gap: 10px;
  }
  .shot-thumb {
    position: relative;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .shot-thumb img { width: 100%; display: block; }
  .shot-thumb-num {
    position: absolute; top: 6px; left: 6px;
    width: 24px; height: 24px;
    background: var(--accent);
    color: #1a1200;
    border-radius: 50%;
    font-size: 0.75rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .capture-progress-wrap { margin-top: auto; }
  .capture-progress-bar {
    height: 6px;
    background: var(--surface-2);
    border-radius: 3px;
    overflow: hidden;
  }
  .capture-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-dark), var(--accent));
    border-radius: 3px;
    transition: width 0.4s ease;
  }
`
