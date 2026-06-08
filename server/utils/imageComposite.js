const sharp  = require('sharp')
const path   = require('path')
const fs     = require('fs')

const DEFAULT_CONFIG = {
  widthCm:   5,
  heightCm:  20,
  dpi:       300,
  padding:   0,
  bgColor:   { r: 255, g: 255, b: 255, alpha: 1 },
}

function cmToPx(cm, dpi) {
  return Math.round((cm / 2.54) * dpi)
}

/**
 * Auto-detect vùng transparent trong template PNG
 * Trả về mảng { x, y, w, h } của từng vùng trong suốt lớn nhất
 * Dùng thuật toán: scan từng pixel, group các vùng alpha=0 liên tiếp
 */
async function detectTransparentZones(templatePath, canvasW, canvasH, expectedCount) {
  // Resize template về đúng kích thước canvas để tọa độ chính xác
  const { data, info } = await sharp(templatePath)
    .resize(canvasW, canvasH, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  // channels phải là 4 (RGBA)

  // Tạo mask: pixel nào alpha < 128 → transparent
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    mask[i] = data[i * channels + 3] < 128 ? 1 : 0
  }

  // Connected component labeling (simplified flood fill)
  const labels  = new Int32Array(width * height).fill(-1)
  const regions = [] // { pixels: Set, minX, minY, maxX, maxY }
  let   labelCount = 0

  function floodFill(startIdx) {
    const region = { pixels: 0, minX: width, minY: height, maxX: 0, maxY: 0 }
    const stack  = [startIdx]
    while (stack.length) {
      const idx = stack.pop()
      if (idx < 0 || idx >= width * height) continue
      if (labels[idx] !== -1 || mask[idx] !== 1) continue
      labels[idx] = labelCount
      region.pixels++
      const x = idx % width
      const y = Math.floor(idx / width)
      if (x < region.minX) region.minX = x
      if (x > region.maxX) region.maxX = x
      if (y < region.minY) region.minY = y
      if (y > region.maxY) region.maxY = y
      // 4-directional
      if (x > 0)         stack.push(idx - 1)
      if (x < width - 1) stack.push(idx + 1)
      if (y > 0)         stack.push(idx - width)
      if (y < height - 1)stack.push(idx + width)
    }
    return region
  }

  for (let i = 0; i < width * height; i++) {
    if (mask[i] === 1 && labels[i] === -1) {
      const region = floodFill(i)
      if (region.pixels > 500) { // bỏ qua vùng quá nhỏ
        regions.push(region)
        labelCount++
      }
    }
  }

  // Sắp xếp theo size giảm dần, lấy expectedCount vùng lớn nhất
  regions.sort((a, b) => b.pixels - a.pixels)
  const topRegions = regions.slice(0, expectedCount)

  // Sắp xếp theo vị trí từ trên xuống (y tăng dần)
  topRegions.sort((a, b) => a.minY - b.minY)

  // Scale lại về kích thước canvas thật
  const scaleX = canvasW / width
  const scaleY = canvasH / height

  return topRegions.map(r => ({
    x: Math.round(r.minX * scaleX),
    y: Math.round(r.minY * scaleY),
    w: Math.round((r.maxX - r.minX + 1) * scaleX),
    h: Math.round((r.maxY - r.minY + 1) * scaleY),
  }))
}

/**
 * Tạo ảnh strip
 * @param {string[]} photoPaths     - đường dẫn tuyệt đối các ảnh khách
 * @param {string|null} templatePath - PNG trong suốt đè lên trên
 * @param {string} outputPath       - file output
 * @param {object} config           - override DEFAULT_CONFIG
 */
async function createStrip(photoPaths, templatePath, outputPath, config = {}) {
  const cfg    = { ...DEFAULT_CONFIG, ...config }
  const totalW = cmToPx(cfg.widthCm,  cfg.dpi)
  const totalH = cmToPx(cfg.heightCm, cfg.dpi)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  // Nếu không có template → fallback: xếp ảnh dọc đơn giản
  if (!templatePath || !fs.existsSync(templatePath)) {
    return await createStripFallback(photoPaths, outputPath, totalW, totalH, cfg)
  }

  // ── Detect vùng transparent ───────────────────────────────────────────
  let zones = []
  try {
    zones = await detectTransparentZones(templatePath, totalW, totalH, photoPaths.length)
  } catch (err) {
    console.warn('Detect zones failed, using fallback:', err.message)
    return await createStripFallback(photoPaths, outputPath, totalW, totalH, cfg)
  }

  if (!zones.length) {
    return await createStripFallback(photoPaths, outputPath, totalW, totalH, cfg)
  }

  // ── Composite ảnh khách vào từng zone ────────────────────────────────
  const composites = []

  for (let i = 0; i < Math.min(photoPaths.length, zones.length); i++) {
    const zone = zones[i]
    const src  = photoPaths[i]
    if (!src || !fs.existsSync(src)) continue

    const resized = await sharp(src)
      .resize(zone.w, zone.h, { fit: 'cover', position: 'center' })
      .toBuffer()

    composites.push({ input: resized, top: zone.y, left: zone.x })
  }

  // ── Đè template lên trên cùng ─────────────────────────────────────────
  const templateBuf = await sharp(templatePath)
    .resize(totalW, totalH, { fit: 'fill' })
    .toBuffer()

  composites.push({ input: templateBuf, top: 0, left: 0 })

  // ── Render final ──────────────────────────────────────────────────────
  await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: cfg.bgColor },
  })
    .composite(composites)
    .jpeg({ quality: 95 })
    .toFile(outputPath)

  return outputPath
}

// Fallback: xếp ảnh đều nhau theo chiều dọc, không có template
async function createStripFallback(photoPaths, outputPath, totalW, totalH, cfg) {
  const count   = photoPaths.length
  const padding = cfg.padding || 8
  const photoH  = Math.round((totalH - padding * (count + 1)) / count)
  const photoW  = totalW - padding * 2
  const composites = []

  for (let i = 0; i < count; i++) {
    if (!photoPaths[i] || !fs.existsSync(photoPaths[i])) continue
    const buf = await sharp(photoPaths[i])
      .resize(photoW, photoH, { fit: 'cover', position: 'center' })
      .toBuffer()
    composites.push({ input: buf, top: padding + i * (photoH + padding), left: padding })
  }

  await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: cfg.bgColor },
  })
    .composite(composites)
    .jpeg({ quality: 95 })
    .toFile(outputPath)

  return outputPath
}

function parseStripConfig(settings = {}) {
  return {
    widthCm:  parseFloat(settings.strip_width_cm)  || DEFAULT_CONFIG.widthCm,
    heightCm: parseFloat(settings.strip_height_cm) || DEFAULT_CONFIG.heightCm,
    dpi:      parseInt(settings.strip_dpi)         || DEFAULT_CONFIG.dpi,
  }
}

module.exports = { createStrip, parseStripConfig }
