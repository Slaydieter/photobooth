const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

let driveClient = null

function getDriveClient() {
  if (driveClient) return driveClient

  const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
  if (!credPath || !fs.existsSync(credPath)) {
    throw new Error('Google Drive credentials not configured')
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  driveClient = google.drive({ version: 'v3', auth })
  return driveClient
}

// Tạo folder trên Drive, trả về folderId
async function createFolder(name, parentFolderId) {
  const drive = getDriveClient()
  const meta = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentFolderId) meta.parents = [parentFolderId]

  const res = await drive.files.create({
    requestBody: meta,
    fields: 'id',
  })
  return res.data.id
}

// Upload file lên Drive, trả về { fileId, webViewLink }
async function uploadFile(filePath, fileName, folderId, mimeType = 'image/jpeg') {
  const drive = getDriveClient()

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : [],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: 'id, webViewLink, webContentLink',
  })

  const fileId = res.data.id

  // Set public readable
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  // Lấy link sau khi set public
  const file = await drive.files.get({
    fileId,
    fields: 'webViewLink, webContentLink',
  })

  return {
    fileId,
    webViewLink:     file.data.webViewLink,
    webContentLink:  file.data.webContentLink,
  }
}

// Tạo tên folder theo format: ThemeName_HHhMM_DD-MM-YYYY
function buildFolderName(themeName) {
  const now  = new Date()
  const hh   = String(now.getHours()).padStart(2, '0')
  const mm   = String(now.getMinutes()).padStart(2, '0')
  const dd   = String(now.getDate()).padStart(2, '0')
  const mo   = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const safe = (themeName || 'Session').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
  return `${safe}_${hh}h${mm}_${dd}-${mo}-${yyyy}`
}

module.exports = { createFolder, uploadFile, buildFolderName }
