require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')
const connectDB = require('./db/connect')

const app  = express()
const PORT = process.env.PORT || 3001

// ─── Connect MongoDB ───────────────────────────────────────────────────────
connectDB()

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '50mb' })) // cần 50mb cho base64 ảnh
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve static assets
const ASSETS_DIR = path.join(__dirname, '../assets')
fs.mkdirSync(ASSETS_DIR, { recursive: true })
app.use('/assets', express.static(ASSETS_DIR))

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api/settings',   require('./api/routes/settings'))
app.use('/api/categories', require('./api/routes/categories'))
app.use('/api/themes',     require('./api/routes/themes'))
app.use('/api/stickers',   require('./api/routes/stickers'))
app.use('/api/sessions',   require('./api/routes/sessions'))

// ─── Serve Kiosk App ───────────────────────────────────────────────────────
const KIOSK_DIR = path.join(__dirname, '../kiosk/dist')
if (fs.existsSync(KIOSK_DIR)) {
  app.use('/kiosk', express.static(KIOSK_DIR))
  app.get('/kiosk*', (req, res) => res.sendFile(path.join(KIOSK_DIR, 'index.html')))
} else {
  // Development: redirect về kiosk dev server
  app.get('/kiosk', (req, res) => res.redirect('http://localhost:5173'))
}

// ─── Serve Dashboard ───────────────────────────────────────────────────────
const DASHBOARD_DIR = path.join(__dirname, '../dashboard')
app.use('/dashboard', express.static(DASHBOARD_DIR))
app.get('/dashboard', (req, res) => res.sendFile(path.join(DASHBOARD_DIR, 'index.html')))
app.get('/', (req, res) => res.redirect('/dashboard'))

// ─── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, message: err.message })
})

app.listen(PORT, () => {
  console.log(`🚀 PhotoBooth server running on http://localhost:${PORT}`)
  console.log(`📊 Dashboard: http://localhost:${PORT}`)
  console.log(`📱 Kiosk:     http://localhost:${PORT}/kiosk`)
  console.log(`🔌 API:       http://localhost:${PORT}/api`)
})