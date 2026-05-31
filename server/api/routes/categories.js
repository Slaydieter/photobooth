const express  = require('express')
const router   = express.Router()
const multer   = require('multer')
const path     = require('path')
const fs       = require('fs')
const Category = require('../../models/Category')
const Theme    = require('../../models/Theme')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../assets/categories')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})
const upload = multer({ storage })

// GET all categories (with theme count)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ active: true }).sort('sortOrder')
    const result = await Promise.all(categories.map(async (cat) => {
      const themeCount = await Theme.countDocuments({ categoryId: cat._id, active: true })
      return { ...cat.toObject(), themeCount }
    }))
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET all including inactive (dashboard)
router.get('/all', async (req, res) => {
  try {
    const categories = await Category.find().sort('sortOrder')
    const result = await Promise.all(categories.map(async (cat) => {
      const themeCount = await Theme.countDocuments({ categoryId: cat._id })
      return { ...cat.toObject(), themeCount }
    }))
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST create
router.post('/', upload.single('coverImage'), async (req, res) => {
  try {
    const { name, sortOrder } = req.body
    const coverImage = req.file ? `assets/categories/${req.file.filename}` : null
    const cat = await Category.create({ name, coverImage, sortOrder: sortOrder || 0 })
    res.json({ success: true, data: cat })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT update
router.put('/:id', upload.single('coverImage'), async (req, res) => {
  try {
    const { name, sortOrder, active } = req.body
    const update = { name, sortOrder, active: active !== 'false' }
    if (req.file) update.coverImage = `assets/categories/${req.file.filename}`
    const cat = await Category.findByIdAndUpdate(req.params.id, update, { new: true })
    res.json({ success: true, data: cat })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { active: false })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
