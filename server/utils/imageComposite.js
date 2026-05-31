const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

// Kích thước mặc định 5x20cm @ 300dpi
// 5cm  = 5/2.54 * 300 = ~591px
// 20cm = 20/2.54 * 300 = ~2362px
const DEFAULT_CONFIG = {
  widthCm:       5,
  heightCm:      20,
  dpi:           300,
  photosRatio:   0.80,  // 80% chiều cao cho ảnh
  thumbRatio:    0.20,  // 20% chiều cao cho thump
  padding:       8,     // padding px giữa các ảnh
  bgColor:       { r: 255, g: 255, b: 255, alpha: 1 },
}

function cmToPx(cm, dpi) {
  return Math.round((cm / 2.54) * dpi)
}

/**
 * Tạo ảnh strip
 * @param {string[]} photoPaths - mảng đường dẫn 4 ảnh đơn (absolute path)
 * @param {string|null} frontTemplatePath - đường dẫn frontTemplate (absolute)
 * @param {string} outputPath - đường dẫn file output (absolute)
 * @param {object} config - override DEFAULT_CONFIG
 */
async function createStrip(photoPaths, frontTemplatePath, outputPath, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const totalW = cmToPx(cfg.widthCm,  cfg.dpi)
  const totalH = cmToPx(cfg.heightCm, cfg.dpi)

  const photosAreaH = Math.round(totalH * cfg.photosRatio)
  const thumbAreaH  = Math.round(totalH * cfg.thumbRatio)

  const count      = photoPaths.length  // thường là 4
  const photoH     = Math.round((photosAreaH - cfg.padding * (count + 1)) / count)
  const photoW     = totalW - cfg.padding * 2

  // ── Tạo canvas nền trắng ─────────────────────────────────────────────────
  const composites = []

  // ── Resize và đặt từng ảnh đơn ───────────────────────────────────────────
  for (let i = 0; i < count; i++) {
    const srcPath = photoPaths[i]
    if (!srcPath || !fs.existsSync(srcPath)) continue

    const resized = await sharp(srcPath)
      .resize(photoW, photoH, { fit: 'cover', position: 'center' })
      .toBuffer()

    composites.push({
      input: resized,
      top:   cfg.padding + i * (photoH + cfg.padding),
      left:  cfg.padding,
    })
  }

  // ── Thump (frontTemplate) ở dưới ─────────────────────────────────────────
  if (frontTemplatePath && fs.existsSync(frontTemplatePath)) {
    const thumbBuf = await sharp(frontTemplatePath)
      .resize(totalW, thumbAreaH, { fit: 'cover', position: 'center' })
      .toBuffer()

    composites.push({
      input: thumbBuf,
      top:   photosAreaH,
      left:  0,
    })
  } else {
    // Fallback: vùng thump màu xám nhạt có text ngày
    const date    = new Date().toLocaleDateString('vi-VN')
    const svgText = `
      <svg width="${totalW}" height="${thumbAreaH}">
        <rect width="${totalW}" height="${thumbAreaH}" fill="#f5f5f5"/>
        <text x="${totalW/2}" y="${thumbAreaH/2 + 8}"
          font-family="Arial" font-size="32" fill="#888"
          text-anchor="middle">${date}</text>
      </svg>`
    composites.push({
      input: Buffer.from(svgText),
      top:   photosAreaH,
      left:  0,
    })
  }

  // ── Composite tất cả lên canvas trắng ────────────────────────────────────
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  await sharp({
    create: {
      width:      totalW,
      height:     totalH,
      channels:   3,
      background: cfg.bgColor,
    },
  })
    .composite(composites)
    .jpeg({ quality: 95 })
    .toFile(outputPath)

  return outputPath
}

/**
 * Parse settings từ DB thành config object
 */
function parseStripConfig(settings = {}) {
  return {
    widthCm:  parseFloat(settings.strip_width_cm)  || DEFAULT_CONFIG.widthCm,
    heightCm: parseFloat(settings.strip_height_cm) || DEFAULT_CONFIG.heightCm,
    dpi:      parseInt(settings.strip_dpi)         || DEFAULT_CONFIG.dpi,
  }
}

module.exports = { createStrip, parseStripConfig }
