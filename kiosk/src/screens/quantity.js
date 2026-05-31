import { navigate, goBack } from '../utils/router.js'
import { state, setState } from '../utils/state.js'
import { API } from '../utils/api.js'

export function renderQuantityScreen() {
  const el = document.getElementById('screen-quantity')
  const theme = state.session.theme

  el.innerHTML = `
    <button class="back-btn" onclick="goBack()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Quay lại
    </button>

    <div class="qty-layout">
      <!-- Left: Preview -->
      <div class="qty-preview">
        <p class="text-sm text-muted" style="letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px">
          Mẫu · ${theme?.name || ''}
        </p>
        <div class="qty-preview-tabs">
          <button class="qty-tab active" id="tab-front" onclick="switchTab('front')">Mặt trước</button>
          <button class="qty-tab" id="tab-back" onclick="switchTab('back')">Mặt sau</button>
        </div>
        <div class="qty-preview-frame" id="preview-frame">
          <div id="preview-front" class="preview-side active">
            ${theme?.frontTemplate
              ? `<img src="http://localhost:3001/${theme.frontTemplate}" alt="Mặt trước">`
              : `<div class="preview-placeholder">
                  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                    <rect x="8" y="8" width="48" height="48" rx="6"/>
                    <rect x="18" y="18" width="12" height="12" rx="2"/>
                    <rect x="18" y="34" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.3"/>
                    <rect x="18" y="41" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.2"/>
                  </svg>
                  <span>Mặt trước</span>
                </div>`
            }
          </div>
          <div id="preview-back" class="preview-side">
            ${theme?.backTemplate
              ? `<img src="http://localhost:3001/${theme.backTemplate}" alt="Mặt sau">`
              : `<div class="preview-placeholder">
                  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                    <rect x="8" y="8" width="48" height="48" rx="6"/>
                    <circle cx="32" cy="28" r="10"/>
                    <path d="M16 50c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="currentColor" opacity="0.2"/>
                  </svg>
                  <span>Mặt sau</span>
                </div>`
            }
          </div>
        </div>
      </div>

      <!-- Right: Quantity picker -->
      <div class="qty-picker">
        <div>
          <p class="text-sm text-muted" style="letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px">Số lượng tấm</p>
          <h2 class="display-md">Chọn <span class="text-accent">bao nhiêu tấm?</span></h2>
          <div class="divider" style="margin:20px 0"></div>
          <p class="text-md text-muted">Mỗi tấm gồm <strong style="color:var(--text)">4 bức ảnh</strong></p>
        </div>

        <div class="qty-counter">
          <button class="qty-btn" id="qty-minus" onclick="changeQty(-1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24">
              <path d="M5 12h14"/>
            </svg>
          </button>
          <div class="qty-display">
            <span class="qty-number" id="qty-number">1</span>
            <span class="qty-label">tấm</span>
          </div>
          <button class="qty-btn" id="qty-plus" onclick="changeQty(1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>

        <div class="qty-info-box" id="qty-info">
          <div class="qty-info-row">
            <span class="text-muted">Số bức ảnh</span>
            <span class="text-accent" id="info-shots">4 bức</span>
          </div>
          <div class="qty-info-row">
            <span class="text-muted">Đơn giá</span>
            <span>${theme ? theme.pricePerCopy.toLocaleString('vi-VN') + 'đ / tấm' : ''}</span>
          </div>
          <div class="qty-info-row" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
            <span class="text-md" style="font-weight:600">Tổng cộng</span>
            <span class="text-accent" style="font-size:1.3rem;font-weight:700" id="info-total">
              ${theme ? theme.pricePerCopy.toLocaleString('vi-VN') + 'đ' : ''}
            </span>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" id="qty-confirm" style="width:100%" onclick="confirmQuantity()">
          Xác nhận &nbsp;→
        </button>
      </div>
    </div>
  `

  // State local
  let qty = 1
  const MAX_QTY = 10

  window.changeQty = (delta) => {
    qty = Math.max(1, Math.min(MAX_QTY, qty + delta))
    document.getElementById('qty-number').textContent = qty
    document.getElementById('info-shots').textContent = `${qty * 4} bức`
    document.getElementById('info-total').textContent =
      (theme.pricePerCopy * qty).toLocaleString('vi-VN') + 'đ'
    document.getElementById('qty-minus').disabled = qty <= 1
    document.getElementById('qty-plus').disabled  = qty >= MAX_QTY
  }

  window.switchTab = (side) => {
    document.getElementById('tab-front').classList.toggle('active', side === 'front')
    document.getElementById('tab-back').classList.toggle('active', side === 'back')
    document.getElementById('preview-front').classList.toggle('active', side === 'front')
    document.getElementById('preview-back').classList.toggle('active', side === 'back')
  }

  window.confirmQuantity = async () => {
    const btn = document.getElementById('qty-confirm')
    btn.disabled = true
    btn.textContent = 'Đang xử lý...'
    try {
      setState('session.copyCount', qty)
      const { data: session } = await API.createSession({
        themeId:   state.session.themeId,
        copyCount: qty,
      })
      setState('session.id',         session._id)
      setState('session.totalPrice', session.totalPrice)
      navigate('payment')
    } catch (err) {
      btn.disabled = false
      btn.textContent = 'Xác nhận →'
      alert('Lỗi: ' + err.message)
    }
  }
}

export const quantityStyles = `
  .qty-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  /* Left preview */
  .qty-preview {
    padding: 80px 40px 40px 60px;
    display: flex; flex-direction: column;
    border-right: 1px solid var(--border);
  }
  .qty-preview-tabs {
    display: flex; gap: 4px;
    background: var(--bg-3);
    border-radius: var(--radius-md);
    padding: 4px;
    margin-bottom: 20px;
    width: fit-content;
  }
  .qty-tab {
    padding: 8px 20px;
    border-radius: 10px;
    border: none; background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.875rem; font-weight: 500;
    cursor: pointer; transition: var(--transition);
  }
  .qty-tab.active { background: var(--surface-2); color: var(--text); }
  .qty-preview-frame {
    flex: 1;
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .preview-side {
    position: absolute; inset: 0;
    opacity: 0; transition: opacity 0.3s ease;
    display: flex; align-items: center; justify-content: center;
  }
  .preview-side.active { opacity: 1; }
  .preview-side img { width: 100%; height: 100%; object-fit: contain; }
  .preview-placeholder {
    display: flex; flex-direction: column;
    align-items: center; gap: 16px;
    color: var(--border-hover);
    font-size: 0.875rem;
  }

  /* Right picker */
  .qty-picker {
    padding: 80px 60px 40px 40px;
    display: flex; flex-direction: column;
    justify-content: space-between;
    gap: 32px;
  }
  .qty-counter {
    display: flex; align-items: center; justify-content: center;
    gap: 24px;
  }
  .qty-btn {
    width: 64px; height: 64px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: var(--transition);
  }
  .qty-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .qty-display {
    display: flex; flex-direction: column; align-items: center;
    min-width: 120px;
  }
  .qty-number {
    font-family: var(--font-display);
    font-size: 5rem; font-weight: 900;
    color: var(--accent); line-height: 1;
  }
  .qty-label { font-size: 0.875rem; color: var(--text-muted); margin-top: 4px; }
  .qty-info-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .qty-info-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.95rem;
  }
`
