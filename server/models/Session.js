const mongoose = require('mongoose')

const photoSchema = new mongoose.Schema({
  filePath:   { type: String, required: true },
  takeRound:  { type: Number, default: 1 },
  shotIndex:  { type: Number, default: 0 },
  driveLink:  { type: String, default: null },
}, { timestamps: true })

const outputSchema = new mongoose.Schema({
  copyIndex:    { type: Number, default: 0 },
  frontPath:    { type: String, default: null },
  backPath:     { type: String, default: null },
  driveLink:    { type: String, default: null },
  driveQRCode:  { type: String, default: null },
}, { timestamps: true })

const sessionSchema = new mongoose.Schema({
  themeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Theme', required: true },
  copyCount:  { type: Number, default: 1 },
  totalPrice: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'paid', 'capturing', 'reviewing', 'completed'],
    default: 'pending',
  },
  selectedStickers:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sticker' }],
  photos:            [photoSchema],
  outputs:           [outputSchema],
  driveFolderId:     { type: String, default: null },
  driveFolderName:   { type: String, default: null },
  completedAt:       { type: Date, default: null },
}, { timestamps: true })

module.exports = mongoose.model('Session', sessionSchema)
