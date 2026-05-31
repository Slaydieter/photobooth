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
}

module.exports = connectDB
