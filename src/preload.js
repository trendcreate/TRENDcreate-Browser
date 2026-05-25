const { ipcRenderer, contextBridge } = require('electron');

try {
    contextBridge.exposeInMainWorld('ipcRenderer', {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
        sendToHost: (channel, ...args) => ipcRenderer.sendToHost(channel, ...args)
    });
    const path = require('path');
    contextBridge.exposeInMainWorld('nodePath', {
        join: (...args) => path.join(...args),
        basename: (p) => path.basename(p),
        dirname: (p) => path.dirname(p)
    });
} catch (e) {
    window.ipcRenderer = ipcRenderer; // Fallback if context isolation is disabled
}

let savedCredentials = null;

// Intercept clicks to close suggestions in host
window.addEventListener('mousedown', () => {
    try {
        ipcRenderer.sendToHost('webview-mousedown');
    } catch (e) {}
});

// On load, fetch credentials for this domain
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const hostname = new URL(window.location.href).hostname;
        if (!hostname) return;
        
        savedCredentials = await ipcRenderer.invoke('get-passwords', hostname);
        
        if (savedCredentials && savedCredentials.length > 0) {
            // Very basic autofill: just try to find the first password input and a preceding text input
            const passInputs = document.querySelectorAll('input[type="password"]');
            if (passInputs.length > 0) {
                const passInput = passInputs[0];
                const form = passInput.closest('form');
                if (form) {
                    const textInputs = form.querySelectorAll('input[type="text"], input[type="email"]');
                    const textInput = textInputs.length > 0 ? textInputs[0] : null;
                    
                    if (textInput) textInput.value = savedCredentials[0].username;
                    passInput.value = savedCredentials[0].password;
                }
            }
        }
    } catch (e) {
        console.error("Autofill error:", e);
    }
});

// Intercept form submissions to save passwords
window.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    
    const passInputs = form.querySelectorAll('input[type="password"]');
    if (passInputs.length > 0) {
        const passInput = passInputs[0];
        const textInputs = form.querySelectorAll('input[type="text"], input[type="email"]');
        const textInput = textInputs.length > 0 ? textInputs[0] : null;
        
        const username = textInput ? textInput.value : '';
        const password = passInput.value;
        
        if (password) {
            const hostname = new URL(window.location.href).hostname;
            // Send to main process to prompt user
            ipcRenderer.send('prompt-save-password', {
                hostname,
                username,
                password
            });
        }
    }
}, true); // use capture to ensure we get it before preventDefault
