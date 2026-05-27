(async function() {
    // Ensure ipcRenderer is available
    let ipcRenderer = window.ipcRenderer;
    if (!ipcRenderer && typeof require !== 'undefined') {
        ipcRenderer = require('electron').ipcRenderer;
        window.ipcRenderer = ipcRenderer;
    }
    
    if (!ipcRenderer) {
        // We are likely in Capacitor/mobile. Load from localStorage
        let config = {};
        try {
            config = JSON.parse(localStorage.getItem('mobile-config') || '{}');
        } catch (e) {}

        if (config && config.theme && Object.keys(config.theme).length > 0) {
            applyTheme(config.theme);
        } else {
            applyTheme({ preset: 'aero' }); // Default fallback
        }
        
        window.applyThemeVariables = applyTheme;
        return;
    }

    try {
        const config = await window.ipcRenderer.invoke('get-config');
        if (config && config.theme) {
            applyTheme(config.theme);
        }
        if (config && config.verticalTabs) {
            document.documentElement.classList.add('vertical-tabs');
        } else {
            document.documentElement.classList.remove('vertical-tabs');
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
        
        // Preset class for specific theme CSS (like .theme-aero)
        Array.from(root.classList).forEach(c => {
            if (c.startsWith('theme-')) root.classList.remove(c);
        });
        if (theme.preset) {
            root.classList.add(`theme-${theme.preset}`);
        }
        
        // Background image
        const setBg = () => {
            const bgElement = document.getElementById('background');
            
            let finalBgImage = theme.bgImage;
            if (!finalBgImage) {
                const timestamp = Date.now();
                if (theme.preset === 'cyberpunk' || theme.preset === 'aero') {
                    finalBgImage = `https://picsum.photos/1920/1080?random=${timestamp}`;
                } else {
                    finalBgImage = `https://picsum.photos/1920/1080?grayscale&random=${timestamp}`;
                }
            }

            if (bgElement && finalBgImage) {
                if (bgElement.tagName === 'IMG') {
                    bgElement.src = finalBgImage;
                } else {
                    bgElement.style.backgroundImage = `url('${finalBgImage}')`;
                }
                bgElement.classList.add('loaded');
            } else if (bgElement) {
                if (bgElement.tagName === 'IMG') {
                    bgElement.src = '';
                } else {
                    bgElement.style.backgroundImage = 'none';
                }
                bgElement.classList.remove('loaded');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setBg);
        } else {
            setBg();
        }
    }

    // Expose for settings page to live-preview
    window.applyThemeVariables = applyTheme;
})();
