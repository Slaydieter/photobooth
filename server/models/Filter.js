const mongoose = require('mongoose')

const filterSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  group:       { type: String, enum: ['tone', 'face'], required: true },
  // CSS filter string cho Overlay mode (toàn ảnh)
  cssFilter:   { type: String, default: '' },
  // Overlay color cho face group (rgba)
  overlayColor: { type: String, default: 'rgba(255,150,150,0.15)' },
  // Thông số cho MediaPipe face mode
  mediapipe: {
    type:      { type: String, enum: ['cheeks', 'lips', 'skin', 'none'], default: 'none' },
    color:     { type: String, default: 'rgba(255,100,100,0.3)' },
    intensity: { type: Number, default: 0.5 },
  },
  sortOrder: { type: Number, default: 0 },
  active:    { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('Filter', filterSchema)
