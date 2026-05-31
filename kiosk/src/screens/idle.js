import { navigate } from '../utils/router.js'
import { state } from '../utils/state.js'

export function renderIdleScreen() {
  const el = document.getElementById('screen-idle')
  const bgUrl = state.settings.idle_background || ''

  el.innerHTML = `
    <div class="idle-bg" id="idle-bg">
      ${bgUrl
        ? `<img src="http://localhost:3001/${bgUrl}" class="idle-bg-img" alt="background" onerror="this.style.display='none'">`
        : `<div class="idle-bg-gradient"></div>`
      }
      <div class="idle-overlay"></div>
    </div>

    <div class="idle-content">
      <div class="idle-logo animate-up" style="animation-delay:0.1s">
        <div class="idle-logo-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="10" width="40" height="30" rx="6" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="24" cy="25" r="9" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="24" cy="25" r="4" fill="currentColor" opacity="0.6"/>
            <rect x="14" y="6" width="8" height="5" rx="2" fill="currentColor" opacity="0.8"/>
          </svg>
        </div>
        <span class="idle-logo-text">${state.settings.app_name || 'PhotoBooth'}</span>
      </div>

      <div class="idle-main animate-up" style="animation-delay:0.25s">
        <h1 class="display-xl idle-title">
          Khoảnh khắc<br>
          <span class="text-accent">của bạn</span>
        </h1>
        <div class="divider" style="margin: 24px auto"></div>
        <p class="text-lg text-muted">Chụp ảnh, in ngay, kỷ niệm mãi mãi</p>
      </div>

      <div class="idle-tap animate-up" style="animation-delay:0.4s">
        <div class="tap-ring animate-pulse" id="tap-area">
          <div class="tap-inner">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
              <path d="M24 8V16M24 32V40M8 24H16M32 24H40" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="24" cy="24" r="8" stroke="currentColor" stroke-width="2.5"/>
            </svg>
          </div>
        </div>
        <p class="idle-tap-text animate-pulse" id="idle-blink">chạm để bắt đầu</p>
      </div>

      <div class="idle-footer animate-up" style="animation-delay:0.55s">
        <p class="text-sm text-muted">📸 Chất lượng ảnh chuyên nghiệp · In ngay trong 30 giây</p>
      </div>
    </div>
  `

  // Click / touch để bắt đầu
  el.addEventListener('click', () => navigate('category'), { once: false })
}

export const idleStyles = `
  #screen-idle {
    background: var(--bg);
  }
  .idle-bg {
    position: absolute; inset: 0;
    z-index: 0;
  }
  .idle-bg-img {
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0.35;
  }
  .idle-bg-gradient {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 60% 40%, #1a1200 0%, #0a0a0a 70%);
  }
  .idle-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom,
      rgba(10,10,10,0.3) 0%,
      rgba(10,10,10,0.7) 60%,
      rgba(10,10,10,0.95) 100%
    );
  }
  .idle-content {
    position: relative; z-index: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
    padding: 40px;
    text-align: center;
  }
  .idle-logo {
    display: flex; align-items: center; gap: 12px;
    opacity: 0;
  }
  .idle-logo-icon {
    width: 48px; height: 48px;
    color: var(--accent);
  }
  .idle-logo-text {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .idle-main { opacity: 0; }
  .idle-title {
    text-shadow: 0 4px 40px rgba(0,0,0,0.8);
    line-height: 1.1;
  }
  .idle-tap { display: flex; flex-direction: column; align-items: center; gap: 20px; opacity: 0; }
  .tap-ring {
    width: 120px; height: 120px;
    border-radius: 50%;
    border: 2px solid rgba(201,168,76,0.4);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    position: relative;
    transition: var(--transition);
  }
  .tap-ring::before {
    content: '';
    position: absolute; inset: -12px;
    border-radius: 50%;
    border: 1px solid rgba(201,168,76,0.15);
  }
  .tap-ring::after {
    content: '';
    position: absolute; inset: -24px;
    border-radius: 50%;
    border: 1px solid rgba(201,168,76,0.07);
  }
  .tap-ring:hover { border-color: var(--accent); box-shadow: 0 0 40px var(--accent-glow); }
  .tap-inner {
    width: 80px; height: 80px;
    border-radius: 50%;
    background: var(--accent-glow);
    border: 1.5px solid var(--accent);
    display: flex; align-items: center; justify-content: center;
    color: var(--accent);
  }
  .idle-tap-text {
    font-family: var(--font-display);
    font-size: 1.1rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .idle-footer { opacity: 0; }
`
