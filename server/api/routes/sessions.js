const express  = require('express')
const router   = express.Router()
const path     = require('path')
const fs       = require('fs')
const QRCode   = require('qrcode')
const { v4: uuidv4 } = require('uuid')

const Session  = require('../../models/Session')
const { enqueue, getSessionStatus } = require('../../utils/uploadQueue')
const Theme    = require('../../models/Theme')
const Settings = require('../../models/Settings')

const { createStrip, parseStripConfig } = require('../../utils/imageComposite')
const { createFolder, uploadFile, buildFolderName } = require('../../utils/googleDrive')

const ASSETS_ROOT = path.join(__dirname, '../../../assets')

async function getAllSettings() {
  const rows = await Settings.find()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

async function generateVietQR(amount, description, settings) {
  const bin     = settings.bank_bin     || '970436'
  const account = settings.bank_account || '1234567890'
  const qrString = [
    '000201', '010212',
    `26${(36 + bin.length + account.length).toString().padStart(2,'0')}`,
    `0010A000000727`,
    `01${bin.length.toString().padStart(2,'0')}${bin}`,
    `02${account.length.toString().padStart(2,'0')}${account}`,
    '5802VN',
    `54${String(amount).length.toString().padStart(2,'0')}${amount}`,
    '5303704',
    `62${(4 + description.length).toString().padStart(2,'0')}08${description.length.toString().padStart(2,'0')}${description}`,
    '6304',
  ].join('')
  return QRCode.toDataURL(qrString, { errorCorrectionLevel: 'M', width: 300, margin: 2 })
}

router.post('/', async (req, res) => {
  try {
    const { themeId, copyCount } = req.body
    const theme = await Theme.findById(themeId)
    if (!theme) return res.status(404).json({ success: false, message: 'Theme not found' })
    const totalPrice = theme.pricePerCopy * (copyCount || 1)
    const session = await Session.create({ themeId, copyCount: copyCount || 1, totalPrice, status: 'pending' })
    res.json({ success: true, data: session })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/:sessionId/qr', async (req, res) => {
  try {
    const session  = await Session.findById(req.params.sessionId).populate('themeId', 'name')
    if (!session) return res.status(404).json({ success: false, message: 'Not found' })
    const settings  = await getAllSettings()
    const desc      = `PTB${session._id.toString().slice(-8).toUpperCase()}`
    const qrDataURL = await generateVietQR(session.totalPrice, desc, settings)
    res.json({ success: true, data: { qrDataURL, amount: session.totalPrice, description: desc } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.put('/:sessionId/confirm-payment', async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(req.params.sessionId, { status: 'paid' }, { new: true })
    res.json({ success: true, data: session })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.put('/:sessionId/stickers', async (req, res) => {
  try {
    const { stickerIds } = req.body
    const session = await Session.findByIdAndUpdate(
      req.params.sessionId,
      { selectedStickers: stickerIds, status: 'capturing' },
      { new: true }
    )
    res.json({ success: true, data: session })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/:sessionId/photos', async (req, res) => {
  try {
    const { imageData, takeRound, shotIndex } = req.body
    const sessionId = req.params.sessionId
    const dir       = path.join(ASSETS_ROOT, `outputs/${sessionId}/photos`)
    fs.mkdirSync(dir, { recursive: true })
    const filename  = `round${takeRound}-shot${String(shotIndex).padStart(2,'0')}-${Date.now()}.jpg`
    const filePath  = path.join(dir, filename)
    const b64       = imageData.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
    const relativePath = `assets/outputs/${sessionId}/photos/${filename}`

    let drivePhotoLink = null
    try {
      const session  = await Session.findById(sessionId).populate('themeId', 'name')
      const settings = await getAllSettings()
      if (!session.driveFolderId) {
        const folderName = buildFolderName(session.themeId?.name || 'Session')
        const parentId   = settings.drive_parent_folder_id || null
        const folderId   = await createFolder(folderName, parentId)
        await Session.findByIdAndUpdate(sessionId, { driveFolderId: folderId, driveFolderName: folderName })
        session.driveFolderId = folderId
      }
      const uploaded = await uploadFile(filePath, filename, session.driveFolderId)
      drivePhotoLink = uploaded.webViewLink
    } catch (driveErr) {
      console.warn('Drive upload skipped:', driveErr.message)
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      { $push: { photos: { filePath: relativePath, takeRound, shotIndex, driveLink: drivePhotoLink } } },
      { new: true }
    )
    res.json({ success: true, data: { filePath: relativePath, driveLink: drivePhotoLink, photoCount: updatedSession.photos.length } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/:sessionId/photos', async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ success: false, message: 'Not found' })
    res.json({ success: true, data: session.photos })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/:sessionId/output', async (req, res) => {
  try {
    const { layouts } = req.body
    const session  = await Session.findById(req.params.sessionId).populate('themeId')
    if (!session) return res.status(404).json({ success: false, message: 'Not found' })

    const settings    = await getAllSettings()
    const stripConfig = parseStripConfig(settings)
    const templateLayer = session.themeId?.templateLayer
      ? path.join(ASSETS_ROOT, '..', session.themeId.templateLayer)
      : null

    const outputs = []

    for (const layout of layouts) {
      const { copyIndex, photoArrangement } = layout
      const photoPaths = photoArrangement.map(photoId => {
        const photo = session.photos.find(p => String(p._id) === String(photoId))
        return photo ? path.join(ASSETS_ROOT, '..', photo.filePath) : null
      }).filter(Boolean)

      const stripDir      = path.join(ASSETS_ROOT, `outputs/${session._id}`)
      const stripFilename = `strip-${copyIndex + 1}.jpg`
      const stripPath     = path.join(ASSETS_ROOT, `outputs/${session._id}/strips`, stripFilename)
      fs.mkdirSync(path.dirname(stripPath), { recursive: true })

      await createStrip(photoPaths, templateLayer, stripPath, stripConfig)

      const stripRelative = `assets/outputs/${session._id}/strips/${stripFilename}`
      let stripDriveLink  = null
      let stripQRDataURL  = null

      try {
        let folderId = session.driveFolderId
        if (!folderId) {
          const folderName = buildFolderName(session.themeId?.name || 'Session')
          const parentId   = settings.drive_parent_folder_id || null
          folderId = await createFolder(folderName, parentId)
          await Session.findByIdAndUpdate(session._id, { driveFolderId: folderId, driveFolderName: folderName })
        }
        const uploaded  = await uploadFile(stripPath, stripFilename, folderId)
        stripDriveLink  = uploaded.webViewLink
        stripQRDataURL  = await QRCode.toDataURL(stripDriveLink, { errorCorrectionLevel: 'M', width: 300, margin: 2 })
      } catch (driveErr) {
        console.warn('Drive strip upload skipped:', driveErr.message)
      }

      outputs.push({ copyIndex, frontPath: stripRelative, driveLink: stripDriveLink, driveQRCode: stripQRDataURL })
    }

    await Session.findByIdAndUpdate(session._id, { status: 'completed', outputs, completedAt: new Date() }, { new: true })
    res.json({ success: true, data: outputs })
  } catch (err) {
    console.error('Output error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ─── POST /sessions/:id/video-upload — lưu video multipart ──────────────────
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(ASSETS_ROOT, `outputs/${req.params.sessionId}/videos`)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const takeRound = req.body.takeRound || '1'
    cb(null, `video-round${takeRound}-${Date.now()}.webm`)
  },
})
const uploadVideo = multer({ storage: videoStorage })

router.post('/:sessionId/video-upload', uploadVideo.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No video file' })
    const relativePath = `assets/outputs/${req.params.sessionId}/videos/${req.file.filename}`
    console.log(`[Sessions] Video saved: ${relativePath} | ${req.file.size} bytes`)

    // Push vào upload queue
    const absPath = path.join(ASSETS_ROOT, `outputs/${req.params.sessionId}/videos/${req.file.filename}`)
    enqueue(req.params.sessionId, absPath, req.file.filename, 'video')
    console.log(`[Sessions] Video enqueued for upload: ${req.file.filename}`)

    res.json({ success: true, data: { filePath: relativePath } })
  } catch (err) {
    console.error('[Sessions] video-upload error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ─── POST /sessions/:id/filter-photos — lưu ảnh đã filter ───────────────────
router.post('/:sessionId/filter-photos', async (req, res) => {
  try {
    const { imageData, photoId } = req.body
    const sessionId = req.params.sessionId
    const dir = path.join(ASSETS_ROOT, `outputs/${sessionId}/filters`)
    fs.mkdirSync(dir, { recursive: true })
    const filename = `filter-${photoId}-${Date.now()}.jpg`
    const filePath = path.join(dir, filename)
    const b64 = imageData.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
    const relativePath = `assets/outputs/${sessionId}/filters/${filename}`
    console.log(`[Sessions] Filter photo saved: ${relativePath}`)

    // Push vào upload queue
    enqueue(sessionId, filePath, filename, 'filter')
    console.log(`[Sessions] Filter enqueued for upload: ${filename}`)

    res.json({ success: true, data: { filePath: relativePath } })
  } catch (err) {
    console.error('[Sessions] filter-photos error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ─── POST /sessions/:id/folder-qr — tạo QR từ Drive folder URL ──────────────
router.post('/:sessionId/folder-qr', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ success: false, message: 'url required' })
    const qrDataURL = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M', width: 280, margin: 2,
    })
    res.json({ success: true, data: { qrDataURL } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ─── GET /sessions/:id/drive-status — lấy trạng thái upload Drive ─────────────
router.get('/:sessionId/drive-status', async (req, res) => {
  try {
    const sessionId = req.params.sessionId
    const queueStatus = getSessionStatus(sessionId)

    // Lấy thêm từ DB
    const session = await Session.findById(sessionId).select('driveStatus driveFolderUrl driveFolderName')

    res.json({
      success: true,
      data: {
        // Queue realtime
        pending:    queueStatus.pending,
        done:       queueStatus.done,
        failed:     queueStatus.failed,
        total:      queueStatus.total,
        allDone:    queueStatus.allDone,
        // Drive info
        folderUrl:  queueStatus.folderUrl || session?.driveFolderUrl || null,
        folderName: session?.driveFolderName || null,
        driveStatus: session?.driveStatus || 'idle',
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ─── GET /sessions — list (dashboard) ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { limit = 20, page = 1, status } = req.query
    const filter   = status ? { status } : {}
    const sessions = await Session.find(filter)
      .populate('themeId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
    const total = await Session.countDocuments(filter)
    res.json({ success: true, data: sessions, total, page: parseInt(page) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
