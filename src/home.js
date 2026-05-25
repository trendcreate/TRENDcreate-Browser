document.addEventListener('DOMContentLoaded', () => {
    // 1. Background Image Load
    const bgElement = document.getElementById('background');
    const timestamp = new Date().getTime(); // Prevent cache
    const imageUrl = `https://picsum.photos/1920/1080?grayscale&random=${timestamp}`;
    
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
        bgElement.style.backgroundImage = `url('${imageUrl}')`;
        bgElement.classList.add('loaded');
    };

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
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source = audioContext.createMediaElementSource(audioPlayer);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            drawVisualizer();
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
            
            // Auto play
            initAudio();
            audioPlayer.play();
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
            playPauseBtn.textContent = 'Pause';
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
    url = `https://google.com/search?q=${query}&udm=50`;
  } else {
    // 通常のGoogle検索
    url = `https://google.com/search?q=${query}`;
  }

  // 拡張機能のAPIを使って現在のタブを切り替える
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.update({ url: url });
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
                uploadBtn: 'Load MP3/WAV/M4A',
                dropText: 'or Drag & Drop here',
                noTrack: 'No track loaded'
            },
            en: {
                settingsBtn: '⚙',
                searchPlaceholder: 'Search Google',
                btnAi: '☆ AI Search',
                btnNormal: 'Search',
                uploadBtn: 'Load MP3/WAV/M4A',
                dropText: 'or Drag & Drop here',
                noTrack: 'No track loaded'
            }
        };

        const t = uiText[lang];
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
});