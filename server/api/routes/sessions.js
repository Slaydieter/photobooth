const express  = require('express')
const router   = express.Router()
const path     = require('path')
const fs       = require('fs')
const QRCode   = require('qrcode')
const { v4: uuidv4 } = require('uuid')

const Session  = require('../../models/Session')
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
    const frontTemplate = session.themeId?.frontTemplate
      ? path.join(ASSETS_ROOT, '..', session.themeId.frontTemplate)
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
      const stripPath     = path.join(stripDir, stripFilename)

      await createStrip(photoPaths, frontTemplate, stripPath, stripConfig)

      const stripRelative = `assets/outputs/${session._id}/${stripFilename}`
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
