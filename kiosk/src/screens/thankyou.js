import { navigate } from '../utils/router.js'
import { state, resetSession } from '../utils/state.js'
import { API } from '../utils/api.js'

export function renderThankyouScreen() {
  const el       = document.getElementById('screen-thankyou')
  const duration = parseInt(state.settings.thankyou_duration || '10')
  let   timer    = duration
  let   interval = null
  let   pollInterval = null
  let   countdownStarted = false

  el.innerHTML = `
    <div class="ty-bg">
      <div class="ty-particles" id="ty-particles"></div>
    </div>

    <div class="ty-content">
      <div class="ty-icon animate-float">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
          <circle cx="40" cy="40" r="38" stroke="var(--accent)" stroke-width="2" opacity="0.4"/>
          <rect x="16" y="24" width="48" height="36" rx="5" stroke="var(--accent)" stroke-width="2"/>
          <circle cx="40" cy="42" r="10" stroke="var(--accent)" stroke-width="2"/>
          <circle cx="40" cy="42" r="4" fill="var(--accent)" opacity="0.6"/>
          <rect x="28" y="20" width="8" height="6" rx="2" fill="var(--accent)" opacity="0.8"/>
        </svg>
      </div>

      <div class="ty-text animate-up" style="animation-delay:0.1s">
        <h1 class="display-xl">Cảm ơn bạn<span class="text-accent">!</span></h1>
        <div class="divider" style="margin:16px auto"></div>
        <p class="text-lg text-muted">Ảnh của bạn đã sẵn sàng</p>
      </div>

      <!-- Drive upload status -->
      <div class="ty-drive-section animate-up" style="animation-delay:0.2s" id="ty-drive-section">
        <div class="ty-upload-status" id="ty-upload-status">
          <div class="ty-upload-waiting">
            <div class="upload-spinner"></div>
            <div>
              <p style="font-weight:600;margin-bottom:4px">Đang tải ảnh lên Google Drive...</p>
              <p class="text-sm text-muted" id="upload-progress-text">Vui lòng đợi</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="ty-output animate-up" style="animation-delay:0.25s">
        <div class="ty-output-info">
          <div class="ty-stat">
            <span class="ty-stat-num">${state.session.copyCount * (state.session.theme?.photoCount || 4)}</span>
            <span class="ty-stat-label">Bức ảnh</span>
          </div>
          <div class="ty-stat-divider"></div>
          <div class="ty-stat">
            <span class="ty-stat-num">${state.session.copyCount}</span>
            <span class="ty-stat-label">Tấm in</span>
          </div>
          <div class="ty-stat-divider"></div>
          <div class="ty-stat">
            <span class="ty-stat-num">${state.session.theme?.name || ''}</span>
            <span class="ty-stat-label">Chủ đề</span>
          </div>
        </div>
      </div>

      <!-- Countdown -->
      <div class="ty-countdown animate-up" style="animation-delay:0.4s" id="ty-countdown" style="visibility:hidden">
        <div class="ty-countdown-ring">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="4"/>
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" stroke-width="4"
              stroke-dasharray="214" stroke-dashoffset="0" stroke-linecap="round"
              id="ty-circle" style="transform:rotate(-90deg);transform-origin:center"/>
          </svg>
          <span class="ty-countdown-num" id="ty-timer">${duration}</span>
        </div>
        <p class="text-sm text-muted">Tự động về màn hình chờ</p>
      </div>

      <button class="btn btn-ghost" id="ty-home-btn" onclick="goIdleNow()" style="visibility:hidden">
        Về ngay
      </button>
    </div>
  `

  // ── Confetti ─────────────────────────────────────────────────────────────
  const particles = document.getElementById('ty-particles')
  const COLORS = ['#c9a84c', '#e8c96a', '#ffffff', '#4caf7d', '#5b8dd9']
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div')
    p.className = 'ty-particle'
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${COLORS[Math.floor(Math.random() * COLORS.length)]};
      width: ${Math.random() * 8 + 4}px;
      height: ${Math.random() * 8 + 4}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 3}s;
      animation-duration: ${Math.random() * 3 + 2}s;
    `
    particles.appendChild(p)
  }

  // ── Poll Drive status ─────────────────────────────────────────────────────
  const CIRCUM = 2 * Math.PI * 34

  function startCountdown() {
    if (countdownStarted) return
    countdownStarted = true

    // Show countdown + home button
    const countdownEl = document.getElementById('ty-countdown')
    const homeBtn     = document.getElementById('ty-home-btn')
    if (countdownEl) countdownEl.style.visibility = 'visible'
    if (homeBtn)     homeBtn.style.visibility     = 'visible'

    interval = setInterval(() => {
      timer--
      const numEl  = document.getElementById('ty-timer')
      const circle = document.getElementById('ty-circle')
      if (numEl)  numEl.textContent = timer
      if (circle) circle.style.strokeDashoffset = CIRCUM * (1 - timer / duration)
      if (timer <= 0) goIdleNow()
    }, 1000)
  }

  function showQR(folderUrl) {
    const section = document.getElementById('ty-drive-section')
    if (!section) return

    section.innerHTML = `
      <div class="ty-qr-ready">
        <p class="text-sm text-muted" style="margin-bottom:12px;letter-spacing:.1em;text-transform:uppercase">
          📱 Quét QR để lấy ảnh về điện thoại
        </p>
        <div class="ty-qr-wrap" id="ty-qr-wrap">
          <div class="loading-spinner" style="margin:20px auto"></div>
        </div>
        <p class="text-sm text-muted" style="margin-top:8px">
          Tất cả ảnh đã được lưu trên Google Drive
        </p>
      </div>
    `

    // Generate QR từ folder URL
    generateQR(folderUrl)
  }

  async function generateQR(url) {
    try {
      // Dùng QRCode.js từ CDN (load dynamic)
      const qrWrap = document.getElementById('ty-qr-wrap')
      if (!qrWrap) return

      // Gọi server để tạo QR dataURL
      const res  = await fetch(`http://localhost:3001/api/sessions/${state.session.id}/folder-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.success && data.data.qrDataURL) {
        qrWrap.innerHTML = `
          <div class="ty-qr-frame">
            <div class="qr-corner tl"></div>
            <div class="qr-corner tr"></div>
            <div class="qr-corner bl"></div>
            <div class="qr-corner br"></div>
            <img src="${data.data.qrDataURL}" alt="QR Drive" class="qr-img">
          </div>
        `
      }
    } catch (err) {
      console.warn('[Thankyou] QR generation error:', err)
      document.getElementById('ty-qr-wrap').innerHTML =
        `<p class="text-sm text-muted">Lỗi tạo QR: ${err.message}</p>`
    }
  }

  async function pollDriveStatus() {
    if (!state.session.id) {
      startCountdown()
      return
    }

    try {
      const { data } = await API.getDriveStatus(state.session.id)
      console.log('[Thankyou] Drive status:', data)

      const progressEl = document.getElementById('upload-progress-text')

      if (data.driveStatus === 'idle' && data.total === 0) {
        // Drive không được bật → bỏ qua section upload
        const section = document.getElementById('ty-drive-section')
        if (section) section.style.display = 'none'
        startCountdown()
        return
      }

      if (data.allDone || data.driveStatus === 'done' || data.driveStatus === 'partial') {
        // Upload xong → show QR
        clearInterval(pollInterval)
        if (data.folderUrl) {
          showQR(data.folderUrl)
        } else {
          const section = document.getElementById('ty-drive-section')
          if (section) section.innerHTML = `
            <p class="text-sm" style="color:var(--success)">
              ✅ Ảnh đã được lưu lên Google Drive
            </p>`
        }
        startCountdown()
      } else {
        // Vẫn đang upload
        const done  = data.done  || 0
        const total = data.total || 0
        if (progressEl) {
          progressEl.textContent = total > 0
            ? `${done}/${total} file đã tải lên...`
            : 'Đang chuẩn bị...'
        }
      }
    } catch (err) {
      console.warn('[Thankyou] Poll error:', err)
      // Nếu poll lỗi nhiều lần → bắt đầu đếm ngược luôn
      startCountdown()
    }
  }

  // Poll mỗi 2s
  pollDriveStatus() // chạy ngay lần đầu
  pollInterval = setInterval(pollDriveStatus, 2000)

  // Timeout tối đa: sau 60s tự start countdown dù upload chưa xong
  setTimeout(() => {
    if (!countdownStarted) {
      console.warn('[Thankyou] Drive upload timeout, starting countdown anyway')
      const progressEl = document.getElementById('upload-progress-text')
      if (progressEl) progressEl.textContent = 'Tải ảnh vẫn đang tiếp tục...'
      startCountdown()
    }
  }, 60000)

  window.goIdleNow = () => {
    clearInterval(interval)
    clearInterval(pollInterval)
    resetSession()
    navigate('idle', { noHistory: true })
  }
}

export const thankyouStyles = `
  #screen-thankyou { background: var(--bg); }

  .ty-bg {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 60%);
    overflow: hidden;
  }
  .ty-particles { position: absolute; inset: 0; pointer-events: none; }
  .ty-particle {
    position: absolute; top: -10px;
    animation: ty-fall linear infinite; opacity: 0.7;
  }
  @keyframes ty-fall {
    0%   { transform: translateY(-10px) rotate(0deg); opacity: 0.9; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }

  .ty-content {
    position: relative; z-index: 1;
    height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 20px; text-align: center; padding: 40px;
  }
  .ty-icon { color: var(--accent); }

  /* Drive upload status */
  .ty-drive-section { width: 100%; max-width: 500px; }
  .ty-upload-status {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px 28px;
  }
  .ty-upload-waiting {
    display: flex; align-items: center; gap: 16px;
  }
  .upload-spinner {
    width: 32px; height: 32px; flex-shrink: 0;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  /* QR */
  .ty-qr-ready { display: flex; flex-direction: column; align-items: center; }
  .ty-qr-wrap  { display: flex; align-items: center; justify-content: center; min-height: 120px; }
  .ty-qr-frame {
    position: relative; padding: 12px;
    background: white; border-radius: var(--radius-md);
    box-shadow: 0 4px 24px rgba(0,0,0,.3);
  }
  .qr-img { width: 200px; height: 200px; display: block; }
  .qr-corner {
    position: absolute; width: 20px; height: 20px;
    border-color: var(--accent); border-style: solid;
  }
  .qr-corner.tl { top:-2px; left:-2px; border-width:3px 0 0 3px; border-radius:4px 0 0 0; }
  .qr-corner.tr { top:-2px; right:-2px; border-width:3px 3px 0 0; border-radius:0 4px 0 0; }
  .qr-corner.bl { bottom:-2px; left:-2px; border-width:0 0 3px 3px; border-radius:0 0 0 4px; }
  .qr-corner.br { bottom:-2px; right:-2px; border-width:0 3px 3px 0; border-radius:0 0 4px 0; }

  /* Stats */
  .ty-output-info {
    display: flex; align-items: center; gap: 32px;
    padding: 16px 32px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
  }
  .ty-stat { text-align: center; }
  .ty-stat-num { display: block; font-family: var(--font-display); font-size: 1.8rem; font-weight: 700; color: var(--accent); }
  .ty-stat-label { display: block; font-size: .8rem; color: var(--text-muted); margin-top: 4px; }
  .ty-stat-divider { width: 1px; height: 40px; background: var(--border); }

  /* Countdown */
  .ty-countdown { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .ty-countdown-ring {
    position: relative; width: 80px; height: 80px;
    display: flex; align-items: center; justify-content: center;
  }
  .ty-countdown-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .ty-countdown-num { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--accent); z-index: 1; }
`
