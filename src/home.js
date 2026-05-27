document.addEventListener('DOMContentLoaded', () => {
    // 2. Analog Clock and Date
    const hourHand = document.getElementById('hour-hand');
    const minuteHand = document.getElementById('minute-hand');
    const secondHand = document.getElementById('second-hand');
    const dateDisplay = document.getElementById('date-display');

    function updateClock() {
        const now = new Date();
        
        // Date formatting (Japanese locale for date display)
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
        dateDisplay.textContent = now.toLocaleDateString('en-US', options);

        // Time logic for hands
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // 12-hour format
        hours = hours % 12;
        
        const hourDeg = (hours * 30) + (minutes * 0.5); // 360 / 12 = 30
        const minuteDeg = (minutes * 6) + (seconds * 0.1); // 360 / 60 = 6
        const secondDeg = seconds * 6;

        hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
        minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
        secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
    }

    setInterval(updateClock, 1000);
    updateClock(); // Initial call

    // 3. Audio & Visualizer Logic
    const audioPlayer = document.getElementById('audio-player');
    const uploadBtn = document.getElementById('upload-btn');
    const audioUpload = document.getElementById('audio-upload');
    const dropZone = document.getElementById('drop-zone');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const trackName = document.getElementById('track-name');
    const seekSliderContainer = document.getElementById('seek-slider-container');
    const seekProgress = document.getElementById('seek-progress');
    let isDraggingSeek = false;
    const CIRCUMFERENCE = 2 * Math.PI * 16; // 100.5
    const volumeSlider = document.getElementById('volume-slider');
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const circularSliderimg = document.getElementById('circular-slider-img');

    let audioContext;
    let analyser;
    let source;
    let animationId;

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Skip visualizer attachment on Capacitor to avoid MediaError/CORS issues
            if (!window.Capacitor) {
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source = audioContext.createMediaElementSource(audioPlayer);
                source.connect(analyser);
                analyser.connect(audioContext.destination);
                drawVisualizer();
            } else {
                // For Capacitor, just clear canvas to avoid black screen and don't attach node
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    function drawVisualizer() {
        animationId = requestAnimationFrame(drawVisualizer);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength);
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2.5; // Scale height for visual aspect

            // Grayscale visualization mapping
            // Higher frequencies / amplitudes can be brighter
            const colorValue = Math.min(255, dataArray[i] + 50);
            canvasCtx.fillStyle = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;

            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    function handleFile(file) {
        if (!file) return;
        
        const isAudio = file.type.includes('audio') || file.name.match(/\.(mp3|wav|m4a)$/i);
        if (isAudio) {
            const fileURL = URL.createObjectURL(file);
            audioPlayer.src = fileURL;
            trackName.textContent = file.name;
            playPauseBtn.disabled = false;
            
            // Auto play only on Desktop. On Mobile, require user to press Play.
            if (!window.Capacitor) {
                initAudio();
                audioPlayer.play();
                playPauseBtn.textContent = 'Pause';
                circularSliderimg.style.animationPlayState = "running";
            } else {
                playPauseBtn.textContent = 'Play';
                circularSliderimg.style.animationPlayState = "paused";
            }

            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    const picture = tag.tags.picture;
                    if (picture) {
                        let base64String = "";
                        for (let i = 0; i < picture.data.length; i++) {
                            base64String += String.fromCharCode(picture.data[i]);
                        }
                        const base64 = "data:" + picture.format + ";base64," + window.btoa(base64String);
                        circularSliderimg.style.display = 'block';
                        circularSliderimg.src = base64;
                        circularSliderimg.style.width = '3vw';
                        circularSliderimg.style.height = '3vw';
                        circularSliderimg.style.borderRadius = '100%';
                        circularSliderimg.style.animation = 'dj-spin 1s linear infinite';
                        circularSliderimg.style.animationPlayState = "running";
                    } else {
                        circularSliderimg.style.display = 'none';
                        circularSliderimg.src = '';
                    }
                },
                onError: function(error) {
                    console.log('Error reading tags: ', error);
                }
            });
            audioPlayer.volume = volumeSlider.value / 100;
            audioPlayer.addEventListener('timeupdate', () => {
                if (!isDraggingSeek) {
                    const progress = audioPlayer.currentTime / audioPlayer.duration;
                    const offset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);
                    seekProgress.style.strokeDashoffset = isNaN(offset) ? CIRCUMFERENCE : offset;
                }
            });
        } else {
            alert('Please select an MP3 / WAV / M4A file.');
        }
    }

    // Button interactions
    uploadBtn.addEventListener('click', () => {
        audioUpload.click();
    });

    audioUpload.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    // Drag and Drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Play / Pause logic
    playPauseBtn.addEventListener('click', () => {
        initAudio();
        if (audioPlayer.paused) {
            audioPlayer.play();
            playPauseBtn.textContent = 'Pause';
            circularSliderimg.style.animationPlayState = "running";
        } else {
            audioPlayer.pause();
            playPauseBtn.textContent = 'Play';
            circularSliderimg.style.animationPlayState = "paused";
        }
    });


    function updateSeekFromEvent(e) {
        if (!audioPlayer.duration) return;
        const rect = seekSliderContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const x = e.clientX - centerX;
        const y = e.clientY - centerY;
        
        let angle = Math.atan2(y, x) + Math.PI / 2;
        if (angle < 0) angle += 2 * Math.PI;

        let progress = angle / (2 * Math.PI);
        progress = Math.max(0, Math.min(1, progress));

        const offset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);
        seekProgress.style.transition = 'none';
        seekProgress.style.strokeDashoffset = offset;
        
        audioPlayer.currentTime = audioPlayer.duration * progress;
    }

    seekSliderContainer.addEventListener('mousedown', (e) => {
        isDraggingSeek = true;
        updateSeekFromEvent(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingSeek) {
            updateSeekFromEvent(e);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingSeek) {
            isDraggingSeek = false;
            seekProgress.style.transition = 'stroke-dashoffset 0.1s linear';
        }
    });

    volumeSlider.addEventListener('input', () => {
        audioPlayer.volume = volumeSlider.value / 100;
    });

    // Audio end event
    audioPlayer.addEventListener('ended', () => {
        playPauseBtn.textContent = 'Play';
        circularSliderimg.style.animationPlayState = "paused";
    });
});


// 検索を実行する共通関数
function submitSearch(isAiMode) {
  const queryInput = document.getElementById('search-query');
  const query = encodeURIComponent(queryInput.value.trim());
  if (!query) return;

  let url = '';

  if (isAiMode) {
    url = `https://google.com/search?q=${query}&udm=50&igu=1`;
  } else {
    // 通常のGoogle検索
    url = `https://google.com/search?q=${query}&igu=1`;
  }

  // 拡張機能のAPIを使って現在のタブを切り替える
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.update({ url: url });
  } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
    // Save to history for Capacitor
    const historyData = JSON.parse(localStorage.getItem("browserHistory") || "[]");
    historyData.unshift({
        url: url,
        title: "Search: " + decodeURIComponent(query),
        timestamp: Date.now()
    });
    if (historyData.length > 100) historyData.splice(100);
    localStorage.setItem("browserHistory", JSON.stringify(historyData));

    // In-App Browser for Capacitor is REQUIRED.
    // Direct window.location.href to an external site destroys the Capacitor bridge
    // and causes the Android hardware back button to crash the app.
    window.Capacitor.Plugins.Browser.open({ url: url });
  } else {
    window.location.href = url;
  }
}

// ページ読み込み完了時の処理
document.addEventListener('DOMContentLoaded', function() {
  const queryInput = document.getElementById('search-query');
  const btnNormal = document.getElementById('btn-normal');
  const btnAi = document.getElementById('btn-ai');

  // 通常検索ボタン
  btnNormal.addEventListener('click', function() {
    submitSearch(false);
  });

  // AIモードボタン
  btnAi.addEventListener('click', function() {
    submitSearch(true);
  });

  // Enterキー（通常検索）
  queryInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      submitSearch(false);
    }
  });

  // ⭕ アドレスバーのフォーカスを奪って検索窓に強制フォーカスする
  setTimeout(() => {
    queryInput.focus();
  }, 50);

  // ⭕ 何も選択されていない時に入力があれば検索バーにフォーカスする
  document.addEventListener('keydown', function(e) {
    const isModifier = e.ctrlKey || e.metaKey || e.altKey;
    if (!isModifier && e.key.length === 1 && document.activeElement !== queryInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      queryInput.focus();
    }
  });
});

// Settings Navigation & Language Logic
document.addEventListener('DOMContentLoaded', function() {
    const settingsBtn = document.getElementById('settings-btn');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            window.location.href = 'setting.html';
        });
    }

    // Load saved language or default to 'ja'
    const savedLang = localStorage.getItem('appLang') || 'ja';
    applyLanguage(savedLang);

    function applyLanguage(lang) {
        const uiText = {
            ja: {
                settingsBtn: '⚙',
                searchPlaceholder: 'Google で検索',
                btnAi: '☆ AI検索',
                btnNormal: '検索',
                uploadBtn: '音楽読み込み (MP3/WAV/M4A)',
                dropText: 'またはここにドロップ',
                noTrack: 'トラック未読み込み'
            },
            en: {
                settingsBtn: '⚙',
                searchPlaceholder: 'Search Google',
                btnAi: '☆ AI Search',
                btnNormal: 'Search',
                uploadBtn: 'Load MP3/WAV/M4A',
                dropText: 'or Drag & Drop here',
                noTrack: 'No track loaded'
            },
            ko: {
                settingsTitle: '설정',
                settingsBtn: '⚙',
                searchPlaceholder: 'Google 검색',
                btnAi: '☆ AI 검색',
                btnNormal: '검색',
                uploadBtn: '음악 불러오기 (MP3/WAV/M4A)',
                dropText: '또는 여기에 드롭하세요',
                noTrack: '트랙 없음'
            },
            zh: {
                settingsBtn: '⚙',
                searchPlaceholder: '在 Google 搜索',
                btnAi: '☆ AI 搜索',
                btnNormal: '搜索',
                uploadBtn: '加载音乐 (MP3/WAV/M4A)',
                dropText: '或拖放到此处',
                noTrack: '未加载曲目'
            },
            ar: {
                settingsBtn: '⚙',
                searchPlaceholder: 'ابحث في Google',
                btnAi: '☆ بحث AI',
                btnNormal: 'بحث',
                uploadBtn: 'تحميل موسيقى (MP3/WAV/M4A)',
                dropText: 'أو اسحب وأفلت هنا',
                noTrack: 'لا يوجد مقطع صوتي'
            }
        };

        const t = uiText[lang] || uiText['en'];
        if (!t) return;

        const settingsBtnEl = document.getElementById('settings-btn');
        if (settingsBtnEl) settingsBtnEl.textContent = t.settingsBtn;

        const searchInput = document.getElementById('search-query');
        if (searchInput) searchInput.placeholder = t.searchPlaceholder;

        const btnAi = document.getElementById('btn-ai');
        if (btnAi) btnAi.textContent = t.btnAi;

        const btnNormal = document.getElementById('btn-normal');
        if (btnNormal) btnNormal.textContent = t.btnNormal;

        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) uploadBtn.textContent = t.uploadBtn;

        const dropText = document.querySelector('.drop-text');
        if (dropText) dropText.textContent = t.dropText;
        
        const trackNameEl = document.getElementById('track-name');
        if (trackNameEl && (trackNameEl.textContent === 'No track loaded' || trackNameEl.textContent === 'トラック未読み込み')) {
            trackNameEl.textContent = t.noTrack;
        }
    }

    // Load and render custom widget
    const customWidgetHtml = localStorage.getItem('customWidgetHtml');
    if (customWidgetHtml) {
        const container = document.getElementById('custom-widget-container');
        if (container) {
            const cleanHtml = DOMPurify.sanitize(customWidgetHtml, { RETURN_DOM: false });
            container.innerHTML = cleanHtml;
        }
    }

    // Hamburger Menu Logic
    const hamburgerBtn = document.getElementById('home-hamburger-btn');
    const mobileMenu = document.getElementById('home-mobile-menu');
    const menuCloseBtn = document.getElementById('home-menu-close');
    const menuHistoryBtn = document.getElementById('menu-history-btn');
    const menuBookmarksBtn = document.getElementById('menu-bookmarks-btn');
    const menuSettingsBtn = document.getElementById('menu-settings-btn');
    const menuNotepadBtn = document.getElementById('menu-notepad-btn');

    // Show hamburger menu button if we are in Capacitor
    if (window.Capacitor && hamburgerBtn) {
        hamburgerBtn.style.display = 'block';
        // Hide standard settings button on mobile to avoid duplicates
        const stdSettings = document.getElementById('settings-btn');
        if (stdSettings) stdSettings.style.display = 'none';
    }

    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', () => {
            mobileMenu.style.display = 'flex';
        });
        menuCloseBtn.addEventListener('click', () => {
            mobileMenu.style.display = 'none';
        });

        // Use location.assign or location.href to navigate within Capacitor WebView
        if (menuHistoryBtn) menuHistoryBtn.addEventListener('click', () => window.location.href = 'history.html');
        if (menuBookmarksBtn) menuBookmarksBtn.addEventListener('click', () => window.location.href = 'bookmarks.html');
        if (menuSettingsBtn) menuSettingsBtn.addEventListener('click', () => window.location.href = 'setting.html');
        if (menuNotepadBtn) {
            menuNotepadBtn.addEventListener('click', () => window.location.href = 'notepad.html');
        }
    }
});