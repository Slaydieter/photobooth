const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    frame: false,
    kiosk: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#0a0a0a',
  })

  // Load từ server local
  mainWindow.loadURL('http://localhost:3001/kiosk')

  // Dev tools: bỏ comment khi debug
  // mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

// Tắt context menu chuột phải trong kiosk mode
app.on('web-contents-created', (_, contents) => {
  contents.on('context-menu', (e) => e.preventDefault())
})
