const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const Sticker = require('../../models/Sticker')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../assets/stickers')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})
const upload = multer({ storage })

// GET all active (kiosk)
router.get('/', async (req, res) => {
  try {
    const stickers = await Sticker.find({ active: true })
    res.json({ success: true, data: stickers })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET all (dashboard)
router.get('/all', async (req, res) => {
  try {
    const stickers = await Sticker.find()
    res.json({ success: true, data: stickers })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST create
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Image required' })
    const { name, detectZone, offsetX, offsetY, scale } = req.body
    const sticker = await Sticker.create({
      name,
      imagePath:   `assets/stickers/${req.file.filename}`,
      detectZone:  detectZone || 'free',
      offsetX:     parseFloat(offsetX)  || 0,
      offsetY:     parseFloat(offsetY)  || 0,
      scale:       parseFloat(scale)    || 1.0,
    })
    res.json({ success: true, data: sticker })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT update
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, detectZone, offsetX, offsetY, scale, active } = req.body
    const update = {
      name, detectZone,
      offsetX: parseFloat(offsetX) || 0,
      offsetY: parseFloat(offsetY) || 0,
      scale:   parseFloat(scale)   || 1.0,
      active:  active !== 'false',
    }
    if (req.file) update.imagePath = `assets/stickers/${req.file.filename}`
    const sticker = await Sticker.findByIdAndUpdate(req.params.id, update, { new: true })
    res.json({ success: true, data: sticker })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Sticker.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
