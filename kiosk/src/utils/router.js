import { state, emit } from './state.js'

const SCREENS = [
  'idle', 'category', 'theme',
  'quantity', 'payment', 'precapture',
  'capture', 'review', 'arrange', 'thankyou',
]

export function navigate(screenId, opts = {}) {
  const prev = state.currentScreen
  if (prev === screenId) return

  // Exit current
  const prevEl = document.getElementById(`screen-${prev}`)
  if (prevEl) {
    prevEl.classList.add('exit')
    setTimeout(() => {
      prevEl.classList.remove('active', 'exit')
    }, 400)
  }

  // Enter next
  state.currentScreen = screenId
  if (!opts.noHistory) state.history.push(prev)

  const nextEl = document.getElementById(`screen-${screenId}`)
  if (nextEl) {
    nextEl.classList.add('active')
  }

  emit('navigate', { from: prev, to: screenId })
}

export function goBack() {
  const prev = state.history.pop()
  if (prev) navigate(prev, { noHistory: true })
}

export function goHome() {
  state.history = []
  navigate('idle', { noHistory: true })
}
