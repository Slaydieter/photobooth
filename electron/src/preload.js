const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onMessage: (callback) => ipcRenderer.on('message', callback),
  sendMessage: (msg) => ipcRenderer.send('message', msg),
})
