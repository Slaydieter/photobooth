const { createFolder, uploadFile, buildFolderName } = require('./googleDrive')
const path = require('path')
const fs   = require('fs')

const ASSETS_ROOT = path.join(__dirname, '../../assets')
const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5s giữa các lần retry

// ── Queue state ────────────────────────────────────────────────────────────
// item: { sessionId, type, localPath, remoteName, retries, status }
const queue   = []
let isRunning = false

// Cache folder IDs theo sessionId
const folderCache = {}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Push file vào upload queue
 * @param {string} sessionId
 * @param {string} localPath   - đường dẫn tuyệt đối file local
 * @param {string} remoteName  - tên file trên Drive
 * @param {string} type        - 'photo' | 'filter' | 'video'
 */
function enqueue(sessionId, localPath, remoteName, type = 'photo') {
  const item = { sessionId, localPath, remoteName, type, retries: 0, status: 'pending' }
  queue.push(item)
  console.log(`[Queue] Enqueued ${type}: ${remoteName} (queue size: ${queue.length})`)
  // Kick worker nếu chưa chạy
  if (!isRunning) processQueue()
}

/**
 * Lấy trạng thái upload của 1 session
 * @returns { pending, done, failed, total, allDone, folderUrl }
 */
function getSessionStatus(sessionId) {
  const items   = queue.filter(i => i.sessionId === sessionId)
  const pending = items.filter(i => i.status === 'pending' || i.status === 'uploading').length
  const done    = items.filter(i => i.status === 'done').length
  const failed  = items.filter(i => i.status === 'failed').length
  const total   = items.length
  const allDone = total > 0 && pending === 0
  const folderUrl = folderCache[sessionId]?.url || null
  return { pending, done, failed, total, allDone, folderUrl }
}

/**
 * Xóa items của session khỏi queue (dọn dẹp sau khi xong)
 */
function clearSession(sessionId) {
  const before = queue.length
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].sessionId === sessionId && queue[i].status === 'done') {
      queue.splice(i, 1)
    }
  }
  console.log(`[Queue] Cleared session ${sessionId}: ${before - queue.length} items removed`)
}

// ── Worker ─────────────────────────────────────────────────────────────────

async function processQueue() {
  if (isRunning) return
  isRunning = true
  console.log('[Queue] Worker started')

  while (true) {
    // Lấy item pending đầu tiên
    const item = queue.find(i => i.status === 'pending')
    if (!item) {
      isRunning = false
      console.log('[Queue] Worker idle — queue empty')
      break
    }

    item.status = 'uploading'
    console.log(`[Queue] Processing: ${item.type} ${item.remoteName} (attempt ${item.retries + 1}/${MAX_RETRIES})`)

    try {
      // Đảm bảo Drive folder tồn tại cho session này
      const folderId = await ensureSessionFolder(item.sessionId)
      if (!folderId) {
        throw new Error('Drive not configured or folder creation failed')
      }

      // Tạo subfolder theo type (photos/, filters/, videos/)
      const subFolderId = await ensureSubFolder(item.sessionId, item.type, folderId)

      // Upload file
      if (!fs.existsSync(item.localPath)) {
        throw new Error(`File not found: ${item.localPath}`)
      }

      const result = await uploadFile(item.localPath, item.remoteName, subFolderId)
      item.status   = 'done'
      item.driveLink = result.webViewLink
      console.log(`[Queue] ✅ Uploaded: ${item.remoteName} → ${result.webViewLink}`)

    } catch (err) {
      console.warn(`[Queue] ❌ Upload failed: ${item.remoteName} — ${err.message}`)
      item.retries++

      if (item.retries >= MAX_RETRIES) {
        item.status = 'failed'
        console.error(`[Queue] 💀 Giving up after ${MAX_RETRIES} attempts: ${item.remoteName}`)
      } else {
        item.status = 'pending'
        console.log(`[Queue] Will retry ${item.remoteName} in ${RETRY_DELAY / 1000}s (attempt ${item.retries + 1}/${MAX_RETRIES})`)
        await delay(RETRY_DELAY)
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function ensureSessionFolder(sessionId) {
  // Đã có trong cache
  if (folderCache[sessionId]?.id) return folderCache[sessionId].id

  try {
    const Settings = require('../models/Settings')
    const Session  = require('../models/Session')
    const Theme    = require('../models/Theme')

    const settings = await Settings.find({ key: { $in: ['drive_enabled', 'drive_parent_folder_id'] } })
    const sMap = Object.fromEntries(settings.map(s => [s.key, s.value]))

    if (sMap.drive_enabled === 'false') {
      console.log('[Queue] Drive disabled, skipping upload')
      return null
    }

    // Lấy tên theme để đặt tên folder
    const session = await Session.findById(sessionId).populate('themeId', 'name')
    const themeName = session?.themeId?.name || 'Session'
    const folderName = buildFolderName(themeName)

    const parentId = sMap.drive_parent_folder_id || null
    const folderId = await createFolder(folderName, parentId)

    // Lưu vào cache và DB
    folderCache[sessionId] = {
      id:   folderId,
      name: folderName,
      url:  `https://drive.google.com/drive/folders/${folderId}`,
    }

    await Session.findByIdAndUpdate(sessionId, {
      driveFolderId:   folderId,
      driveFolderName: folderName,
      driveFolderUrl:  folderCache[sessionId].url,
      driveStatus:     'uploading',
    })

    console.log(`[Queue] Created Drive folder: ${folderName} (${folderId})`)
    return folderId
  } catch (err) {
    console.error('[Queue] ensureSessionFolder error:', err.message)
    return null
  }
}

// Cache subfolder IDs: { sessionId_type: folderId }
const subFolderCache = {}

async function ensureSubFolder(sessionId, type, parentFolderId) {
  const cacheKey = `${sessionId}_${type}`
  if (subFolderCache[cacheKey]) return subFolderCache[cacheKey]

  const subFolderNames = { photo: 'photos', filter: 'filters', video: 'videos' }
  const name = subFolderNames[type] || type

  const subId = await createFolder(name, parentFolderId)
  subFolderCache[cacheKey] = subId
  console.log(`[Queue] Created subfolder: ${name} (${subId})`)
  return subId
}

// Cập nhật driveStatus của session khi tất cả items xong
async function checkAndFinalizeSession(sessionId) {
  const status = getSessionStatus(sessionId)
  if (!status.allDone) return

  try {
    const Session = require('../models/Session')
    await Session.findByIdAndUpdate(sessionId, {
      driveStatus: status.failed > 0 ? 'partial' : 'done',
    })
    console.log(`[Queue] Session ${sessionId} finalized: status=${status.failed > 0 ? 'partial' : 'done'}`)
    clearSession(sessionId)
  } catch (err) {
    console.error('[Queue] finalize error:', err.message)
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// Chạy checkAndFinalize định kỳ
setInterval(async () => {
  // Tìm các session có thể đã xong
  const sessionIds = [...new Set(queue.map(i => i.sessionId))]
  for (const sid of sessionIds) {
    await checkAndFinalizeSession(sid)
  }
}, 10000) // Check mỗi 10s

module.exports = { enqueue, getSessionStatus, clearSession }
