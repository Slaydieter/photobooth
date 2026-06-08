const mongoose = require('mongoose')

const themeSchema = new mongoose.Schema({
  categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name:          { type: String, required: true },
  coverImage:    { type: String, default: null },
  templateLayer:     { type: String, default: null },   // PNG đè lên ảnh khách
  placeholderColor:  { type: String, default: '#87CEEB' }, // màu ô ảnh trống để detect
  photoCount:    { type: Number, default: 4 },    // số ảnh mỗi tấm, config được
  pricePerCopy:  { type: Number, default: 50000 },
  sortOrder:     { type: Number, default: 0 },
  active:        { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('Theme', themeSchema)
