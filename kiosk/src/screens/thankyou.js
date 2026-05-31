import { navigate } from '../utils/router.js'
import { state, resetSession } from '../utils/state.js'

export function renderThankyouScreen() {
  const el       = document.getElementById('screen-thankyou')
  const duration = parseInt(state.settings.thankyou_duration || '10')
  const outputs  = state.session.outputs || []
  let   timer    = duration
  let   interval = null

  // Lấy QR codes từ outputs
  const qrCodes = outputs.filter(o => o.driveQRCode)

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

      ${qrCodes.length > 0 ? `
        <div class="ty-qr-section animate-up" style="animation-delay:0.2s">
          <p class="text-sm text-muted" style="margin-bottom:16px;letter-spacing:0.1em;text-transform:uppercase">
            Quét QR để lấy ảnh về điện thoại
          </p>
          <div class="ty-qr-grid">
            ${qrCodes.map((o, i) => `
              <div class="ty-qr-item">
                <div class="ty-qr-frame">
                  <img src="${o.driveQRCode}" alt="QR tấm ${i+1}">
                </div>
                <p class="text-sm text-muted" style="margin-top:8px">Tấm ${i + 1}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="ty-output animate-up" style="animation-delay:0.2s">
          <div class="ty-output-info">
            <div class="ty-stat">
              <span class="ty-stat-num">${state.session.copyCount * 4}</span>
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
      `}

      <div class="ty-countdown animate-up" style="animation-delay:0.35s">
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

      <button class="btn btn-ghost" onclick="goIdleNow()">Về ngay</button>
    </div>
  `

  // Confetti
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

  // Countdown
  const CIRCUM = 2 * Math.PI * 34
  interval = setInterval(() => {
    timer--
    const numEl  = document.getElementById('ty-timer')
    const circle = document.getElementById('ty-circle')
    if (numEl)  numEl.textContent = timer
    if (circle) circle.style.strokeDashoffset = CIRCUM * (1 - timer / duration)
    if (timer <= 0) goIdleNow()
  }, 1000)

  window.goIdleNow = () => {
    clearInterval(interval)
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
    gap: 24px; text-align: center; padding: 40px;
  }
  .ty-icon { color: var(--accent); }

  /* QR section */
  .ty-qr-section {}
  .ty-qr-grid {
    display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;
  }
  .ty-qr-item { display: flex; flex-direction: column; align-items: center; }
  .ty-qr-frame {
    padding: 12px;
    background: white;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }
  .ty-qr-frame img { width: 180px; height: 180px; display: block; }

  /* Stats */
  .ty-output-info {
    display: flex; align-items: center; gap: 32px;
    padding: 20px 40px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
  }
  .ty-stat { text-align: center; }
  .ty-stat-num { display: block; font-family: var(--font-display); font-size: 2rem; font-weight: 700; color: var(--accent); }
  .ty-stat-label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }
  .ty-stat-divider { width: 1px; height: 48px; background: var(--border); }

  /* Countdown */
  .ty-countdown { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .ty-countdown-ring {
    position: relative; width: 80px; height: 80px;
    display: flex; align-items: center; justify-content: center;
  }
  .ty-countdown-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .ty-countdown-num { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--accent); z-index: 1; }
`
