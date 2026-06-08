import { navigate } from '../utils/router.js'
import { state, setState } from '../utils/state.js'

export function renderReviewScreen() {
  const el     = document.getElementById('screen-review')
  const photos  = state.session.photos || []
  const canRetake = state.session.retakeCount < 1

  el.innerHTML = `
    <div class="review-layout">
      <div class="review-header">
        <div>
          <p class="text-sm text-muted" style="letter-spacing:0.12em;text-transform:uppercase">
            Xem lại ảnh · ${photos.length} bức
          </p>
          <h2 class="display-md" style="margin-top:6px">
            Bạn thấy <span class="text-accent">thế nào?</span>
          </h2>
        </div>
        <div class="review-header-actions">
          ${canRetake ? `
            <button class="btn btn-outline" id="retake-btn" onclick="doRetake()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              Chụp lại
            </button>
          ` : `
            <span class="text-sm text-muted" style="padding:10px 16px">
              (Đã dùng lượt retake)
            </span>
          `}
          <button class="btn btn-primary btn-lg" onclick="goToArrange()">
            Chọn ảnh ghép
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Photo grid -->
      <div class="review-grid scroll-area" id="review-grid">
        ${photos.map((p, i) => `
          <div class="review-photo animate-scale" style="animation-delay:${i * 0.05}s">
            <img src="http://localhost:3001/${p.filePath}" alt="Ảnh ${i+1}"
                 onerror="this.style.opacity='0.3'">
            <div class="review-photo-label">
              ${p.takeRound === 2 ? '<span class="retake-badge">Retake</span>' : ''}
              <span class="photo-num">#${i + 1}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  window.doRetake = () => {
    if (!canRetake) return
    setState('session.retakeCount', state.session.retakeCount + 1)
    navigate('capture')
  }

  window.goToArrange = async () => {
    console.log('[Review] goToArrange called')
    try {
      const { data: settings } = await (await fetch('http://localhost:3001/api/settings')).json()
      console.log('[Review] filter settings:', {
        overlay:   settings.filter_overlay_enabled,
        mediapipe: settings.filter_mediapipe_enabled,
      })

      // Nếu key chưa có trong DB → mặc định là true (bật)
      const overlayOn   = settings.filter_overlay_enabled   !== 'false'
      const mediapipeOn = settings.filter_mediapipe_enabled !== 'false'
      console.log('[Review] overlayOn:', overlayOn, '| mediapipeOn:', mediapipeOn)

      if (overlayOn || mediapipeOn) {
        console.log('[Review] → navigate to filter')
        const { renderFilterScreen } = window._screens
        await renderFilterScreen()
        navigate('filter')
      } else {
        console.log('[Review] → navigate to arrange (filter disabled)')
        const { renderArrangeScreen } = window._screens
        renderArrangeScreen()
        navigate('arrange')
      }
    } catch (err) {
      console.warn('[Review] Settings fetch error, skip filter:', err)
      const { renderArrangeScreen } = window._screens
      renderArrangeScreen()
      navigate('arrange')
    }
  }
}

export const reviewStyles = `
  .review-layout {
    height: 100%;
    display: flex; flex-direction: column;
    padding: 40px 48px;
    gap: 28px;
  }
  .review-header {
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .review-header-actions { display: flex; align-items: center; gap: 12px; }
  .review-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
    align-content: start;
    padding-right: 6px;
  }
  .review-photo {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1.5px solid var(--border);
    background: var(--surface);
    cursor: pointer;
    transition: var(--transition);
    opacity: 0;
  }
  .review-photo:hover { border-color: var(--border-hover); transform: scale(1.02); }
  .review-photo img { width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover; }
  .review-photo-label {
    position: absolute; top: 8px; left: 8px; right: 8px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .retake-badge {
    padding: 2px 8px;
    background: var(--accent);
    color: #1a1200;
    border-radius: 10px;
    font-size: 0.65rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .photo-num {
    padding: 2px 8px;
    background: rgba(0,0,0,0.6);
    color: var(--text-muted);
    border-radius: 10px;
    font-size: 0.7rem;
    margin-left: auto;
  }
`
