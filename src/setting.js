document.addEventListener('DOMContentLoaded', () => {
    const { ipcRenderer } = window;
    const backBtn = document.getElementById('back-btn');
    const languageSelect = document.getElementById('language-select');
    const licenseText = document.getElementById('license-text');
    const portInput = document.getElementById('live-port-input');
    const geminiKeyInput = document.getElementById('gemini-key-input');
    const aiModelSelect = document.getElementById('ai-model-select');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

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
        const config = await ipcRenderer.invoke('get-config');
        if (config.darkMode !== false) {
            darkModeToggle.checked = true;
        }
        if (config.apiKey) {
            geminiKeyInput.value = config.apiKey;
        }
        if (config.aiModel) {
            aiModelSelect.value = config.aiModel;
        }
    }

    async function saveAppConfig() {
        const config = await ipcRenderer.invoke('get-config');
        config.darkMode = darkModeToggle.checked;
        config.apiKey = geminiKeyInput.value.trim();
        config.aiModel = aiModelSelect.value;
        await ipcRenderer.invoke('save-config', config);
    }

    if (darkModeToggle) darkModeToggle.addEventListener('change', saveAppConfig);
    if (geminiKeyInput) geminiKeyInput.addEventListener('input', saveAppConfig);
    if (aiModelSelect) aiModelSelect.addEventListener('change', saveAppConfig);

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
