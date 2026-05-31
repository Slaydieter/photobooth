import { navigate } from '../utils/router.js'
import { state } from '../utils/state.js'
import { API } from '../utils/api.js'

export async function renderPaymentScreen() {
  const el = document.getElementById('screen-payment')
  el.innerHTML = `
    <div class="payment-layout">
      <div class="payment-left">
        <p class="text-sm text-muted" style="letter-spacing:0.15em;text-transform:uppercase">Thanh toán</p>
        <h2 class="display-md" style="margin-top:8px">Quét mã <span class="text-accent">QR</span></h2>
        <div class="divider" style="margin:20px 0"></div>

        <div class="payment-summary">
          <div class="payment-row">
            <span class="text-muted">Chủ đề</span>
            <span>${state.session.theme?.name || ''}</span>
          </div>
          <div class="payment-row">
            <span class="text-muted">Số tấm</span>
            <span>${state.session.copyCount} tấm (${state.session.copyCount * 4} ảnh)</span>
          </div>
          <div class="payment-row" style="border-top:1px solid var(--border);padding-top:16px;margin-top:4px">
            <span style="font-weight:600">Tổng tiền</span>
            <span class="text-accent" style="font-size:1.5rem;font-weight:700">
              ${state.session.totalPrice.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        <div class="payment-banks">
          <p class="text-sm text-muted" style="margin-bottom:12px">Hỗ trợ tất cả app ngân hàng</p>
          <div class="bank-logos">
            <span class="bank-tag">VCB</span>
            <span class="bank-tag">TCB</span>
            <span class="bank-tag">MB</span>
            <span class="bank-tag">VPB</span>
            <span class="bank-tag">TPB</span>
            <span class="bank-tag">MOMO</span>
            <span class="bank-tag">+ nhiều hơn</span>
          </div>
        </div>

        <div class="payment-actions">
          <button class="btn btn-primary btn-lg" id="confirm-paid-btn" onclick="confirmPayment()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Đã thanh toán xong
          </button>
          <p class="text-sm text-muted" style="margin-top:8px">* Nhân viên xác nhận sau khi kiểm tra</p>
        </div>
      </div>

      <div class="payment-right">
        <div class="qr-wrapper" id="qr-wrapper">
          <div class="loading-spinner"></div>
        </div>
        <div class="qr-info" id="qr-info"></div>
      </div>
    </div>
  `

  // Load QR
  try {
    const { data } = await API.getSessionQR(state.session.id)
    document.getElementById('qr-wrapper').innerHTML = `
      <div class="qr-frame">
        <div class="qr-corner tl"></div>
        <div class="qr-corner tr"></div>
        <div class="qr-corner bl"></div>
        <div class="qr-corner br"></div>
        <img src="${data.qrDataURL}" alt="QR thanh toán" class="qr-img">
      </div>
    `
    document.getElementById('qr-info').innerHTML = `
      <p class="text-sm text-muted" style="margin-top:16px">Mã giao dịch: <strong style="color:var(--text)">${data.description}</strong></p>
    `
  } catch (err) {
    document.getElementById('qr-wrapper').innerHTML =
      `<p class="text-muted">Lỗi tạo QR: ${err.message}</p>`
  }

  window.confirmPayment = async () => {
    const btn = document.getElementById('confirm-paid-btn')
    btn.disabled = true
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      Đang xác nhận...
    `
    try {
      await API.confirmPayment(state.session.id)
      navigate('precapture')
    } catch (err) {
      btn.disabled = false
      btn.innerHTML = `✓ Đã thanh toán xong`
    }
  }
}

export const paymentStyles = `
  .payment-layout {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .payment-left {
    padding: 80px 40px 40px 60px;
    display: flex; flex-direction: column;
    justify-content: center; gap: 28px;
    border-right: 1px solid var(--border);
  }
  .payment-right {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 40px;
  }
  .payment-summary {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .payment-row {
    display: flex; justify-content: space-between;
    font-size: 0.95rem;
  }
  .bank-logos { display: flex; flex-wrap: wrap; gap: 8px; }
  .bank-tag {
    padding: 4px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .payment-actions { margin-top: auto; }

  /* QR */
  .qr-wrapper {
    display: flex; align-items: center; justify-content: center;
  }
  .qr-frame {
    position: relative;
    padding: 20px;
    background: white;
    border-radius: var(--radius-lg);
  }
  .qr-img { display: block; width: 280px; height: 280px; }
  .qr-corner {
    position: absolute;
    width: 24px; height: 24px;
    border-color: var(--accent);
    border-style: solid;
  }
  .qr-corner.tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
  .qr-corner.tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
  .qr-corner.bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
  .qr-corner.br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
`
