const { app, BrowserWindow, ipcMain, dialog, Menu, webContents, components } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

// Config Management
function getConfigPath() {
  return path.join(app.getPath('userData'), 'trendcreate-config.json');
}

function loadConfig() {
  let config = {};
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) config = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { console.error("Failed to load config", e); }
  
  // Default theme properties
  if (!config.theme) {
    config.theme = {
      preset: 'dark', // 'dark', 'light', 'glass', etc.
      primaryColor: '#ffffff',
      bgColor: '#121212',
      bgImage: '',
      bgOverlayOpacity: 0.5,
      accentColor: '#007acc'
    };
  }
  return config;
}

function saveConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config), 'utf8');
  } catch (e) { console.error("Failed to save config", e); }
}

const appConfig = loadConfig();
if (appConfig.darkMode) {
    app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
}

// Password Management
function getPasswordsPath() {
  return path.join(app.getPath('userData'), 'trendcreate-passwords.json');
}

function loadPasswords() {
  try {
    const p = getPasswordsPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { console.error("Failed to load passwords", e); }
  return {};
}

function savePasswords(passwords) {
  try {
    fs.writeFileSync(getPasswordsPath(), JSON.stringify(passwords), 'utf8');
  } catch (e) { console.error("Failed to save passwords", e); }
}

let mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      const fileArg = commandLine.find(arg => arg.toLowerCase().endsWith('.html') || arg.toLowerCase().endsWith('.pdf'));
      if (fileArg && fs.existsSync(fileArg)) {
        mainWindow.webContents.send('open-external-file', fileArg);
      }
    }
  });
}

function createWindow() {
  let closeConfirmed = false;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff'
    },
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
      plugins: true
    }
  });

  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'delete', label: 'Delete' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Select All' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    const fileArg = process.argv.find(arg => arg.toLowerCase().endsWith('.html') || arg.toLowerCase().endsWith('.pdf'));
    if (fileArg && fs.existsSync(fileArg)) {
      mainWindow.webContents.send('open-external-file', fileArg);
    }
  });

  mainWindow.on('close', async (event) => {
    if (closeConfirmed) return;

    event.preventDefault();

    let hasUnsavedChanges = false;
    try {
      hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(
        'Boolean(window.__trendHasUnsavedChanges)',
        true
      );
    } catch {
      hasUnsavedChanges = false;
    }

    if (hasUnsavedChanges) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Close', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Unsaved Changes',
        message: 'There are unsaved changes. Do you want to close?',
        detail: 'Your unsaved changes will be lost if you close.'
      });

      if (result.response !== 0) return;
    }

    closeConfirmed = true;
    mainWindow.close();
  });

  function sendBrowserHistoryCommand(command) {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-history-command', command);
    }
  }

  function toggleHostDevTools() {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }

  function handleInputShortcut(event, input) {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F12') {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser-f12-command');
      }
      event.preventDefault();
      return;
    }

    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser-reload-command', input.shift);
      }
      event.preventDefault();
      return;
    }

    if (
      input.key === 'BrowserBack' ||
      input.key === 'MouseBack' ||
      (input.alt && input.key === 'ArrowLeft')
    ) {
      sendBrowserHistoryCommand('back');
      event.preventDefault();
      return;
    }

    if (
      input.key === 'BrowserForward' ||
      input.key === 'MouseForward' ||
      (input.alt && input.key === 'ArrowRight')
    ) {
      sendBrowserHistoryCommand('forward');
      event.preventDefault();
    }
  }

  mainWindow.webContents.on('before-input-event', handleInputShortcut);

  mainWindow.on('app-command', (event, command) => {
    if (command === 'browser-backward') {
      sendBrowserHistoryCommand('back');
      event.preventDefault();
    } else if (command === 'browser-forward') {
      sendBrowserHistoryCommand('forward');
      event.preventDefault();
    }
  });

  app.on('web-contents-created', (event, contents) => {
    contents.on('before-input-event', handleInputShortcut);
  });

  ipcMain.handle('get-config', () => loadConfig());
  ipcMain.handle('save-config', (event, config) => saveConfig(config));

  ipcMain.handle('get-passwords', (event, hostname) => {
    const passwords = loadPasswords();
    return passwords[hostname] || [];
  });

  ipcMain.on('prompt-save-password', async (event, data) => {
    const { hostname, username, password } = data;
    if (!hostname || !password) return;

    const passwords = loadPasswords();
    if (!passwords[hostname]) passwords[hostname] = [];
    
    // Check if already saved
    const existing = passwords[hostname].find(p => p.username === username && p.password === password);
    if (existing) return;

    const response = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['保存する', '保存しない'],
      title: 'パスワードの保存',
      message: `${hostname} のパスワードを保存しますか？\n(ID: ${username || 'なし'})`,
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      passwords[hostname] = passwords[hostname].filter(p => p.username !== username); // overwrite old if same username
      passwords[hostname].push({ username, password });
      savePasswords(passwords);
    }
  });

  ipcMain.handle('show-open-dialog', async () => {
    return dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
  });

  ipcMain.handle('read-dir', async (event, dirPath) => {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      return items.map((item) => ({
        name: item.name,
        isDirectory: item.isDirectory(),
        path: path.join(dirPath, item.name)
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  ipcMain.handle('get-license-text', async () => {
    const appLicensePath = path.join(__dirname, 'src', 'LICENSE.txt');
    const fallbackAppLicensePath = path.join(__dirname, 'LICENSE');
    const jsMediaLicensePath = path.join(__dirname, 'src', 'LICENSE-jsmediatags.txt');
    const monacoLicensePath = path.join(__dirname, 'src', 'LICENSE-monaco-editor.txt');
    
    let appLicense = 'App License not found.';
    if (fs.existsSync(appLicensePath)) {
        appLicense = fs.readFileSync(appLicensePath, 'utf-8');
    } else if (fs.existsSync(fallbackAppLicensePath)) {
        appLicense = fs.readFileSync(fallbackAppLicensePath, 'utf-8');
    }
    const jsMediaTagsLicense = fs.existsSync(jsMediaLicensePath) ? fs.readFileSync(jsMediaLicensePath, 'utf-8') : 'jsmediatags License not found.';
    const monacoLicense = fs.existsSync(monacoLicensePath) ? fs.readFileSync(monacoLicensePath, 'utf-8') : 'Monaco Editor License not found.';
    
    return { appLicense, jsMediaTagsLicense, monacoLicense };
  });

  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  });

  ipcMain.handle('show-save-dialog', async (event, options = {}) => {
    return dialog.showSaveDialog(mainWindow, {
      title: 'Save file',
      defaultPath: options.defaultPath || 'untitled.html',
      filters: [
        { name: 'Web files', extensions: ['html', 'css', 'js', 'json', 'md', 'txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
  });

  ipcMain.handle('show-message-box', async (event, options = {}) => {
    return dialog.showMessageBox(mainWindow, options);
  });

  ipcMain.handle('write-preview-file', async (event, content) => {
    try {
      const previewDir = path.join(os.tmpdir(), 'trendcreate-browser-preview');
      fs.mkdirSync(previewDir, { recursive: true });
      const previewPath = path.join(previewDir, 'preview.html');
      fs.writeFileSync(previewPath, content, 'utf-8');
      return previewPath;
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  previewServer = null;
  let previewServerPort = 0;
  let previewRoot = null;
  let currentPreviewContent = {};

  function resolveBareModules(code) {
    code = code.replace(/https?:\/\/(?:cdn\.jsdelivr\.net\/npm\/|unpkg\.com\/)([^'"]+)/gi, 'https://esm.sh/$1');
    return code
      .replace(/\b(import|export)\s+([^'"]+?)\s+from\s+["'](?![.\/]|https?:\/\/)([^'"]+)["']/g, '$1 $2 from "https://esm.sh/$3"')
      .replace(/\bimport\s+["'](?![.\/]|https?:\/\/)([^'"]+)["']/g, 'import "https://esm.sh/$1"')
      .replace(/\bimport\s*\(\s*["'](?![.\/]|https?:\/\/)([^'"]+)["']\s*\)/g, 'import("https://esm.sh/$1")');
  }

  ipcMain.handle('stop-live-server', async () => {
    if (previewServer) {
      previewServer.close();
      previewServer = null;
    }
    previewServerPort = 0;
    return true;
  });

  ipcMain.handle('toggle-host-devtools', () => {
    toggleHostDevTools();
  });

  ipcMain.handle('attach-devtools-to-tab', async (event, targetId, devtoolsId) => {
    const target = webContents.fromId(targetId);
    const devtools = webContents.fromId(devtoolsId);
    if (target && devtools) {
      target.setDevToolsWebContents(devtools);
      target.openDevTools();
      return true;
    }
    return false;
  });

  ipcMain.handle('open-webview-devtools', (event, targetId) => {
    const target = webContents.fromId(targetId);
    if (target) {
      target.openDevTools({ mode: 'detach' });
      return true;
    }
    return false;
  });

  ipcMain.handle('close-webview-devtools', (event, targetId) => {
    const target = webContents.fromId(targetId);
    if (target) {
      if (target.isDevToolsOpened()) target.closeDevTools();
      try {
        target.setDevToolsWebContents(null);
      } catch (e) {
        console.error("Failed to unset devtools webcontents:", e);
      }
      return true;
    }
    return false;
  });

  ipcMain.handle('start-live-server', async (event, dirPath, port = 0) => {
    if (previewServer) {
      previewServer.close();
      previewServer = null;
    }
    previewRoot = dirPath;
    currentPreviewContent = {};

    return new Promise((resolve) => {
      previewServer = http.createServer((req, res) => {
        let pathname = decodeURIComponent(req.url.split('?')[0]);
        if (pathname === '/') pathname = '/index.html';

        if (currentPreviewContent[pathname] !== undefined) {
          let content = currentPreviewContent[pathname];
          if (pathname.endsWith('.html') || pathname.endsWith('.js')) {
            content = resolveBareModules(content);
          }
          res.writeHead(200, { 'Content-Type': pathname.endsWith('.html') ? 'text/html' : (pathname.endsWith('.js') ? 'application/javascript' : 'text/plain') });
          res.end(content);
          return;
        }

        if (!previewRoot) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        const filePath = path.join(previewRoot, pathname);
        if (!filePath.startsWith(previewRoot)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          let contentType = 'application/octet-stream';
          if (filePath.endsWith('.html')) contentType = 'text/html';
          else if (filePath.endsWith('.js')) contentType = 'application/javascript';
          else if (filePath.endsWith('.css')) contentType = 'text/css';
          else if (filePath.endsWith('.json')) contentType = 'application/json';
          else if (filePath.endsWith('.png')) contentType = 'image/png';
          else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
          else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';

          res.writeHead(200, { 'Content-Type': contentType });

          if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
            let content = data.toString('utf-8');
            content = resolveBareModules(content);
            res.end(content);
          } else {
            res.end(data);
          }
        });
      });

      previewServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          previewServer = null;
          resolve(-1);
        } else {
          resolve(0);
        }
      });

      previewServer.listen(port, '127.0.0.1', () => {
        previewServerPort = previewServer.address().port;
        resolve(previewServerPort);
      });
    });
  });

  ipcMain.handle('update-live-preview-content', (event, pathname, content) => {
    currentPreviewContent[pathname] = content;
  });

  ipcMain.handle('show-context-menu', (event) => {
    const template = [
      { role: 'undo', label: 'Undo' },
      { role: 'redo', label: 'Redo' },
      { type: 'separator' },
      { role: 'cut', label: 'Cut' },
      { role: 'copy', label: 'Copy' },
      { role: 'paste', label: 'Paste' },
      { role: 'delete', label: 'Delete' },
      { type: 'separator' },
      { role: 'selectAll', label: 'Select All' }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  ipcMain.handle('show-unsaved-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Close without saving', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved Changes',
      message: 'There are unsaved changes in the IDE. Do you really want to close this tab?',
      detail: 'Your unsaved changes will be lost.'
    });
    return result.response;
  });

  ipcMain.on('show-file-context-menu', (event, targetPath, isDirectory) => {
    const template = [
      {
        label: '名前を変更',
        click: () => {
          event.sender.send('file-context-action', { action: 'rename', path: targetPath, isDirectory });
        }
      },
      {
        label: '削除',
        click: () => {
          event.sender.send('file-context-action', { action: 'delete', path: targetPath, isDirectory });
        }
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  ipcMain.handle('delete-file', async (event, targetPath) => {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['削除する', 'キャンセル'],
      defaultId: 1,
      cancelId: 1,
      title: '削除の確認',
      message: `本当に削除しますか？\n${targetPath}`
    });
    if (response.response === 0) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
        return true;
      } catch (e) {
        console.error("Delete failed", e);
      }
    }
    return false;
  });

  ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
    try {
      if (fs.existsSync(newPath)) return false; // Already exists
      fs.renameSync(oldPath, newPath);
      return true;
    } catch (e) {
      console.error("Rename failed", e);
      return false;
    }
  });

  ipcMain.handle('get-portfolio-projects', async (event, workspacePath) => {
    if (!workspacePath) {
      workspacePath = path.join(app.getPath('documents'), 'TRENDcreate_Projects');
    }
    
    // Ensure default workspace exists
    if (!fs.existsSync(workspacePath)) {
      try {
        fs.mkdirSync(workspacePath, { recursive: true });
      } catch (e) {
        return [];
      }
    }

    const projects = [];
    try {
      const items = fs.readdirSync(workspacePath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const projectPath = path.join(workspacePath, item.name);
          const indexPath = path.join(projectPath, 'index.html');
          
          let title = item.name;
          if (fs.existsSync(indexPath)) {
            try {
              const htmlContent = fs.readFileSync(indexPath, 'utf8');
              const titleMatch = htmlContent.match(/<title>([^<]*)<\/title>/i);
              if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim();
              }
            } catch (e) {
              console.error("Failed to read title for", projectPath, e);
            }
          }
          
          const stats = fs.statSync(projectPath);
          projects.push({
            name: item.name,
            title: title,
            path: projectPath,
            modifiedAt: stats.mtimeMs,
            type: 'directory'
          });
        } else if (item.isFile()) {
          const filePath = path.join(workspacePath, item.name);
          const stats = fs.statSync(filePath);
          projects.push({
            name: item.name,
            title: item.name,
            path: filePath,
            modifiedAt: stats.mtimeMs,
            type: 'file'
          });
        }
      }
    } catch (e) {
      console.error("Failed to read portfolio projects", e);
    }
    
    // Sort by most recently modified
    return projects.sort((a, b) => b.modifiedAt - a.modifiedAt);
  });

}

app.commandLine.appendSwitch('lang', 'en-US');
app.commandLine.appendSwitch('no-verify-widevine-cdm');

let widevineReady = false;
app.on('widevine-ready', (version, lastVersion) => {
  console.log(`Widevine ${version} is ready!`);
  widevineReady = true;
});

app.on('widevine-error', (error) => {
  console.error('Widevine installation encountered an error:', error);
});

app.whenReady().then(async () => {
  if (appConfig.darkMode) {
    const { nativeTheme } = require('electron');
    nativeTheme.themeSource = 'dark';
  }

  if (components) {
    await components.whenReady();
    console.log('Components ready:', components.status());
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
