const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, webviewTag: true } });
  win.webContents.on('console-message', (e, level, msg, line, sourceId) => {
    console.log('[CONSOLE]', sourceId + ':' + line, msg);
  });
  win.loadFile('src/index.html');
  setTimeout(() => app.quit(), 2000);
});
