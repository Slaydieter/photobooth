const express = require('express')
const router  = express.Router()
const Settings = require('../../models/Settings')

// GET all settings
router.get('/', async (req, res) => {
  try {
    const rows = await Settings.find()
    const data = Object.fromEntries(rows.map(r => [r.key, r.value]))
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT update single
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    if (value === undefined) return res.status(400).json({ success: false, message: 'value required' })
    await Settings.findOneAndUpdate({ key }, { value: String(value) }, { upsert: true, new: true })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PUT bulk update
router.put('/', async (req, res) => {
  try {
    const updates = req.body
    const ops = Object.entries(updates).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { value: String(value) } },
        upsert: true,
      },
    }))
    await Settings.bulkWrite(ops)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
