const mongoose = require('mongoose')

// detectZone xác định vùng face landmark để đặt sticker
// forehead | cheek_left | cheek_right | nose | chin | free
const stickerSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  imagePath:   { type: String, required: true },
  detectZone:  {
    type: String,
    enum: ['forehead', 'cheek_left', 'cheek_right', 'nose', 'chin', 'free'],
    default: 'free',
  },
  // offset % tính từ anchor point của landmark
  offsetX:  { type: Number, default: 0 },
  offsetY:  { type: Number, default: 0 },
  scale:    { type: Number, default: 1.0 },
  active:   { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('Sticker', stickerSchema)
