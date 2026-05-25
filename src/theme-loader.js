(async function() {
    // ipcRenderer exists in electron environment
    if (!window.ipcRenderer) return;

    try {
        const config = await window.ipcRenderer.invoke('get-config');
        if (config && config.theme) {
            applyTheme(config.theme);
        }
    } catch (e) {
        console.error('Failed to load theme:', e);
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme.primaryColor) root.style.setProperty('--primary-color', theme.primaryColor);
        if (theme.bgColor) root.style.setProperty('--bg-color', theme.bgColor);
        if (theme.accentColor) root.style.setProperty('--accent-color', theme.accentColor);
        if (theme.bgOverlayOpacity !== undefined) {
            root.style.setProperty('--bg-overlay', `rgba(0, 0, 0, ${theme.bgOverlayOpacity})`);
        }
        
        // Background image
        const bgElement = document.getElementById('background');
        if (bgElement && theme.bgImage) {
            bgElement.style.backgroundImage = `url(${theme.bgImage})`;
            bgElement.classList.add('loaded');
        } else if (bgElement && !theme.bgImage) {
            bgElement.style.backgroundImage = 'none';
        }
    }

    // Expose for settings page to live-preview
    window.applyThemeVariables = applyTheme;
})();
