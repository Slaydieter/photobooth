import './src/styles/global.css'

import { state, setState, on }  from './src/utils/state.js'
import { navigate, goBack, goHome } from './src/utils/router.js'
import { API } from './src/utils/api.js'

// ── Import screens ────────────────────────────────────────────────────────
import { renderIdleScreen,      idleStyles      } from './src/screens/idle.js'
import { renderCategoryScreen,
         renderThemeScreen,     categoryStyles  } from './src/screens/category.js'
import { renderQuantityScreen,  quantityStyles  } from './src/screens/quantity.js'
import { renderPaymentScreen,   paymentStyles   } from './src/screens/payment.js'
import { renderPrecaptureScreen,precaptureStyles} from './src/screens/precapture.js'
import { renderCaptureScreen,   captureStyles   } from './src/screens/capture.js'
import { renderReviewScreen,    reviewStyles    } from './src/screens/review.js'
import { renderArrangeScreen,   arrangeStyles   } from './src/screens/arrange.js'
import { renderFilterScreen,    filterStyles    } from './src/screens/filter.js'
import { renderThankyouScreen,  thankyouStyles  } from './src/screens/thankyou.js'

// ── Inject per-screen styles ──────────────────────────────────────────────
const allStyles = [
  idleStyles, categoryStyles, quantityStyles, paymentStyles,
  precaptureStyles, captureStyles, reviewStyles, filterStyles, arrangeStyles, thankyouStyles,
].join('\n')

const styleEl = document.createElement('style')
styleEl.textContent = allStyles
document.head.appendChild(styleEl)

// ── Expose global helpers (dùng trong onclick) ────────────────────────────
window.goBack  = goBack
window.goHome  = goHome

// ── Expose screen renderers (cross-screen calls) ──────────────────────────
window._screens = {
  renderQuantityScreen,
  renderFilterScreen,
  renderArrangeScreen,
}

// ── Navigation handler — render screen khi navigate ───────────────────────
on('navigate', async ({ to, from }) => {
  // Cleanup màn hình cũ
  if (from === 'precapture' && window._cleanupPrecapture) {
    window._cleanupPrecapture()
    window._cleanupPrecapture = null
  }

  // Render màn hình mới
  switch (to) {
    case 'idle':       renderIdleScreen();       break
    case 'category':   renderCategoryScreen();   break
    case 'theme':      /* rendered trước khi navigate */ break
    case 'quantity':   /* rendered trước khi navigate */ break
    case 'payment':    renderPaymentScreen();    break
    case 'precapture': renderPrecaptureScreen(); break
    case 'capture':    renderCaptureScreen();    break
    case 'review':     renderReviewScreen();     break
    case 'filter':     /* rendered trước khi navigate */ break
    case 'arrange':    /* rendered trước khi navigate */ break
    case 'thankyou':   renderThankyouScreen();   break
  }
})

// ── Boot ──────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const { data: settings } = await API.getSettings()
    Object.assign(state.settings, settings)
  } catch (err) {
    console.warn('Could not load settings:', err.message)
  }

  // Render màn hình idle đầu tiên
  renderIdleScreen()
}

boot()
