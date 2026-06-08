const express = require('express')
const router  = express.Router()
const Filter  = require('../../models/Filter')

// GET all active (kiosk)
router.get('/', async (req, res) => {
  try {
    const filters = await Filter.find({ active: true }).sort('sortOrder')
    res.json({ success: true, data: filters })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET all (dashboard)
router.get('/all', async (req, res) => {
  try {
    const filters = await Filter.find().sort('sortOrder')
    res.json({ success: true, data: filters })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST create
router.post('/', async (req, res) => {
  try {
    const filter = await Filter.create(req.body)
    res.json({ success: true, data: filter })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const filter = await Filter.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json({ success: true, data: filter })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Filter.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
