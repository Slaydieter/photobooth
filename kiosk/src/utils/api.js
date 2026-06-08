const BASE = 'http://localhost:3001/api'

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res  = await fetch(`${BASE}${path}`, opts)
  const data = await res.json()
  if (!data.success) throw new Error(data.message || 'API error')
  return data
}

export const API = {
  get:    (path)        => api('GET',    path),
  post:   (path, body)  => api('POST',   path, body),
  put:    (path, body)  => api('PUT',    path, body),
  delete: (path)        => api('DELETE', path),

  // Shortcuts
  getSettings:    ()           => API.get('/settings'),
  getCategories:  ()           => API.get('/categories'),
  getThemesByCategory: (id)    => API.get(`/themes/category/${id}`),
  getTheme:       (id)         => API.get(`/themes/${id}`),
  getStickers:    ()           => API.get('/stickers'),

  createSession:  (body)       => API.post('/sessions', body),
  getSessionQR:   (id)         => API.get(`/sessions/${id}/qr`),
  confirmPayment: (id)         => API.put(`/sessions/${id}/confirm-payment`),
  saveStickers:   (id, ids)    => API.put(`/sessions/${id}/stickers`, { stickerIds: ids }),
  savePhoto:      (id, body)   => API.post(`/sessions/${id}/photos`, body),
  getPhotos:      (id)         => API.get(`/sessions/${id}/photos`),
  saveOutput:     (id, layouts)=> API.post(`/sessions/${id}/output`, { layouts }),
  saveFilterPhoto:(id, body)    => API.post(`/sessions/${id}/filter-photos`, body),
  saveVideo:      (id, body)    => API.post(`/sessions/${id}/video`, body),
  getFilters:     ()            => API.get('/filters'),
  getDriveStatus: (id)          => API.get(`/sessions/${id}/drive-status`),
}
