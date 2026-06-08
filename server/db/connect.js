const mongoose = require('mongoose')

let isConnected = false

async function connectDB() {
  if (isConnected) return

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    isConnected = true
    console.log('✅ MongoDB connected:', process.env.MONGODB_URI)

    // Seed data lần đầu
    await seedIfEmpty()
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message)
    process.exit(1)
  }
}

async function seedIfEmpty() {
  const Filter = require('../models/Filter')
  const Category = require('../models/Category')
  const Theme    = require('../models/Theme')
  const Sticker  = require('../models/Sticker')
  const Settings = require('../models/Settings')

  // Seed settings mặc định
  const settingsCount = await Settings.countDocuments()
  if (settingsCount === 0) {
    await Settings.insertMany([
      { key: 'idle_background',   value: 'assets/backgrounds/default.jpg' },
      { key: 'thankyou_duration', value: '10' },
      { key: 'bank_name',         value: 'Vietcombank' },
      { key: 'bank_account',      value: '1234567890' },
      { key: 'bank_account_name', value: 'NGUYEN VAN A' },
      { key: 'bank_bin',          value: '970436' },
      { key: 'countdown_seconds', value: '10' },
      { key: 'app_name',          value: 'PhotoBooth' },
    ])
    console.log('✅ Default settings seeded')
  }

  // Seed categories & themes
  const catCount = await Category.countDocuments()
  if (catCount === 0) {
    const kpop = await Category.create({
      name: 'K-Pop', sortOrder: 0,
    })
    const vintage = await Category.create({
      name: 'Vintage', sortOrder: 1,
    })

    await Theme.insertMany([
      { categoryId: kpop._id,    name: 'BTS',       pricePerCopy: 55000, sortOrder: 0 },
      { categoryId: kpop._id,    name: 'BLACKPINK', pricePerCopy: 55000, sortOrder: 1 },
      { categoryId: kpop._id,    name: 'TARA',      pricePerCopy: 50000, sortOrder: 2 },
      { categoryId: vintage._id, name: 'Film 90s',  pricePerCopy: 50000, sortOrder: 0 },
      { categoryId: vintage._id, name: 'Polaroid',  pricePerCopy: 50000, sortOrder: 1 },
    ])

    await Sticker.insertMany([
      { name: 'Mũ sinh nhật', imagePath: 'assets/stickers/hat_birthday.png', detectZone: 'forehead' },
      { name: 'Mũ cowboy',    imagePath: 'assets/stickers/hat_cowboy.png',   detectZone: 'forehead' },
      { name: 'Mặt cười',     imagePath: 'assets/stickers/smile.png',        detectZone: 'cheek_left' },
      { name: 'Trái tim',     imagePath: 'assets/stickers/heart.png',        detectZone: 'cheek_right' },
      { name: 'Kính mát',     imagePath: 'assets/stickers/glasses.png',      detectZone: 'nose' },
      { name: 'Râu',          imagePath: 'assets/stickers/mustache.png',     detectZone: 'nose' },
      { name: 'Vương miện',   imagePath: 'assets/stickers/crown.png',        detectZone: 'forehead' },
    ])

    console.log('✅ Categories, themes, stickers seeded')
  }

  // Seed filters
  const filterCount = await Filter.countDocuments()
  if (filterCount === 0) {
    await Filter.insertMany([
      // Tone group
      { name: 'Warm',      group: 'tone', sortOrder: 0,  cssFilter: 'sepia(0.3) saturate(1.3) brightness(1.05)', overlayColor: 'rgba(255,200,100,0.1)' },
      { name: 'Cool',      group: 'tone', sortOrder: 1,  cssFilter: 'hue-rotate(20deg) saturate(0.9) brightness(1.05)', overlayColor: 'rgba(100,150,255,0.1)' },
      { name: 'Vintage',   group: 'tone', sortOrder: 2,  cssFilter: 'sepia(0.5) contrast(0.9) brightness(0.95)', overlayColor: 'rgba(180,140,80,0.15)' },
      { name: 'Vivid',     group: 'tone', sortOrder: 3,  cssFilter: 'saturate(1.8) contrast(1.1)', overlayColor: 'rgba(255,100,100,0.05)' },
      { name: 'B&W',       group: 'tone', sortOrder: 4,  cssFilter: 'grayscale(1) contrast(1.1)', overlayColor: 'rgba(0,0,0,0)' },
      { name: 'Pink Soft', group: 'tone', sortOrder: 5,  cssFilter: 'saturate(0.8) brightness(1.1)', overlayColor: 'rgba(255,180,200,0.15)' },
      // Face group
      { name: 'Brighten',    group: 'face', sortOrder: 6,  cssFilter: 'brightness(1.15) contrast(0.95)', overlayColor: 'rgba(255,240,220,0.1)',  mediapipe: { type: 'skin',   color: 'rgba(255,240,220,0.2)', intensity: 0.4 } },
      { name: 'Smooth',      group: 'face', sortOrder: 7,  cssFilter: 'blur(0px) brightness(1.05)',      overlayColor: 'rgba(255,230,210,0.12)', mediapipe: { type: 'skin',   color: 'rgba(255,220,200,0.25)', intensity: 0.5 } },
      { name: 'Rosy Cheeks', group: 'face', sortOrder: 8,  cssFilter: 'saturate(1.1)',                   overlayColor: 'rgba(255,120,120,0.12)', mediapipe: { type: 'cheeks', color: 'rgba(255,100,120,0.35)', intensity: 0.6 } },
      { name: 'Red Lips',    group: 'face', sortOrder: 9,  cssFilter: 'saturate(1.2)',                   overlayColor: 'rgba(200,50,50,0.1)',    mediapipe: { type: 'lips',   color: 'rgba(200,30,30,0.5)',   intensity: 0.7 } },
    ])
    console.log('✅ Filters seeded')
  }
}


module.exports = connectDB
