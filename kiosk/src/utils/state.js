// State đơn giản, không dùng framework nặng
export const state = {
  // Settings từ server
  settings: {},

  // Session hiện tại
  session: {
    id:             null,
    themeId:        null,
    theme:          null,
    categoryId:     null,
    category:       null,
    copyCount:      1,
    totalPrice:     0,
    selectedStickers: [],
    photos:         [],     // tất cả ảnh kể cả retake
    retakeCount:    0,      // đã retake chưa (max 1)
    layouts:        [],     // ảnh đã sắp xếp cho từng tấm
  },

  // Navigation
  currentScreen: 'idle',
  history:       [],

  // Listeners
  _listeners: {},
}

export function setState(path, value) {
  const keys = path.split('.')
  let obj = state
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]]
  }
  obj[keys[keys.length - 1]] = value
  emit('change', { path, value })
}

export function resetSession() {
  state.session = {
    id:               null,
    themeId:          null,
    theme:            null,
    categoryId:       null,
    category:         null,
    copyCount:        1,
    totalPrice:       0,
    selectedStickers: [],
    photos:           [],
    retakeCount:      0,
    layouts:          [],
  }
}

// ── Simple event bus ─────────────────────────────────────────────
export function on(event, cb) {
  if (!state._listeners[event]) state._listeners[event] = []
  state._listeners[event].push(cb)
}

export function emit(event, data) {
  ;(state._listeners[event] || []).forEach(cb => cb(data))
}
