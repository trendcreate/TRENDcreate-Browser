document.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = window;
    const backBtn = document.getElementById('back-btn');
    const languageSelect = document.getElementById('language-select');
    const licenseText = document.getElementById('license-text');
    const portInput = document.getElementById('live-port-input');
    const geminiKeyInput = document.getElementById('gemini-key-input');
    const aiModelSelect = document.getElementById('ai-model-select');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const verticalTabsToggle = document.getElementById('vertical-tabs-toggle');

    // Theme Elements
    const themeBgImage = document.getElementById('theme-bg-image');
    const themePrimaryColor = document.getElementById('theme-primary-color');
    const themeBgColor = document.getElementById('theme-bg-color');
    const themeAccentColor = document.getElementById('theme-accent-color');
    const themeOverlayOpacity = document.getElementById('theme-overlay-opacity');
    const themeCards = document.querySelectorAll('.theme-card');

    let currentConfig = {};

    // Tabs logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');
        });
    });

    // 戻るボタン
    backBtn.addEventListener('click', () => {
        window.location.href = 'home.html';
    });

    // ライセンス情報の読み込み
    try {
        ipcRenderer.invoke('get-license-text').then(licenses => {
            const combinedLicenseText = 
`==================================================
TRENDcreate Browser (MIT License)
==================================================

${licenses.appLicense}


==================================================
jsmediatags (BSD License)
==================================================

${licenses.jsMediaTagsLicense}


==================================================
Monaco Editor (MIT License)
==================================================

${licenses.monacoLicense}
`;
            licenseText.textContent = combinedLicenseText;
        }).catch(err => {
            licenseText.textContent = 'ライセンスファイルの読み込みに失敗しました。 / Failed to load license files.';
        });
    } catch (err) {
        licenseText.textContent = 'ライセンスファイルの読み込みに失敗しました。 / Failed to load license files.';
    }

    const savedLang = localStorage.getItem('appLang') || 'ja';
    languageSelect.value = savedLang;
    applyLanguage(savedLang);

    const savedPort = localStorage.getItem('liveServerPort') || '0';
    portInput.value = savedPort;

    languageSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        localStorage.setItem('appLang', lang);
        applyLanguage(lang);
    });

    // ポート番号の保存
    portInput.addEventListener('change', () => {
        const val = parseInt(portInput.value, 10);
        if (!isNaN(val) && val >= 0 && val <= 65535) {
            localStorage.setItem('trendcreate-live-port', val);
        } else {
            portInput.value = localStorage.getItem('trendcreate-live-port') || '0';
        }
    });

    function loadSettingsLocal() {
        // legacy local storage clear
        localStorage.removeItem('trendcreate-gemini-key');
        localStorage.removeItem('trendcreate-ai-model');
    }
    loadSettingsLocal();

    async function loadConfig() {
        currentConfig = await ipcRenderer.invoke('get-config');
        
        if (currentConfig.darkMode !== false) {
            darkModeToggle.checked = true;
        }
        if (currentConfig.verticalTabs !== undefined) {
            verticalTabsToggle.checked = currentConfig.verticalTabs;
        }
        if (currentConfig.apiKey) {
            geminiKeyInput.value = currentConfig.apiKey;
        }
        if (currentConfig.aiModel) {
            aiModelSelect.value = currentConfig.aiModel;
        }

        // Load Theme config
        if (currentConfig.theme) {
            const t = currentConfig.theme;
            themeBgImage.value = t.bgImage || '';
            themePrimaryColor.value = t.primaryColor || '#ffffff';
            themeBgColor.value = t.bgColor || '#121212';
            themeAccentColor.value = t.accentColor || '#007acc';
            themeOverlayOpacity.value = t.bgOverlayOpacity !== undefined ? t.bgOverlayOpacity : 0.5;

            themeCards.forEach(c => c.classList.remove('active'));
            const activeCard = document.querySelector(`.theme-card[data-preset="${t.preset}"]`);
            if (activeCard) activeCard.classList.add('active');
            
            if (window.applyThemeVariables) {
                window.applyThemeVariables(t);
            }
        }
    }

    async function saveAppConfig() {
        currentConfig.darkMode = darkModeToggle.checked;
        currentConfig.verticalTabs = verticalTabsToggle.checked;
        currentConfig.apiKey = geminiKeyInput.value.trim();
        currentConfig.aiModel = aiModelSelect.value;
        
        // Save Theme
        if (!currentConfig.theme) currentConfig.theme = {};
        currentConfig.theme.bgImage = themeBgImage.value;
        currentConfig.theme.primaryColor = themePrimaryColor.value;
        currentConfig.theme.bgColor = themeBgColor.value;
        currentConfig.theme.accentColor = themeAccentColor.value;
        currentConfig.theme.bgOverlayOpacity = parseFloat(themeOverlayOpacity.value);
        
        const activeCard = document.querySelector('.theme-card.active');
        if (activeCard) {
            currentConfig.theme.preset = activeCard.getAttribute('data-preset');
        }

        if (window.applyThemeVariables) {
            window.applyThemeVariables(currentConfig.theme);
        }

        await ipcRenderer.invoke('save-config', currentConfig);
    }

    if (darkModeToggle) darkModeToggle.addEventListener('change', saveAppConfig);
    if (verticalTabsToggle) verticalTabsToggle.addEventListener('change', saveAppConfig);
    if (geminiKeyInput) geminiKeyInput.addEventListener('input', saveAppConfig);
    if (aiModelSelect) aiModelSelect.addEventListener('change', saveAppConfig);

    // Theme Events
    [themeBgImage, themePrimaryColor, themeBgColor, themeAccentColor, themeOverlayOpacity].forEach(el => {
        el.addEventListener('input', saveAppConfig);
    });

    themeCards.forEach(card => {
        card.addEventListener('click', () => {
            themeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const preset = card.getAttribute('data-preset');
            if (preset === 'dark') {
                themeBgColor.value = '#121212';
                themePrimaryColor.value = '#ffffff';
                themeAccentColor.value = '#007acc';
                themeBgImage.value = '';
                themeOverlayOpacity.value = 0.5;
            } else if (preset === 'light') {
                themeBgColor.value = '#f0f0f0';
                themePrimaryColor.value = '#121212';
                themeAccentColor.value = '#007acc';
                themeBgImage.value = '';
                themeOverlayOpacity.value = 0;
            } else if (preset === 'glass') {
                themeBgColor.value = '#000000';
                themePrimaryColor.value = '#ffffff';
                themeAccentColor.value = '#e200ff';
                themeBgImage.value = 'https://picsum.photos/1920/1080?blur=2';
                themeOverlayOpacity.value = 0.3;
            } else if (preset === 'cyberpunk') {
                themeBgColor.value = '#000000';
                themePrimaryColor.value = '#00ff00';
                themeAccentColor.value = '#ff00ff';
                themeBgImage.value = '';
                themeOverlayOpacity.value = 0.8;
            } else if (preset === 'aero') {
                themeBgColor.value = '#000000';
                themePrimaryColor.value = '#ffffff';
                themeAccentColor.value = '#4096ff';
                themeBgImage.value = '';
                themeOverlayOpacity.value = 0.2;
            }
            saveAppConfig();
        });
    });

    loadConfig();

    function applyLanguage(lang) {
        const t = {
            ja: {
                settingsTitle: '設定',
                backBtn: '← 戻る',
                languageLabel: '言語設定 / Language',
                portLabel: 'Live Server ポート (0で自動)',
                aiKeyLabel: 'Gemini API キー (AI補完用)',
                aiModelLabel: 'AI モデル',
                licenseTitle: 'オープンソースライセンス'
            },
            en: {
                settingsTitle: 'Settings',
                backBtn: '← Back',
                languageLabel: 'Language',
                portLabel: 'Live Server Port (0 for auto)',
                aiKeyLabel: 'Gemini API Key (For AI Autocomplete)',
                aiModelLabel: 'AI Model',
                licenseTitle: 'Open Source Licenses'
            }
        }[lang];

        if (!t) return;

        document.getElementById('settings-title').textContent = t.settingsTitle;
        document.getElementById('back-btn').textContent = t.backBtn;
        document.getElementById('language-label').textContent = t.languageLabel;
        document.getElementById('port-label').textContent = t.portLabel;
        document.getElementById('ai-key-label').textContent = t.aiKeyLabel;
        document.getElementById('ai-model-label').textContent = t.aiModelLabel;
        document.getElementById('license-title').textContent = t.licenseTitle;
    }
});
