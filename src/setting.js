document.addEventListener('DOMContentLoaded', () => {
    let { ipcRenderer } = window;
    
    // Polyfill for Capacitor/mobile environment
    if (!ipcRenderer) {
        ipcRenderer = {
            invoke: async (cmd, data) => {
                if (cmd === 'get-license-text') {
                    return { appLicense: 'MIT', jsMediaTagsLicense: 'BSD', monacoLicense: 'MIT' };
                }
                if (cmd === 'get-config') {
                    return JSON.parse(localStorage.getItem('mobile-config') || '{}');
                }
                if (cmd === 'save-config') {
                    localStorage.setItem('mobile-config', JSON.stringify(data || {}));
                    return true;
                }
                return {};
            }
        };
    }

    const backBtn = document.getElementById('back-btn');
    const languageSelect = document.getElementById('language-select');
    const licenseText = document.getElementById('license-text');
    const portInput = document.getElementById('live-port-input');
    const geminiKeyInput = document.getElementById('gemini-key-input');
    const aiModelSelect = document.getElementById('ai-model-select');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const verticalTabsToggle = document.getElementById('vertical-tabs-toggle');
    const alarmToggle = document.getElementById('alarm-toggle');
    const alarmTimeInput = document.getElementById('alarm-time-input');

    // Theme Elements
    const themeBgImage = document.getElementById('theme-bg-image');
    const themePrimaryColor = document.getElementById('theme-primary-color');
    const themeBgColor = document.getElementById('theme-bg-color');
    const themeAccentColor = document.getElementById('theme-accent-color');
    const themeOverlayOpacity = document.getElementById('theme-overlay-opacity');
    const themeCards = document.querySelectorAll('.theme-card');
    const customWidgetHtmlTextarea = document.getElementById('custom-widget-html');

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
    
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => {
            window.location.href = 'home.html';
        });
    }

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
        if (currentConfig.alarmEnabled !== undefined && alarmToggle) {
            alarmToggle.checked = currentConfig.alarmEnabled;
        }
        if (currentConfig.alarmTime && alarmTimeInput) {
            alarmTimeInput.value = currentConfig.alarmTime;
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
        if (alarmToggle) currentConfig.alarmEnabled = alarmToggle.checked;
        if (alarmTimeInput) currentConfig.alarmTime = alarmTimeInput.value;
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
    if (alarmToggle) alarmToggle.addEventListener('change', saveAppConfig);
    if (alarmTimeInput) alarmTimeInput.addEventListener('change', saveAppConfig);
    if (geminiKeyInput) geminiKeyInput.addEventListener('input', saveAppConfig);
    if (aiModelSelect) aiModelSelect.addEventListener('change', saveAppConfig);

    // Theme Events
    [themeBgImage, themePrimaryColor, themeBgColor, themeAccentColor, themeOverlayOpacity].forEach(el => {
        el.addEventListener('input', saveAppConfig);
    });

    if (customWidgetHtmlTextarea) {
        customWidgetHtmlTextarea.value = localStorage.getItem('customWidgetHtml') || '';
        customWidgetHtmlTextarea.addEventListener('input', () => {
            localStorage.setItem('customWidgetHtml', customWidgetHtmlTextarea.value);
        });
    }

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
            } else if (preset === 'aero-core') {
                themeBgColor.value = '#000000';
                themePrimaryColor.value = '#ffffff';
                themeAccentColor.value = '#00e5ff';
                themeBgImage.value = '';
                themeOverlayOpacity.value = 0.25;
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
                licenseTitle: 'オープンソースライセンス',
                uiLayoutTitle: 'UIレイアウト',
                verticalTabsLabel: 'Vertical Tabs (タブを縦に並べる)',
                alarmSettingsTitle: 'アラーム設定',
                alarmNotificationLabel: 'アラーム通知を有効にする',
                alarmTimeLabel: 'アラーム時刻',
                themePresetsTitle: 'テーマプリセット',
                customizationTitle: 'カスタマイズ',
                bgImageLabel: '背景画像URL',
                primaryTextColorLabel: 'メインテキスト色',
                bgColorLabel: '背景色',
                accentColorLabel: 'アクセント色',
                overlayOpacityLabel: 'オーバーレイ不透明度',
                customWidgetLabel: 'カスタムウィジェットHTML',
                systemAppearanceTitle: 'システム外観 (要再起動)',
                forceDarkModeLabel: 'WebContentsのダークモードを強制する',
                tabGeneralBtn: '一般',
                tabThemeBtn: 'テーマ',
                tabAiBtn: 'AI設定',
                tabLicenseBtn: 'ライセンス'
            },
            en: {
                settingsTitle: 'Settings',
                backBtn: '← Back',
                languageLabel: 'Language',
                portLabel: 'Live Server Port (0 for auto)',
                aiKeyLabel: 'Gemini API Key (For AI Autocomplete)',
                aiModelLabel: 'AI Model',
                licenseTitle: 'Open Source Licenses',
                uiLayoutTitle: 'UI Layout',
                verticalTabsLabel: 'Vertical Tabs',
                alarmSettingsTitle: 'Alarm Settings',
                alarmNotificationLabel: 'Enable Alarm Notification',
                alarmTimeLabel: 'Alarm Time',
                themePresetsTitle: 'Theme Presets',
                customizationTitle: 'Customization',
                bgImageLabel: 'Background Image URL',
                primaryTextColorLabel: 'Primary Text Color',
                bgColorLabel: 'Background Color',
                accentColorLabel: 'Accent Color',
                overlayOpacityLabel: 'Overlay Opacity',
                customWidgetLabel: 'Custom Widget HTML',
                systemAppearanceTitle: 'System Appearance (Restart Required)',
                forceDarkModeLabel: 'Force WebContents Dark Mode',
                tabGeneralBtn: 'General',
                tabThemeBtn: 'Theme',
                tabAiBtn: 'AI Config',
                tabLicenseBtn: 'Licenses'
            },
            ko: {
                settingsTitle: '설정',
                backBtn: '← 뒤로가기',
                languageLabel: '언어 설정',
                portLabel: 'Live Server 포트 (0: 자동)',
                aiKeyLabel: 'Gemini API 키 (AI 자동완성용)',
                aiModelLabel: 'AI 모델',
                licenseTitle: '오픈소스 라이선스',
                uiLayoutTitle: 'UI 레이아웃',
                verticalTabsLabel: '세로 탭 사용',
                alarmSettingsTitle: '알람 설정',
                alarmNotificationLabel: '알람 알림 켜기',
                alarmTimeLabel: '알람 시간',
                themePresetsTitle: '테마 프리셋',
                customizationTitle: '커스터마이징',
                bgImageLabel: '배경 이미지 URL',
                primaryTextColorLabel: '주요 텍스트 색상',
                bgColorLabel: '배경 색상',
                accentColorLabel: '강조 색상',
                overlayOpacityLabel: '오버레이 불투명도',
                customWidgetLabel: '사용자 지정 위젯 HTML',
                systemAppearanceTitle: '시스템 외관 (재시작 필요)',
                forceDarkModeLabel: 'WebContents 다크 모드 강제 적용',
                tabGeneralBtn: '일반',
                tabThemeBtn: '테마',
                tabAiBtn: 'AI 설정',
                tabLicenseBtn: '라이선스'
            },
            zh: {
                settingsTitle: '设置',
                backBtn: '← 返回',
                languageLabel: '语言设置',
                portLabel: 'Live Server 端口 (0为自动)',
                aiKeyLabel: 'Gemini API 密钥 (用于 AI 自动补全)',
                aiModelLabel: 'AI 模型',
                licenseTitle: '开源许可证',
                uiLayoutTitle: 'UI 布局',
                verticalTabsLabel: '垂直标签页',
                alarmSettingsTitle: '闹钟设置',
                alarmNotificationLabel: '启用闹钟通知',
                alarmTimeLabel: '闹钟时间',
                themePresetsTitle: '主题预设',
                customizationTitle: '自定义',
                bgImageLabel: '背景图片 URL',
                primaryTextColorLabel: '主要文本颜色',
                bgColorLabel: '背景颜色',
                accentColorLabel: '强调颜色',
                overlayOpacityLabel: '覆盖层不透明度',
                customWidgetLabel: '自定义小部件 HTML',
                systemAppearanceTitle: '系统外观 (需要重启)',
                forceDarkModeLabel: '强制 WebContents 处于深色模式',
                tabGeneralBtn: '常规',
                tabThemeBtn: '主题',
                tabAiBtn: 'AI 配置',
                tabLicenseBtn: '许可证'
            },
            ar: {
                settingsTitle: 'الإعدادات',
                backBtn: '← رجوع',
                languageLabel: 'إعدادات اللغة',
                portLabel: 'منفذ Live Server (0 للأساسي)',
                aiKeyLabel: 'مفتاح واجهة برمجة تطبيقات Gemini (لإكمال AI)',
                aiModelLabel: 'نموذج AI',
                licenseTitle: 'تراخيص مفتوحة المصدر',
                uiLayoutTitle: 'تخطيط واجهة المستخدم',
                verticalTabsLabel: 'علامات تبويب عمودية',
                alarmSettingsTitle: 'إعدادات المنبه',
                alarmNotificationLabel: 'تفعيل إشعار المنبه',
                alarmTimeLabel: 'وقت المنبه',
                themePresetsTitle: 'إعدادات السمة المسبقة',
                customizationTitle: 'التخصيص',
                bgImageLabel: 'عنوان URL لصورة الخلفية',
                primaryTextColorLabel: 'لون النص الأساسي',
                bgColorLabel: 'لون الخلفية',
                accentColorLabel: 'لون التمييز',
                overlayOpacityLabel: 'شفافية الغطاء',
                customWidgetLabel: 'أداة HTML مخصصة',
                systemAppearanceTitle: 'مظهر النظام (يتطلب إعادة تشغيل)',
                forceDarkModeLabel: 'فرض الوضع الداكن على WebContents',
                tabGeneralBtn: 'عام',
                tabThemeBtn: 'السمة',
                tabAiBtn: 'تكوين AI',
                tabLicenseBtn: 'التراخيص'
            }
        }[lang] || {
            // fallback to English if not found
            settingsTitle: 'Settings', backBtn: '← Back', languageLabel: 'Language',
            portLabel: 'Live Server Port (0 for auto)', aiKeyLabel: 'Gemini API Key',
            aiModelLabel: 'AI Model', licenseTitle: 'Open Source Licenses',
            uiLayoutTitle: 'UI Layout', verticalTabsLabel: 'Vertical Tabs',
            alarmSettingsTitle: 'Alarm Settings', alarmNotificationLabel: 'Enable Alarm Notification',
            alarmTimeLabel: 'Alarm Time', themePresetsTitle: 'Theme Presets',
            customizationTitle: 'Customization', bgImageLabel: 'Background Image URL',
            primaryTextColorLabel: 'Primary Text Color', bgColorLabel: 'Background Color',
            accentColorLabel: 'Accent Color', overlayOpacityLabel: 'Overlay Opacity',
            customWidgetLabel: 'Custom Widget HTML', systemAppearanceTitle: 'System Appearance (Restart Required)',
            forceDarkModeLabel: 'Force WebContents Dark Mode', tabGeneralBtn: 'General',
            tabThemeBtn: 'Theme', tabAiBtn: 'AI Config', tabLicenseBtn: 'Licenses'
        };

        if (!t) return;

        const updateText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        updateText('settings-title', t.settingsTitle);
        updateText('back-btn', t.backBtn);
        updateText('language-label', t.languageLabel);
        updateText('port-label', t.portLabel);
        updateText('ai-key-label', t.aiKeyLabel);
        updateText('ai-model-label', t.aiModelLabel);
        updateText('license-title', t.licenseTitle);
        updateText('ui-layout-title', t.uiLayoutTitle);
        updateText('vertical-tabs-label', t.verticalTabsLabel);
        updateText('alarm-settings-title', t.alarmSettingsTitle);
        updateText('alarm-notification-label', t.alarmNotificationLabel);
        updateText('alarm-time-label', t.alarmTimeLabel);
        updateText('theme-presets-title', t.themePresetsTitle);
        updateText('customization-title', t.customizationTitle);
        updateText('bg-image-label', t.bgImageLabel);
        updateText('primary-text-color-label', t.primaryTextColorLabel);
        updateText('bg-color-label', t.bgColorLabel);
        updateText('accent-color-label', t.accentColorLabel);
        updateText('overlay-opacity-label', t.overlayOpacityLabel);
        updateText('custom-widget-label', t.customWidgetLabel);
        updateText('system-appearance-title', t.systemAppearanceTitle);
        updateText('force-dark-mode-label', t.forceDarkModeLabel);
        updateText('tab-general-btn', t.tabGeneralBtn);
        updateText('tab-theme-btn', t.tabThemeBtn);
        updateText('tab-ai-btn', t.tabAiBtn);
        updateText('tab-license-btn', t.tabLicenseBtn);
    }
});
