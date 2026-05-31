const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
  name:       { type: String, required: true },
  coverImage: { type: String, default: null },
  sortOrder:  { type: Number, default: 0 },
  active:     { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('Category', categorySchema)
