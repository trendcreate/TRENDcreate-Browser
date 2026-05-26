document.addEventListener("DOMContentLoaded", () => {
    const { ipcRenderer } = window.nodeRequire("electron");
    const nodePath = window.nodeRequire("path");
    const { pathToFileURL } = window.nodeRequire("url");

    const tabsContainer = document.getElementById("tabs");
    const tabsWrapper = document.getElementById("tabs-container");
    const webviewsContainer = document.getElementById("webviews-container");
    const newTabBtn = document.getElementById("new-tab-btn");
    const portfolioBtn = document.getElementById("portfolio-btn");
    const ideToggleBtn = document.getElementById("ide-toggle-btn");
    const backBtn = document.getElementById("back-btn");
    const forwardBtn = document.getElementById("forward-btn");
    const reloadBtn = document.getElementById("reload-btn");
    const urlBar = document.getElementById("url-bar");
    const suggestionsBox = document.getElementById("suggestions-box");
    const historyBtn = document.getElementById("history-btn");
    const settingsBtn = document.getElementById("settings-btn");
    const idePanel = document.getElementById("ide-panel");
    const ideSplit = document.getElementById("ide-split");
    const sidebarResizer = document.getElementById("sidebar-resizer");
    const previewResizer = document.getElementById("preview-resizer");
    const openFolderBtn = document.getElementById("open-folder-btn");
    const previewFrame = document.getElementById("preview-frame");
    const previewContainer = document.getElementById("preview-container");
    const openExternalBtn = document.getElementById("open-external-btn");
    const togglePreviewBtn = document.getElementById("toggle-preview-btn");
    const ideViewToggle = document.getElementById("ide-view-toggle");
    const monacoEditorDiv = document.getElementById("monaco-editor");
    const newFileBtn = document.getElementById("new-file-btn");
    const saveFileBtn = document.getElementById("save-file-btn");
    const liveServerBtn = document.getElementById("live-server-btn");
    const devtoolsBtn = document.getElementById("devtools-btn");
    const ideDevtoolsBtn = document.getElementById("ide-devtools-btn");
    const projectRoot = document.getElementById("project-root");
    const fileTree = document.getElementById("file-tree");
    const activeFileLabel = document.getElementById("active-file-label");
    const saveStatus = document.getElementById("save-status");
    if (previewFrame) {
        previewFrame.setAttribute("preload", "file://" + nodePath.join(__dirname, "preload.js"));
    }
    const previewHeader = document.getElementById("preview-header");
    const fileTreeContainer = document.getElementById("file-tree-container");
    
    // Writing Mode Elements
    const novelPlotBtn = document.getElementById("novel-plot-btn");
    const novelSettingBtn = document.getElementById("novel-setting-btn");
    const writingModeBtn = document.getElementById("writing-mode-btn");
    const charCountLabel = document.getElementById("char-count");
    const aiAssistToggleBtn = document.getElementById("ai-assist-toggle-btn");
    const toggleWritingDirectionBtn = document.getElementById("toggle-writing-direction-btn");
    const novelVerticalEditor = document.getElementById("novel-vertical-editor");
    const toggleFocusModeBtn = document.getElementById("toggle-focus-mode-btn");

    const activityFilesBtn = document.getElementById("activity-files-btn");
    const activityConsoleBtn = document.getElementById("activity-console-btn");
    const ideSidebarConsole = document.getElementById("ide-sidebar-console");

    const HOME_URL = "home.html";

    window.isWritingMode = false;
    window.isAiAssistEnabled = true;
    const browserWindowId = Math.random().toString(36).substring(2);

    const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; }
  </style>
</head>
<body>
  <h1>Hello TRENDcreate IDE</h1>
  <p>Edit this file to update the live preview.</p>
</body>
</html>`;

    let tabs = [];
    let activeTabId = null;
    let tabCounter = 0;
    let ideTabId = null;
    let editor = null;
    let liveServerPort = null;
    let currentFilePath = null;
    let currentRootPath = null;
    let hasUnsavedChanges = false;
    let previewTimer = null;
    let previewVersion = 0;
    let suggestionTimer = null;
    let currentSuggestionIndex = -1;

    const monacoBase = new URL("../node_modules/monaco-editor/min/", window.location.href).href;
    window.MonacoEnvironment = {
        getWorkerUrl() {
            const workerUrl = new URL("vs/base/worker/workerMain.js", monacoBase).href;
            const code = `self.MonacoEnvironment={baseUrl:${JSON.stringify(monacoBase)}};importScripts(${JSON.stringify(workerUrl)});`;
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
        }
    };

    window.require.config({ paths: { vs: `${monacoBase}vs` } });
    window.require(["vs/editor/editor.main"], () => {
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            esModuleInterop: true,
            allowJs: true
        });

        // 簡易的なAutomatic Type Acquisition (ATA)
        async function fetchTypings(pkgName) {
            try {
                const res = await fetch(`https://esm.sh/${pkgName}`);
                const dtsUrl = res.headers.get("x-typescript-types");
                if (dtsUrl) {
                    const dtsRes = await fetch(dtsUrl);
                    const dtsContent = await dtsRes.text();
                    monaco.languages.typescript.javascriptDefaults.addExtraLib(
                        dtsContent,
                        `file:///node_modules/@types/${pkgName}/index.d.ts`
                    );
                    console.log(`[ATA] Loaded types for ${pkgName}`);
                }
            } catch (e) {
                console.warn(`[ATA] Failed for ${pkgName}`, e);
            }
        }

        // デフォルトでthreeの型を取得
        fetchTypings("three");

        // AIスピナー用ウィジェット
        const aiSpinnerWidget = {
            domNode: null,
            editorPosition: null,
            getId: function () { return 'ai.spinner.widget'; },
            getDomNode: function () {
                if (!this.domNode) {
                    this.domNode = document.createElement('div');
                    this.domNode.innerHTML = `<svg width="16" height="16" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#8ab4f8" stroke-width="4" stroke-dasharray="31.4 31.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" /></circle></svg>`;
                    this.domNode.style.paddingLeft = '4px';
                }
                return this.domNode;
            },
            getPosition: function () {
                if (!this.editorPosition) return null;
                return {
                    position: this.editorPosition,
                    preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
                };
            }
        };

        function showAiSpinner(position) {
            if (editor) {
                aiSpinnerWidget.editorPosition = position;
                editor.addContentWidget(aiSpinnerWidget);
            }
        }

        function hideAiSpinner() {
            if (editor) {
                editor.removeContentWidget(aiSpinnerWidget);
            }
        }

        // AIによるインライン補完 (Gemini)
        let aiDebounceTimer = null;
        monaco.languages.registerInlineCompletionsProvider('*', {
            provideInlineCompletions: async (model, position, context, token) => {
                const config = await ipcRenderer.invoke('get-config');
                const apiKey = config.apiKey;
                if (!apiKey) return { items: [] };

                const aiModel = config.aiModel || 'gemini-3.1-flash-lite';

                // ライティングモードでAIオフの場合は何もしない
                if (window.isWritingMode && !window.isAiAssistEnabled) {
                    return { items: [] };
                }

                // ユーザーが明示的にリクエストした場合のみ（自動補完を無効化）
                if (context.triggerKind === monaco.languages.InlineCompletionTriggerKind.Automatic) {
                    return { items: [] };
                }

                return new Promise((resolve) => {
                    if (aiDebounceTimer) clearTimeout(aiDebounceTimer);
                    aiDebounceTimer = setTimeout(async () => {
                        if (token.isCancellationRequested) {
                            return resolve({ items: [] });
                        }

                        const textUntilPosition = model.getValueInRange({
                            startLineNumber: 1,
                            startColumn: 1,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column
                        });
                        const textAfterPosition = model.getValueInRange({
                            startLineNumber: position.lineNumber,
                            startColumn: position.column,
                            endLineNumber: model.getLineCount(),
                            endColumn: model.getLineMaxColumn(model.getLineCount())
                        });

                        const prefix = textUntilPosition.slice(-1000); // 最後の1000文字
                        const suffix = textAfterPosition.slice(0, 500);  // 続く500文字

                        if (prefix.trim() === '') return resolve({ items: [] });

                        try {
                            showAiSpinner(position);
                            const prompt = `You are an AI code autocomplete engine. Please complete the code.
Provide ONLY the raw code that should be inserted exactly at the cursor position. 
DO NOT include markdown code blocks. DO NOT explain.
Prefix:
${prefix}
Suffix:
${suffix}`;

                            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }],
                                    generationConfig: {
                                        temperature: 0.2,
                                        maxOutputTokens: 128,
                                        stopSequences: ["\n\n", "```"]
                                    }
                                })
                            });
                            const data = await res.json();
                            hideAiSpinner();
                            if (data.candidates && data.candidates[0].content) {
                                let insertText = data.candidates[0].content.parts[0].text;
                                // Clean markdown code blocks if AI still outputs them
                                insertText = insertText.replace(/^```[a-z]*\n/, '').replace(/```$/, '').trimEnd();

                                resolve({
                                    items: [{
                                        insertText: insertText,
                                        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
                                    }]
                                });
                            } else {
                                resolve({ items: [] });
                            }
                        } catch (e) {
                            console.error("AI Completion error", e);
                            hideAiSpinner();
                            resolve({ items: [] });
                        }
                    }, 600); // 600ms debounce
                });
            },
            freeInlineCompletions: (completions) => { }
        });

        editor = monaco.editor.create(document.getElementById("monaco-editor"), {
            value: DEFAULT_HTML,
            language: "html",
            theme: "vs-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            tabSize: 2,
            wordWrap: "on"
        });

        monaco.languages.registerCompletionItemProvider('html', {
            provideCompletionItems: (model, position) => {
                return {
                    suggestions: [
                        {
                            label: 'html5',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: `<!DOCTYPE html>\n<html lang="ja">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>\${1:Document}</title>\n</head>\n<body>\n\t\${2}\n</body>\n</html>`,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'HTML5 Boilerplate'
                        },
                        {
                            label: 'div',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '<div>\n\t${1}\n</div>',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'div tag'
                        },
                        {
                            label: 'span',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '<span>${1}</span>',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'span tag'
                        },
                        {
                            label: 'a',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '<a href="${1:#}">${2}</a>',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'anchor tag'
                        },
                        {
                            label: 'script',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '<script src="${1}"></script>',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'script tag'
                        },
                        {
                            label: 'link',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: '<link rel="stylesheet" href="${1:style.css}">',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'link tag'
                        }
                    ]
                };
            }
        });

        let autoSaveTimer = null;
        editor.onDidChangeModelContent((e) => {
            hasUnsavedChanges = true;
            updateSaveStatus();
            schedulePreviewUpdate();

            // ライティングモード専用処理：文字数カウントとオートセーブ
            if (window.isWritingMode) {
                // 文字数カウント
                const text = editor.getValue();
                const charCount = text.replace(/\s/g, '').length;
                if (charCountLabel) charCountLabel.textContent = `文字数: ${charCount}`;

                // オートセーブ (1秒後)
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(() => {
                    if (currentFilePath && hasUnsavedChanges) {
                        fs.writeFile(currentFilePath, editor.getValue(), "utf-8", (err) => {
                            if (!err) {
                                hasUnsavedChanges = false;
                                updateSaveStatus();
                            }
                        });
                    }
                }, 1000);
            }

            // Auto-close HTML tags
            if (e.changes.length === 1 && e.changes[0].text === '>') {
                const position = editor.getPosition();
                if (position && getLanguage(currentFilePath) === "html") {
                    const line = editor.getModel().getLineContent(position.lineNumber);
                    const beforeCursor = line.substring(0, position.column - 1);
                    const match = beforeCursor.match(/<([a-zA-Z0-9\-]+)[^>]*>$/);
                    if (match) {
                        const tag = match[1].toLowerCase();
                        const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
                        if (!voidElements.includes(tag)) {
                            const insertText = `</${match[1]}>`;
                            editor.executeEdits('auto-close', [{
                                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                text: insertText
                            }]);
                            editor.setPosition(position);
                        }
                    }
                }
            }
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
            saveCurrentFile();
        });

        // VSCode standard shortcuts (Explicitly bind to ensure JIS keyboard / browser compatibility)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
            editor.trigger('keyboard', 'editor.action.commentLine', null);
        });
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyA, () => {
            editor.trigger('keyboard', 'editor.action.blockComment', null);
        });
        editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
            editor.trigger('keyboard', 'editor.action.moveLinesUpAction', null);
        });
        editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
            editor.trigger('keyboard', 'editor.action.moveLinesDownAction', null);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketRight, () => {
            editor.trigger('keyboard', 'editor.action.indentLines', null);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.BracketLeft, () => {
            editor.trigger('keyboard', 'editor.action.outdentLines', null);
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
            editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
        });

        const aiSuggestBtn = document.getElementById("ai-suggest-btn");
        if (aiSuggestBtn) {
            aiSuggestBtn.addEventListener("click", () => {
                if (editor) {
                    editor.focus();
                    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
                }
            });
        }

        const container = document.getElementById("monaco-editor");
        container.addEventListener('copy', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const text = editor.getModel().getValueInRange(editor.getSelection());
            window.nodeRequire('electron').clipboard.writeText(text);
        }, true);
        container.addEventListener('cut', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const selection = editor.getSelection();
            const text = editor.getModel().getValueInRange(selection);
            window.nodeRequire('electron').clipboard.writeText(text);
            editor.executeEdits("clipboard", [{ range: selection, text: "" }]);
        }, true);
        container.addEventListener('paste', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const text = window.nodeRequire('electron').clipboard.readText();
            editor.executeEdits("clipboard", [{ range: editor.getSelection(), text: text, forceMoveMarkers: true }]);
        }, true);

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
            const text = editor.getModel().getValueInRange(editor.getSelection());
            window.nodeRequire('electron').clipboard.writeText(text);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
            const selection = editor.getSelection();
            const text = editor.getModel().getValueInRange(selection);
            window.nodeRequire('electron').clipboard.writeText(text);
            editor.executeEdits("clipboard", [{ range: selection, text: "" }]);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
            const text = window.nodeRequire('electron').clipboard.readText();
            editor.executeEdits("clipboard", [{ range: editor.getSelection(), text: text, forceMoveMarkers: true }]);
        });

        updatePreview();
    });

    function createTab(url = HOME_URL) {
        tabCounter += 1;
        const tabId = `tab-${tabCounter}`;
        const tabEl = createTabElement(tabId, "読み込み中...");
        const titleEl = tabEl.querySelector(".tab-title");
        const closeBtn = tabEl.querySelector(".tab-close");

        const webviewEl = document.createElement("webview");
        webviewEl.id = `webview-${tabId}`;
        webviewEl.src = url;
        webviewEl.setAttribute("preload", "file://" + nodePath.join(__dirname, "preload.js"));
        webviewEl.setAttribute("allowpopups", "allowpopups");
        webviewEl.className = "webview-hidden";
        webviewsContainer.appendChild(webviewEl);

        const tabData = { type: "browser", id: tabId, tabEl, webviewEl, titleEl, currentUrl: url };
        tabs.push(tabData);

        tabEl.addEventListener("click", (event) => {
            if (event.target !== closeBtn) activateTab(tabId);
        });
        tabEl.addEventListener("auxclick", (event) => {
            if (event.button === 1) closeTab(tabId);
        });
        closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            closeTab(tabId);
        });

        webviewEl.addEventListener("did-start-loading", () => {
            titleEl.textContent = "Loading...";
        });
        webviewEl.addEventListener("did-stop-loading", () => {
            titleEl.textContent = webviewEl.getTitle() || "Untitled";
            updateNavState();
        });
        webviewEl.addEventListener("page-title-updated", (event) => {
            titleEl.textContent = event.title || "Untitled";
        });
        webviewEl.addEventListener("update-target-url", (event) => {
            const hoverOverlay = document.getElementById("link-hover-overlay");
            if (activeTabId === tabId && event.url) {
                hoverOverlay.textContent = event.url;
                hoverOverlay.classList.remove("hidden");
            } else if (activeTabId === tabId) {
                hoverOverlay.classList.add("hidden");
            }
        });
        webviewEl.addEventListener("did-navigate", (event) => {
            tabData.currentUrl = event.url;
            if (activeTabId === tabId) updateUrlBar(event.url);
            saveHistory(webviewEl.getTitle(), event.url);
            updateNavState();
        });
        webviewEl.addEventListener("did-navigate-in-page", (event) => {
            tabData.currentUrl = event.url;
            if (activeTabId === tabId) updateUrlBar(event.url);
            saveHistory(webviewEl.getTitle(), event.url);
            updateNavState();
        });
        webviewEl.addEventListener("dom-ready", () => {
            webviewEl.executeJavaScript(`
                window.addEventListener("mouseup", (event) => {
                    if (event.button === 3) {
                        event.preventDefault();
                        window.history.back();
                    } else if (event.button === 4) {
                        event.preventDefault();
                        window.history.forward();
                    }
                });
            `).catch(() => { });

            // Google検索結果のダークテーマ適用
            try {
                if (appConfig.darkMode !== false) { // Default to true if undefined or true
                    const currentUrl = webviewEl.getURL();
                    if (currentUrl.includes("google.com/search") || currentUrl.includes("google.co.jp/search") || currentUrl.includes("google.com/webhp") || currentUrl.includes("google.co.jp/webhp")) {
                        webviewEl.insertCSS(`
                            html, body { background-color: #202124 !important; color: #e8eaed !important; }
                            a { color: #8ab4f8 !important; }
                            cite, cite a:link, cite a:visited { color: #9aa0a6 !important; }
                            .g { background-color: transparent !important; }
                            .g .VwiC3b { color: #bdc1c6 !important; }
                            .Tz0hmf, .t20kyd { color: #bdc1c6 !important; }
                            .yuRUbf a h3 { color: #8ab4f8 !important; }
                            input[type="text"] { background-color: #303134 !important; color: #e8eaed !important; border-color: #5f6368 !important; }
                            .RNNXgb { background-color: #303134 !important; border: 1px solid #5f6368 !important; }
                            .sbtc, .sbsb_a { background-color: #303134 !important; }
                            .sbct:hover { background-color: #3c4043 !important; }
                            #appbar, #hdtb-msb, #hdtb-msb .hdtb-mitem a { background-color: #202124 !important; color: #e8eaed !important; }
                            .UUbT9 { background-color: #303134 !important; color: #e8eaed !important; }
                            .sfbg, .sfbgg { background-color: #202124 !important; }
                            .dod2v { background-color: #303134 !important; }
                            #cnt { background-color: transparent !important; }
                            .gb_Ia, .gb_Ja { color: #e8eaed !important; }
                        `).catch(() => { });
                    }
                }
            } catch (err) {
                console.error("Failed to inject dark theme CSS:", err);
            }
        });
        webviewEl.addEventListener("context-menu", (e) => {
            e.preventDefault();
            ipcRenderer.invoke("show-context-menu");
        });
        webviewEl.addEventListener("ipc-message", async (event) => {
            if (event.channel === "webview-mousedown") {
                suggestionsBox.classList.remove("visible");
            } else if (event.channel === "open-portfolio-project") {
                const projectPath = event.args[0];

                // Open IDE Tab
                createIdeTab();

                // Set the IDE workspace
                currentRootPath = projectPath;
                projectRoot.textContent = currentRootPath;
                fileTree.replaceChildren();
                await renderDirectory(currentRootPath, fileTree);
            } else if (event.channel === "open-portfolio-file") {
                const filePath = event.args[0];
                const parentPath = filePath.substring(0, Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')));

                // Open IDE Tab
                createIdeTab();

                // Set the IDE workspace
                currentRootPath = parentPath;
                projectRoot.textContent = currentRootPath;
                fileTree.replaceChildren();
                await renderDirectory(currentRootPath, fileTree);

                // Open the specific file in Monaco
                await loadFile(filePath);
            }
        });
        webviewEl.addEventListener("new-window", (event) => {
            event.preventDefault();
            createTab(event.url);
        });
        activateTab(tabId);
    }

    function createIdeTab() {
        if (ideTabId) {
            activateTab(ideTabId);
            return;
        }

        tabCounter += 1;
        const tabId = `tab-${tabCounter}`;
        ideTabId = tabId;
        const tabEl = createTabElement(tabId, "IDE");
        const titleEl = tabEl.querySelector(".tab-title");
        const closeBtn = tabEl.querySelector(".tab-close");
        tabs.push({ type: "ide", id: tabId, tabEl, webviewEl: null, titleEl, currentUrl: "trendcreate://ide" });

        tabEl.addEventListener("click", (event) => {
            if (event.target !== closeBtn) activateTab(tabId);
        });
        tabEl.addEventListener("auxclick", (event) => {
            if (event.button === 1) closeTab(tabId);
        });
        closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            closeTab(tabId);
        });
        activateTab(tabId);
    }

    function createTabElement(tabId, title) {
        const tabEl = document.createElement("div");
        tabEl.className = "tab";
        tabEl.dataset.id = tabId;

        const titleEl = document.createElement("span");
        titleEl.className = "tab-title";
        titleEl.textContent = title;

        const closeBtn = document.createElement("span");
        closeBtn.className = "tab-close";
        closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        tabEl.append(titleEl, closeBtn);
        tabsContainer.appendChild(tabEl);
        
        // --- Tab Tear-off (Drag & Drop) ---
        tabEl.draggable = true;
        tabEl.addEventListener("dragstart", (e) => {
            document.body.classList.add("dragging-tab");
            const tab = tabs.find(t => t.id === tabId);
            if (tab && tab.currentUrl) {
                const payload = JSON.stringify({
                    windowId: browserWindowId,
                    tabId: tabId,
                    url: tab.currentUrl
                });
                e.dataTransfer.setData("text/plain", "trendcreate-tab|" + payload);
                e.dataTransfer.effectAllowed = "move";
            }
        });
        tabEl.addEventListener("dragend", (e) => {
            document.body.classList.remove("dragging-tab");
            if (e.dataTransfer.dropEffect === "none") {
                const tab = tabs.find(t => t.id === tabId);
                if (tab && tab.currentUrl) {
                    ipcRenderer.send('tear-off-tab', { url: tab.currentUrl });
                    closeTab(tabId);
                }
            }
        });
        
        return tabEl;
    }

    function activateTab(tabId) {
        activeTabId = tabId;
        const activeTab = tabs.find((tab) => tab.id === tabId);
        const isIdeActive = activeTab && activeTab.type === "ide";

        tabs.forEach((tab) => {
            const isActive = tab.id === tabId;
            tab.tabEl.classList.toggle("active", isActive);
            if (tab.type === "browser" && tab.webviewEl) {
                tab.webviewEl.classList.toggle("webview-hidden", !isActive);
            }
        });

        idePanel.classList.toggle("ide-hidden", !isIdeActive);
        ideToggleBtn.classList.toggle("active", isIdeActive);

        if (isIdeActive) {
            urlBar.value = "";
            urlBar.placeholder = "TRENDcreate IDE";
            if (editor) setTimeout(() => editor.layout(), 0);
        } else if (activeTab) {
            updateUrlBar(activeTab.currentUrl);
        }
        
        const hoverOverlay = document.getElementById("link-hover-overlay");
        if (hoverOverlay) hoverOverlay.classList.add("hidden");
        
        updateNavState();
    }

    async function closeTab(tabId) {
        const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex === -1) return;

        const tab = tabs[tabIndex];
        if (tab.type === "ide" && !(await promptSaveUnsavedChanges())) return;

        tabs.splice(tabIndex, 1);
        tab.tabEl.remove();
        if (tab.webviewEl) tab.webviewEl.remove();
        if (tab.type === "ide") {
            ideTabId = null;
            idePanel.classList.add("ide-hidden");
            ideToggleBtn.classList.remove("active");
            hasUnsavedChanges = false;
            updateSaveStatus();
        }

        if (tabs.length === 0) {
            window.close();
        } else if (activeTabId === tabId) {
            activateTab(tabs[Math.min(tabIndex, tabs.length - 1)].id);
        }
    }

    function getActiveWebview() {
        const tab = tabs.find((item) => item.id === activeTabId);
        return tab && tab.type === "browser" ? tab.webviewEl : null;
    }

    function navigateBrowserHistory(direction) {
        const webview = getActiveWebview();
        if (!webview) return;

        if (direction === "back" && webview.canGoBack()) {
            webview.goBack();
        } else if (direction === "forward" && webview.canGoForward()) {
            webview.goForward();
        }
    }

    function updateUrlBar(url) {
        if (!url) return;
        if (url.includes("home.html")) {
            urlBar.value = "";
            urlBar.placeholder = "TRENDcreate Home";
        } else if (url.includes("history.html")) {
            urlBar.value = "";
            urlBar.placeholder = "履歴";
        } else if (url.includes("setting.html")) {
            urlBar.value = "";
            urlBar.placeholder = "設定";
        } else if (url.includes("portfolio.html")) {
            urlBar.value = "trendcreate://tcb/portfolio";
            urlBar.placeholder = "Local Projects Portfolio";
        } else {
            urlBar.value = url;
            urlBar.placeholder = "検索またはURLを入力";
        }
    }

    function updateNavState() {
        const webview = getActiveWebview();
        if (!webview) {
            backBtn.disabled = true;
            forwardBtn.disabled = true;
            return;
        }
        try {
            backBtn.disabled = !webview.canGoBack();
            forwardBtn.disabled = !webview.canGoForward();
        } catch {
            backBtn.disabled = true;
            forwardBtn.disabled = true;
        }
    }

    function saveHistory(title, url) {
        if (!url || url.startsWith("file://") || url.startsWith("devtools://")) return;
        const historyData = JSON.parse(localStorage.getItem("browserHistory") || "[]");
        if (historyData.length > 0 && historyData[0].url === url) return;
        historyData.unshift({ title: title || url, url, timestamp: Date.now() });
        localStorage.setItem("browserHistory", JSON.stringify(historyData.slice(0, 1000)));
    }

    function navigateTo(input, forceType) {
        if (!input) return;
        
        // Remove surrounding quotes if user copied as path
        input = input.replace(/^["']|["']$/g, '').trim();
        
        let finalUrl = input;
        
        // Check if it's a local absolute path (e.g., C:\...)
        const isLocalPath = /^[a-zA-Z]:[\\/]/.test(input) || input.startsWith('/');
        
        if (isLocalPath) {
            finalUrl = `file:///${input.replace(/\\/g, '/')}`;
        } else if (forceType === "search") {
            finalUrl = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
        } else if (forceType === "url") {
            finalUrl = /^https?:\/\//i.test(input) ? input : `http://${input}`;
        } else {
            const looksLikeUrl = /^https?:\/\//i.test(input) || (input.includes(".") && !input.includes(" "));
            if (!looksLikeUrl) finalUrl = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
            else if (!/^https?:\/\//i.test(input) && !/^file:\/\//i.test(input)) finalUrl = `http://${input}`;
        }

        // PDF判定
        const urlWithoutQuery = finalUrl.split('?')[0];
        if (urlWithoutQuery.toLowerCase().endsWith(".pdf")) {
            finalUrl = `file://${nodePath.join(__dirname, "pdf-viewer.html")}?file=${encodeURIComponent(finalUrl)}`;
        }

        const webview = getActiveWebview();
        if (webview) webview.loadURL(finalUrl);
        suggestionsBox.classList.remove("visible");
        urlBar.blur();
    }

    async function renderSuggestions(query) {
        currentSuggestionIndex = -1;
        suggestionsBox.replaceChildren();
        const isUrl = /^https?:\/\//i.test(query) || (query.includes(".") && !query.includes(" "));
        
        // Always offer both specific commands for the exact query
        if (isUrl) {
            addSuggestion("URL", `${query} - URLとして開く`, query, "url");
            addSuggestion("検索", `${query} - 検索として開く`, query, "search");
        } else {
            addSuggestion("検索", `${query} - 検索として開く`, query, "search");
            addSuggestion("URL", `${query} - URLとして開く`, query, "url");
        }

        if (!isUrl || query.length < 20) {
            try {
                const response = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                (data[1] || []).slice(0, 5).forEach((suggestion) => addSuggestion("検索", suggestion, suggestion, "search"));
            } catch (error) {
                console.error("Failed to fetch suggestions:", error);
            }
        }
        suggestionsBox.classList.add("visible");
    }

    function addSuggestion(icon, label, value, forceType) {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.innerHTML = `<span class="suggestion-icon"></span><span class="suggestion-text"></span>`;
        item.querySelector(".suggestion-icon").textContent = icon;
        item.querySelector(".suggestion-text").textContent = label;
        item.addEventListener("click", () => {
            urlBar.value = value;
            navigateTo(value, forceType);
        });
        suggestionsBox.appendChild(item);
    }

    function getFileName(filePath) {
        if (!filePath) return "Untitled";
        return nodePath.basename(filePath);
    }

    function getLanguage(filePath) {
        if (!filePath) return "html";
        const name = getFileName(filePath).toLowerCase();
        if (name.endsWith(".js") || name.endsWith(".mjs") || name.endsWith(".cjs")) return "javascript";
        if (name.endsWith(".css")) return "css";
        if (name.endsWith(".json")) return "json";
        if (name.endsWith(".md")) return "markdown";
        if (name.endsWith(".ts")) return "typescript";
        if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
        return "plaintext";
    }

    function setEditorValue(content, filePath) {
        if (!editor) return;
        currentFilePath = filePath;
        const oldModel = editor.getModel();
        editor.setModel(monaco.editor.createModel(content, getLanguage(filePath)));
        if (oldModel) oldModel.dispose();
        
        const novelVerticalEditor = document.getElementById("novel-vertical-editor");
        if (novelVerticalEditor) {
            novelVerticalEditor.value = content;
        }

        hasUnsavedChanges = false;
        activeFileLabel.textContent = getFileName(filePath);
        updateSaveStatus();
        updatePreview();
    }

    async function loadFile(filePath) {
        if (!(await promptSaveUnsavedChanges())) return;
        const content = await ipcRenderer.invoke("read-file", filePath);
        if (content === null) {
            updateSaveStatus("読み込み失敗");
            return;
        }
        setEditorValue(content, filePath);
    }

    function updateSaveStatus(message) {
        window.__trendHasUnsavedChanges = hasUnsavedChanges;
        activeFileLabel.classList.toggle("unsaved", hasUnsavedChanges);
        saveStatus.textContent = message || (hasUnsavedChanges ? "Unsaved" : "Saved");
    }

    async function promptSaveUnsavedChanges() {
        if (!hasUnsavedChanges) return true;
        const result = await ipcRenderer.invoke('show-message-box', {
            type: 'question',
            buttons: ['Save', "Don't Save", 'Cancel'],
            defaultId: 0,
            cancelId: 2,
            title: 'Unsaved Changes',
            message: 'You have unsaved changes. Do you want to save them before continuing?'
        });

        if (result.response === 0) {
            await saveCurrentFile();
            return !hasUnsavedChanges;
        } else if (result.response === 1) {
            hasUnsavedChanges = false;
            return true;
        } else {
            return false;
        }
    }

    function schedulePreviewUpdate() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, 800);
    }

    function resolveBareModules(code) {
        code = code.replace(/https?:\/\/(?:cdn\.jsdelivr\.net\/npm\/|unpkg\.com\/)([^'"]+)/gi, 'https://esm.sh/$1');
        return code
            .replace(/\b(import|export)\s+([^'"]+?)\s+from\s+["'](?![.\/]|https?:\/\/)([^'"]+)["']/g, '$1 $2 from "https://esm.sh/$3"')
            .replace(/\bimport\s+["'](?![.\/]|https?:\/\/)([^'"]+)["']/g, 'import "https://esm.sh/$1"')
            .replace(/\bimport\s*\(\s*["'](?![.\/]|https?:\/\/)([^'"]+)["']\s*\)/g, 'import("https://esm.sh/$1")');
    }

    async function updatePreview() {
        if (!editor) return;
        const version = ++previewVersion;
        const content = editor.getValue();
        const language = getLanguage(currentFilePath);
        let html = content;

        if (language === 'html') {
            ideViewToggle.classList.remove('hidden');
            if (togglePreviewBtn && togglePreviewBtn.textContent === "Preview: OFF") {
                togglePreviewBtn.click();
            }
        } else {
            ideViewToggle.classList.add('hidden');
            if (togglePreviewBtn && togglePreviewBtn.textContent === "Preview: ON") {
                togglePreviewBtn.click();
            }
        }

        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'];
        const ext = currentFilePath ? currentFilePath.split('.').pop().toLowerCase() : '';
        if (imageExts.includes(ext)) {
            ideViewToggle.classList.remove('hidden');
            if (togglePreviewBtn && togglePreviewBtn.textContent === "Preview: OFF") {
                togglePreviewBtn.click();
            }
            try {
                const { pathToFileURL } = window.nodeRequire("url");
                const fileUrl = pathToFileURL(currentFilePath).href;
                if (previewFrame.src !== fileUrl) {
                    previewFrame.src = fileUrl;
                }
            } catch (e) {
                console.error("Failed to load image preview", e);
            }
            return;
        }

        if (language === "css") {
            html = `<!DOCTYPE html><html><head>${getPreviewBaseTag()}<style>${content}</style></head><body><main><h1>CSS Preview</h1><p>Edit styles to update this preview.</p><button>Button</button></main></body></html>`;
        } else if (language === "javascript" || language === "typescript") {
            const resolved = resolveBareModules(content);
            html = `<!DOCTYPE html><html><head>${getPreviewBaseTag()}</head><body><div id="app"></div><script type="module">${resolved.replace(/<\/script>/gi, "<\\/script>")}<\/script></body></html>`;
        } else if (language === "html") {
            if (!(liveServerPort && currentRootPath && currentFilePath && currentFilePath.startsWith(currentRootPath))) {
                html = await preparePreviewHtml(html);
            }
        }

        if (version !== previewVersion) return;

        if (liveServerPort && currentRootPath && currentFilePath && currentFilePath.startsWith(currentRootPath)) {
            const relativePath = '/' + nodePath.relative(currentRootPath, currentFilePath).replace(/\\/g, '/');
            await ipcRenderer.invoke('update-live-preview-content', relativePath, html);

            const targetUrl = `http://127.0.0.1:${liveServerPort}${relativePath}`;
            if (previewFrame.src && previewFrame.src.split('?')[0] === targetUrl) {
                previewFrame.src = targetUrl + '?v=' + Date.now();
            } else {
                previewFrame.src = targetUrl;
            }
        } else {
            const previewPath = await ipcRenderer.invoke("write-preview-file", html);
            if (!previewPath || version !== previewVersion) return;
            const newSrc = pathToFileURL(previewPath).href;
            if (previewFrame.src && previewFrame.src.split('?')[0] === newSrc) {
                previewFrame.src = newSrc + '?v=' + Date.now();
            } else {
                previewFrame.src = newSrc;
            }
        }
    }

    function getPreviewBaseTag() {
        if (!currentFilePath) return "";
        const dirUrl = pathToFileURL(`${nodePath.dirname(currentFilePath)}${nodePath.sep}`).href;
        return `<base href="${dirUrl}">`;
    }

    async function replaceAsync(str, regex, asyncFn) {
        const promises = [];
        str.replace(regex, (match, ...args) => {
            promises.push(asyncFn(match, ...args));
        });
        const data = await Promise.all(promises);
        return str.replace(regex, () => data.shift());
    }

    async function preparePreviewHtml(html) {
        const baseTag = getPreviewBaseTag();
        let prepared = deferPreviewScripts(html);

        prepared = await replaceAsync(prepared, /(<script\b[^>]*>)([\s\S]*?)(<\/script>|$)/gi, async (match, open, scriptContent, close) => {
            if (open.toLowerCase().includes('src=')) {
                const srcMatch = open.match(/src=["']([^"']+)["']/i);
                if (srcMatch && srcMatch[1] && !srcMatch[1].startsWith('http') && currentFilePath) {
                    const dir = nodePath.dirname(currentFilePath);
                    const scriptPath = nodePath.join(dir, srcMatch[1]);
                    try {
                        const content = await ipcRenderer.invoke('read-file', scriptPath);
                        if (content !== null) {
                            const resolved = resolveBareModules(content);
                            const newOpen = open.replace(/\bsrc=["'][^"']+["']/i, '');
                            return newOpen + resolved + close;
                        }
                    } catch (e) { }
                }
                return match;
            }
            return open + resolveBareModules(scriptContent) + close;
        });

        if (!baseTag || /<base\s/i.test(prepared)) return prepared;
        if (/<head[^>]*>/i.test(prepared)) return prepared.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
        return `${baseTag}${prepared}`;
    }

    function deferPreviewScripts(html) {
        return html.replace(/<script\b([^>]*)\bsrc=(["'][^>]*["'])([^>]*)>/gi, (match, beforeSrc, src, afterSrc) => {
            const attrs = `${beforeSrc} src=${src}${afterSrc}`;
            if (/\b(defer|async)\b/i.test(attrs) || /\btype\s*=\s*["']module["']/i.test(attrs)) return match;
            return `<script${beforeSrc} src=${src}${afterSrc} defer>`;
        });
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function startColumnResize(resizer, onMove) {
        if (!resizer) return;
        resizer.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            resizer.classList.add("dragging");
            resizer.setPointerCapture(event.pointerId);
            const move = (moveEvent) => onMove(moveEvent);
            const stop = () => {
                resizer.classList.remove("dragging");
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", stop);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", stop);
        });
    }

    function setupColumnResizers() {
        startColumnResize(sidebarResizer, (event) => {
            const rect = idePanel.getBoundingClientRect();
            const maxWidth = Math.max(180, rect.width - 520);
            const width = clamp(event.clientX - rect.left - 48, 160, Math.min(420, maxWidth));
            idePanel.style.setProperty("--sidebar-width", `${width}px`);
            if (editor) editor.layout();
        });

        startColumnResize(previewResizer, (event) => {
            const rect = ideSplit.getBoundingClientRect();
            const maxWidth = Math.max(240, rect.width - 300);
            const width = clamp(rect.right - event.clientX, 240, maxWidth);
            idePanel.style.setProperty("--preview-width", `${width}px`);
            if (editor) editor.layout();
        });
    }

    async function renderDirectory(dirPath, container) {
        const items = await ipcRenderer.invoke("read-dir", dirPath);
        items
            .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
            .forEach((item) => {
                const button = document.createElement("button");
                button.className = "tree-item";
                button.type = "button";
                button.title = item.path;
                button.textContent = `${item.isDirectory ? "▸" : "•"} ${item.name}`;
                container.appendChild(button);

                button.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ipcRenderer.send("show-file-context-menu", item.path, item.isDirectory);
                });

                if (item.isDirectory) {
                    const children = document.createElement("div");
                    children.className = "tree-children";
                    children.hidden = true;
                    container.appendChild(children);
                    button.addEventListener("click", async () => {
                        const isOpening = children.hidden;
                        children.hidden = !isOpening;
                        button.textContent = `${isOpening ? "▾" : "▸"} ${item.name}`;
                        if (isOpening && children.childElementCount === 0) await renderDirectory(item.path, children);
                    });
                } else {
                    button.addEventListener("click", async () => {
                        if (!(await promptSaveUnsavedChanges())) return;

                        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'];
                        const ext = item.name.split('.').pop().toLowerCase();
                        
                        document.querySelectorAll(".tree-item.active").forEach((node) => node.classList.remove("active"));
                        button.classList.add("active");

                        if (imageExts.includes(ext)) {
                            setEditorValue(`<!-- Image: ${item.name} -->\n<!-- Binary files cannot be edited in Monaco. -->`, item.path);
                            return;
                        }

                        const content = await ipcRenderer.invoke("read-file", item.path);
                        if (content === null) {
                            updateSaveStatus("読み込み失敗");
                            return;
                        }
                        setEditorValue(content, item.path);
                    });
                }
            });
    }

    async function openFolder() {
        if (!(await promptSaveUnsavedChanges())) return;
        const result = await ipcRenderer.invoke("show-open-dialog");
        if (result.canceled || !result.filePaths.length) return;
        currentRootPath = result.filePaths[0];
        projectRoot.textContent = currentRootPath;
        fileTree.replaceChildren();
        await renderDirectory(currentRootPath, fileTree);
    }

    async function saveCurrentFile() {
        if (!editor) return;
        let targetPath = currentFilePath;
        if (!targetPath) {
            const result = await ipcRenderer.invoke("show-save-dialog", {
                defaultPath: currentRootPath ? `${currentRootPath}\\untitled.html` : "untitled.html"
            });
            if (result.canceled || !result.filePath) return;
            targetPath = result.filePath;
        }

        // Get content based on which editor is visible
        const verticalEditor = document.getElementById("novel-vertical-editor");
        let contentToSave = editor.getValue();
        if (verticalEditor && verticalEditor.style.display !== "none") {
            contentToSave = verticalEditor.value;
            editor.setValue(contentToSave); // Sync back to Monaco
        }

        const saved = await ipcRenderer.invoke("write-file", targetPath, contentToSave);
        if (!saved) {
            updateSaveStatus("保存失敗");
            return;
        }
        currentFilePath = targetPath;
        hasUnsavedChanges = false;
        activeFileLabel.textContent = getFileName(targetPath);
        monaco.editor.setModelLanguage(editor.getModel(), getLanguage(targetPath));
        updateSaveStatus();
        updatePreview();
        if (currentRootPath) {
            fileTree.replaceChildren();
            await renderDirectory(currentRootPath, fileTree);
        }
    }

    async function newFile() {
        if (!(await promptSaveUnsavedChanges())) return;
        setEditorValue(DEFAULT_HTML, null);
        hasUnsavedChanges = true;
        updateSaveStatus();
    }

    newTabBtn.addEventListener("click", () => createTab());
    newTabBtn.addEventListener("auxclick", (event) => {
        if (event.button === 1) createTab();
    });
    tabsContainer.addEventListener("auxclick", (event) => {
        if (event.button === 1 && event.target === tabsContainer) createTab();
    });
    window.addEventListener("mouseup", (event) => {
        if (event.button !== 3 && event.button !== 4) return;
        event.preventDefault();
        navigateBrowserHistory(event.button === 3 ? "back" : "forward");
    });
    ipcRenderer.on("browser-history-command", (event, direction) => {
        navigateBrowserHistory(direction);
    });

    togglePreviewBtn.addEventListener("click", () => {
        const previewResizer = document.getElementById("preview-resizer");
        if (togglePreviewBtn.textContent === "Preview: ON") {
            togglePreviewBtn.textContent = "Preview: OFF";
            togglePreviewBtn.classList.remove("active");
            previewContainer.style.display = "none";
            if (previewResizer) previewResizer.style.display = "none";
        } else {
            // プレビューONにする処理
            togglePreviewBtn.textContent = "Preview: ON";
            togglePreviewBtn.classList.add("active");
            previewContainer.style.display = "flex";
            if (previewResizer) previewResizer.style.display = "block";
            updatePreview();
        }
        if (editor) {
            setTimeout(() => editor.layout(), 10);
        }
    });



    portfolioBtn.addEventListener("click", () => createTab("portfolio.html"));
    ideToggleBtn.addEventListener("click", createIdeTab);
    backBtn.addEventListener("click", () => {
        const webview = getActiveWebview();
        if (webview && webview.canGoBack()) webview.goBack();
    });
    forwardBtn.addEventListener("click", () => {
        const webview = getActiveWebview();
        if (webview && webview.canGoForward()) webview.goForward();
    });
    reloadBtn.addEventListener("click", () => {
        const webview = getActiveWebview();
        if (webview) webview.reload();
    });

    ipcRenderer.on("browser-reload-command", (event, ignoreCache) => {
        const webview = getActiveWebview();
        if (webview) {
            if (ignoreCache) webview.reloadIgnoringCache();
            else webview.reload();
        }
    });
    function updateSuggestionSelection(items) {
        items.forEach((item, index) => {
            if (index === currentSuggestionIndex) {
                item.classList.add("selected");
                item.scrollIntoView({ block: "nearest" });
            } else {
                item.classList.remove("selected");
            }
        });
    }

    urlBar.addEventListener("keydown", (event) => {
        const isVisible = suggestionsBox.classList.contains("visible");
        const items = suggestionsBox.querySelectorAll(".suggestion-item");

        if (isVisible && items.length > 0) {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                currentSuggestionIndex = (currentSuggestionIndex + 1) % items.length;
                updateSuggestionSelection(items);
                return;
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                currentSuggestionIndex = (currentSuggestionIndex - 1 + items.length) % items.length;
                updateSuggestionSelection(items);
                return;
            } else if (event.key === "Enter" && currentSuggestionIndex >= 0) {
                event.preventDefault();
                items[currentSuggestionIndex].click();
                return;
            }
        }

        if (event.key === "Enter") {
            event.preventDefault();
            navigateTo(urlBar.value.trim());
        }
    });
    urlBar.addEventListener("input", (event) => {
        const query = event.target.value.trim();
        if (!query) {
            suggestionsBox.classList.remove("visible");
            return;
        }
        clearTimeout(suggestionTimer);
        suggestionTimer = setTimeout(() => renderSuggestions(query), 200);
    });
    document.addEventListener("mousedown", (event) => {
        if (event.target !== urlBar && !suggestionsBox.contains(event.target)) {
            suggestionsBox.classList.remove("visible");
        }
    });
    urlBar.addEventListener("focus", () => {
        if (urlBar.value.trim()) suggestionsBox.classList.add("visible");
    });
    urlBar.addEventListener("blur", () => {
        setTimeout(() => {
            suggestionsBox.classList.remove("visible");
        }, 150);
    });

    // Drag and Drop support for PDF files
    document.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.pdf')) {
                const pdfUrl = `file://${nodePath.join(__dirname, "pdf-viewer.html")}?file=${encodeURIComponent(file.path)}`;
                createTab(pdfUrl);
            } else if (file.name.toLowerCase().endsWith('.html')) {
                createTab("file://" + file.path);
            }
        }
    });

    ipcRenderer.on('open-external-file', (event, filePath) => {
        if (!filePath) return;
        if (filePath.toLowerCase().endsWith('.pdf')) {
            const pdfUrl = `file://${nodePath.join(__dirname, "pdf-viewer.html")}?file=${encodeURIComponent(filePath)}`;
            createTab(pdfUrl);
        } else {
            createTab(`file:///${filePath.replace(/\\/g, '/')}`);
        }
    });

    let currentRenamePath = null;
    let currentRenameIsDirectory = false;
    const renameModal = document.getElementById("rename-modal");
    const renameInput = document.getElementById("rename-input");
    const renameCancel = document.getElementById("rename-cancel");
    const renameConfirm = document.getElementById("rename-confirm");

    ipcRenderer.on("file-context-action", async (event, data) => {
        const { action, path, isDirectory } = data;
        if (action === "delete") {
            const success = await ipcRenderer.invoke("delete-file", path);
            if (success) {
                if (currentFilePath === path) {
                    currentFilePath = null;
                    activeFileLabel.textContent = "No File Opened";
                    setEditorValue(DEFAULT_HTML, null);
                }
                if (currentRootPath) {
                    fileTree.replaceChildren();
                    await renderDirectory(currentRootPath, fileTree);
                }
            }
        } else if (action === "rename") {
            currentRenamePath = path;
            currentRenameIsDirectory = isDirectory;
            renameInput.value = nodePath.basename(path);
            renameModal.classList.remove("hidden");
            renameInput.focus();
            renameInput.select();
        }
    });

    renameCancel.addEventListener("click", () => {
        renameModal.classList.add("hidden");
    });

    renameConfirm.addEventListener("click", async () => {
        if (!currentRenamePath) return;
        const newName = renameInput.value.trim();
        if (!newName || newName === nodePath.basename(currentRenamePath)) {
            renameModal.classList.add("hidden");
            return;
        }

        const newPath = nodePath.join(nodePath.dirname(currentRenamePath), newName);
        const success = await ipcRenderer.invoke("rename-file", currentRenamePath, newPath);

        if (success) {
            if (currentFilePath === currentRenamePath) {
                currentFilePath = newPath;
                activeFileLabel.textContent = getFileName(newPath);
            }
            if (currentRootPath) {
                fileTree.replaceChildren();
                await renderDirectory(currentRootPath, fileTree);
            }
        } else {
            updateSaveStatus("名前変更失敗");
        }
        renameModal.classList.add("hidden");
    });

    renameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renameConfirm.click();
        if (e.key === "Escape") renameCancel.click();
    });

    historyBtn.addEventListener("click", () => createTab("history.html"));
    settingsBtn.addEventListener("click", () => createTab("setting.html"));
    openFolderBtn.addEventListener("click", openFolder);
    newFileBtn.addEventListener("click", newFile);
    saveFileBtn.addEventListener("click", saveCurrentFile);

    liveServerBtn.addEventListener("click", async () => {
        if (liveServerPort) {
            await ipcRenderer.invoke("stop-live-server");
            liveServerPort = null;
            liveServerBtn.style.color = "";
            liveServerBtn.title = "Start Live Server";
            updatePreview();
        } else {
            if (!currentRootPath) {
                alert("Live Serverを起動するには、まずフォルダを開いてください。");
                return;
            }
            const customPort = parseInt(localStorage.getItem('liveServerPort')) || 0;
            const port = await ipcRenderer.invoke("start-live-server", currentRootPath, customPort);
            if (port === -1) {
                alert(`ポート ${customPort} は既に使用されています。設定から変更してください。`);
            } else {
                liveServerPort = port;
                liveServerBtn.style.color = "#4caf50";
                liveServerBtn.title = `Stop Live Server (Port: ${port})`;
                updatePreview();
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
    });

    async function openDevToolsForActiveTab() {
        try {
            const activeTab = tabs.find(t => t.id === activeTabId);
            const isIdeActive = activeTab && activeTab.type === "ide";

            if (isIdeActive) {
                const language = getLanguage(currentFilePath);
                if (language === "html" && previewFrame && previewFrame.src && previewFrame.src !== 'about:blank') {
                    const targetId = previewFrame.getWebContentsId();
                    if (targetId) {
                        await ipcRenderer.invoke('open-webview-devtools', targetId);
                        return;
                    }
                }
                ipcRenderer.invoke('toggle-host-devtools');
                return;
            }

            const targetWebview = getActiveWebview();
            if (targetWebview) {
                const targetId = targetWebview.getWebContentsId();
                if (targetId) {
                    await ipcRenderer.invoke('open-webview-devtools', targetId);
                    return;
                }
            }
            ipcRenderer.invoke('toggle-host-devtools');
        } catch (err) {
            console.error("Failed to open devtools:", err);
            ipcRenderer.invoke('toggle-host-devtools');
        }
    }

    if (devtoolsBtn) devtoolsBtn.addEventListener("click", openDevToolsForActiveTab);
    ipcRenderer.on("browser-f12-command", openDevToolsForActiveTab);

    // Activity Bar Logic
    if (activityFilesBtn && activityConsoleBtn) {
        activityFilesBtn.addEventListener("click", () => {
            activityFilesBtn.classList.add("active");
            activityConsoleBtn.classList.remove("active");
            fileTreeContainer.classList.remove("hidden-tab");
            ideSidebarConsole.classList.add("hidden-tab");
        });

        activityConsoleBtn.addEventListener("click", () => {
            activityConsoleBtn.classList.add("active");
            activityFilesBtn.classList.remove("active");
            ideSidebarConsole.classList.remove("hidden-tab");
            fileTreeContainer.classList.add("hidden-tab");
        });
    }

    previewHeader.addEventListener("dragstart", (e) => {
        if (!previewFrame.src || previewFrame.src === 'about:blank') {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData("text/plain", "preview-tab");
        e.dataTransfer.effectAllowed = "copyMove";
    });

    tabsWrapper.addEventListener("dragover", (e) => {
        if (e.dataTransfer.types.includes("text/plain")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        }
    });

    tabsWrapper.addEventListener("drop", (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData("text/plain");
        if (data === "preview-tab") {
            createTab(previewFrame.src);
            toggleIdeMode();
        }
    });

    if (previewFrame) {
        previewFrame.addEventListener("dom-ready", async () => {
            if (ideSidebarConsole) ideSidebarConsole.innerHTML = "";
        });

        previewFrame.addEventListener("console-message", (e) => {
            if (!ideSidebarConsole) return;
            let { level, message, line, sourceId } = e;

            // Electron Security Warnings or other internal messages can be filtered here
            if (typeof message === 'string') {
                message = message.replace(/%c/g, ''); // strip CSS formatting tokens
            }

            const msgEl = document.createElement("div");
            msgEl.className = "console-msg";

            let levelClass = "console-log";
            if (level === 2) levelClass = "console-warn";
            if (level === 3) levelClass = "console-error";

            msgEl.classList.add(levelClass);

            const textEl = document.createElement("div");
            textEl.textContent = message;

            const sourceEl = document.createElement("span");
            sourceEl.className = "console-source";
            const filename = sourceId ? sourceId.split('/').pop() : "unknown";
            sourceEl.textContent = `Line ${line} - ${filename}`;

            msgEl.appendChild(textEl);
            msgEl.appendChild(sourceEl);

            ideSidebarConsole.appendChild(msgEl);
            ideSidebarConsole.scrollTop = ideSidebarConsole.scrollHeight;
        });
    }

    window.__trendHasUnsavedChanges = false;
    setupColumnResizers();
    const urlParams = new URLSearchParams(window.location.search);
    const initialUrl = urlParams.get('url');
    if (initialUrl) {
        createTab(initialUrl);
    } else {
        createTab();
    }

    // ==========================================
    // Writing Mode (Focus Mode) Logic
    // ==========================================
    if (writingModeBtn) {
        writingModeBtn.addEventListener("click", () => {
            window.isWritingMode = !window.isWritingMode;
            if (window.isWritingMode) {
                writingModeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="color:var(--accent-color)"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                charCountLabel.style.display = "inline";
                aiAssistToggleBtn.style.display = "inline";
                if (toggleWritingDirectionBtn) toggleWritingDirectionBtn.style.display = "inline-block";
                if (toggleFocusModeBtn) toggleFocusModeBtn.style.display = "inline-block";
                
                // 初回文字数カウント
                if (editor) {
                    const text = editor.getValue();
                    charCountLabel.textContent = `文字数: ${text.replace(/\\s/g, '').length}`;
                }
            } else {
                document.body.classList.remove("focus-mode");
                if (toggleFocusModeBtn) {
                    toggleFocusModeBtn.textContent = "集中モード: OFF";
                    toggleFocusModeBtn.style.color = "";
                }
                writingModeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                charCountLabel.style.display = "none";
                aiAssistToggleBtn.style.display = "none";
                if (toggleWritingDirectionBtn) toggleWritingDirectionBtn.style.display = "none";
                if (toggleFocusModeBtn) toggleFocusModeBtn.style.display = "none";
                if (novelVerticalEditor) novelVerticalEditor.style.display = "none";
                const monacoContainer = document.getElementById("monaco-editor");
                if (monacoContainer) monacoContainer.style.display = "block";
                if (toggleWritingDirectionBtn) {
                    toggleWritingDirectionBtn.textContent = "横書き (標準)";
                    toggleWritingDirectionBtn.style.color = "";
                }
            }
            editor.layout();
        });
    }

    if (toggleFocusModeBtn) {
        toggleFocusModeBtn.addEventListener("click", () => {
            const isFocusMode = document.body.classList.toggle("focus-mode");
            if (isFocusMode) {
                toggleFocusModeBtn.textContent = "集中モード: ON";
                toggleFocusModeBtn.style.color = "var(--accent-color)";
            } else {
                toggleFocusModeBtn.textContent = "集中モード: OFF";
                toggleFocusModeBtn.style.color = "";
            }
            editor.layout();
        });
    }

    if (aiAssistToggleBtn) {
        aiAssistToggleBtn.addEventListener("click", () => {
            window.isAiAssistEnabled = !window.isAiAssistEnabled;
            if (window.isAiAssistEnabled) {
                aiAssistToggleBtn.textContent = "AI: ON";
                aiAssistToggleBtn.classList.remove("ai-off");
            } else {
                aiAssistToggleBtn.textContent = "AI: OFF";
                aiAssistToggleBtn.classList.add("ai-off");
            }
        });
    }

    // ==========================================
    // Novel Vertical Editor (Textarea)
    // ==========================================
    if (toggleWritingDirectionBtn && novelVerticalEditor) {
        toggleWritingDirectionBtn.addEventListener("click", () => {
            const monacoContainer = document.getElementById("monaco-editor");
            if (novelVerticalEditor.style.display === "none") {
                // Switch to Vertical Editor
                if (editor) {
                    novelVerticalEditor.value = editor.getValue();
                }
                monacoContainer.style.display = "none";
                novelVerticalEditor.style.display = "block";
                toggleWritingDirectionBtn.textContent = "縦書き (専用エディタ)";
                toggleWritingDirectionBtn.style.color = "var(--accent-color)";
                novelVerticalEditor.focus();
            } else {
                // Switch back to Monaco Editor
                if (editor) {
                    editor.setValue(novelVerticalEditor.value);
                }
                novelVerticalEditor.style.display = "none";
                monacoContainer.style.display = "block";
                toggleWritingDirectionBtn.textContent = "横書き (標準)";
                toggleWritingDirectionBtn.style.color = "";
                if (editor) {
                    editor.layout();
                    editor.focus();
                }
            }
        });
        
        // Sync back on input so character count / unsaved status works
        novelVerticalEditor.addEventListener("input", () => {
            if (editor && window.isWritingMode) {
                editor.setValue(novelVerticalEditor.value);
            }
        });
    }

    // フックして自動プレビュー更新
    const originalSchedulePreviewUpdate = window.schedulePreviewUpdate;
    window.schedulePreviewUpdate = function() {
        if (originalSchedulePreviewUpdate) originalSchedulePreviewUpdate();
    };

    // ==========================================
    // Novel Templates
    // ==========================================
    function createNovelTemplate(type) {
        if (!currentRootPath) {
            alert("Please open a folder first to create templates.");
            return;
        }

        const defaultName = type === 'plot' ? 'plot.md' : 'setting.md';
        
        // ファイル名の重複を避ける
        let fileName = defaultName;
        let counter = 1;
        while (fs.existsSync(nodePath.join(currentRootPath, fileName))) {
            fileName = type === 'plot' ? `plot_${counter}.md` : `setting_${counter}.md`;
            counter++;
        }

        const filePath = nodePath.join(currentRootPath, fileName);
        
        let content = "";
        if (type === 'plot') {
            content = `# プロット\n\n## タイトル\n[未設定]\n\n## キャッチコピー\n[未設定]\n\n## あらすじ\n起：\n承：\n転：\n結：\n\n## 登場人物一覧\n- [主人公の名前]\n- \n\n## 各話の構成\n1. \n2. \n`;
        } else {
            content = `# 世界観設定\n\n## 時代・場所\n- \n\n## 特殊なルール・魔法・技術\n- \n\n## 主要な組織・勢力\n- \n\n## 用語集\n- **用語1**: 説明\n- **用語2**: 説明\n`;
        }

        fs.writeFile(filePath, content, "utf-8", async (err) => {
            if (err) {
                alert("テンプレートの作成に失敗しました: " + err.message);
            } else {
                fileTree.replaceChildren();
                await renderDirectory(currentRootPath, fileTree);
                await loadFile(filePath);
            }
        });
    }

    if (novelPlotBtn) {
        novelPlotBtn.addEventListener("click", () => createNovelTemplate('plot'));
    }
    if (novelSettingBtn) {
        novelSettingBtn.addEventListener("click", () => createNovelTemplate('setting'));
    }

    window.addEventListener("contextmenu", (e) => {
        if (e.target.closest && e.target.closest('.monaco-editor')) return;
        e.preventDefault();
        ipcRenderer.invoke("show-context-menu");
    });

    ipcRenderer.on('open-new-tab', (event, url) => {
        createTab(url);
    });

    ipcRenderer.on('config-changed', (event, config) => {
        if (config.verticalTabs) {
            document.documentElement.classList.add('vertical-tabs');
        } else {
            document.documentElement.classList.remove('vertical-tabs');
        }
    });

    ipcRenderer.on('tab-moved-event', (event, data) => {
        if (data && data.windowId === browserWindowId) {
            closeTab(data.tabId);
        }
    });

    let documentDragCounter = 0;
    document.addEventListener("dragenter", (e) => {
        documentDragCounter++;
        document.body.classList.add("dragging-tab");
    });
    
    document.addEventListener("dragleave", (e) => {
        documentDragCounter--;
        if (documentDragCounter === 0) {
            document.body.classList.remove("dragging-tab");
        }
    });

    document.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    });

    document.addEventListener("drop", (e) => {
        documentDragCounter = 0;
        document.body.classList.remove("dragging-tab");
        e.preventDefault();
        
        const textData = e.dataTransfer.getData("text/plain");
        if (textData && textData.startsWith("trendcreate-tab|")) {
            const dataStr = textData.substring("trendcreate-tab|".length);
            try {
                const data = JSON.parse(dataStr);
                if (data.windowId !== browserWindowId) {
                    createTab(data.url);
                    ipcRenderer.send('tab-moved', data);
                }
            } catch (err) {
                console.error("Failed to parse dropped tab data", err);
            }
        }
    });

    // --- Alarm Monitoring ---
    let lastAlarmTriggeredMin = null;
    setInterval(async () => {
        try {
            const config = await ipcRenderer.invoke('get-config');
            if (config && config.alarmEnabled && config.alarmTime) {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                const currentHm = `${hh}:${mm}`;
                
                if (currentHm === config.alarmTime && lastAlarmTriggeredMin !== currentHm) {
                    lastAlarmTriggeredMin = currentHm;
                    ipcRenderer.send('show-notification', {
                        title: "TRENDcreate Browser アラーム",
                        body: `設定した時間（${config.alarmTime}）になりました。`
                    });
                }
                
                // Reset flag when time changes
                if (currentHm !== config.alarmTime) {
                    lastAlarmTriggeredMin = null;
                }
            }
        } catch (e) {
            console.error("Alarm check failed", e);
        }
    }, 15000); // Check every 15 seconds
});
