const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const Theme   = require('../../models/Theme')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../assets/themes')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const prefix = file.fieldname // 'coverImage' | 'frontTemplate' | 'backTemplate'
    cb(null, `${prefix}-${Date.now()}-${file.originalname}`)
  },
})
const upload = multer({ storage })
const fields = upload.fields([
  { name: 'coverImage',    maxCount: 1 },
  { name: 'templateLayer', maxCount: 1 },
])

// GET themes by category
router.get('/category/:categoryId', async (req, res) => {
  try {
    const themes = await Theme.find({
      categoryId: req.params.categoryId,
      active: true,
    }).sort('sortOrder')
    res.json({ success: true, data: themes })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET all (dashboard)
router.get('/', async (req, res) => {
  try {
    const themes = await Theme.find()
      .populate('categoryId', 'name')
      .sort('sortOrder')
    res.json({ success: true, data: themes })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET single
router.get('/:id', async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id).populate('categoryId', 'name')
    if (!theme) return res.status(404).json({ success: false, message: 'Not found' })
    res.json({ success: true, data: theme })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST create
router.post('/', fields, async (req, res) => {
  try {
    const { categoryId, name, pricePerCopy, sortOrder } = req.body
    const files = req.files || {}
    const theme = await Theme.create({
      categoryId,
      name,
      pricePerCopy:     pricePerCopy  || 50000,
      photoCount:       parseInt(req.body.photoCount) || 4,
      sortOrder:        sortOrder     || 0,
      placeholderColor: req.body.placeholderColor || '#87CEEB',
      coverImage:       files.coverImage    ? `assets/themes/${files.coverImage[0].filename}`    : null,
      templateLayer:    files.templateLayer ? `assets/themes/${files.templateLayer[0].filename}` : null,
    })
    res.json({ success: true, data: theme })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT update
router.put('/:id', fields, async (req, res) => {
  try {
    const { name, pricePerCopy, sortOrder, active, categoryId, photoCount } = req.body
    const update = { name, pricePerCopy, sortOrder, active: active !== 'false', categoryId, photoCount: parseInt(photoCount) || 4, placeholderColor: req.body.placeholderColor || '#87CEEB' }
    const files = req.files || {}
    if (files.coverImage)    update.coverImage    = `assets/themes/${files.coverImage[0].filename}`
    if (files.templateLayer) update.templateLayer = `assets/themes/${files.templateLayer[0].filename}`
    const theme = await Theme.findByIdAndUpdate(req.params.id, update, { new: true })
    res.json({ success: true, data: theme })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Theme.findByIdAndUpdate(req.params.id, { active: false })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
