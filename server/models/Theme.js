const mongoose = require('mongoose')

const themeSchema = new mongoose.Schema({
  categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name:          { type: String, required: true },
  coverImage:    { type: String, default: null },
  frontTemplate: { type: String, default: null }, // ảnh mặt trước mẫu
  backTemplate:  { type: String, default: null }, // ảnh mặt sau mẫu
  pricePerCopy:  { type: Number, default: 50000 },
  sortOrder:     { type: Number, default: 0 },
  active:        { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('Theme', themeSchema)
