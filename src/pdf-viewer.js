import * as pdfjsLib from '../node_modules/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.mjs';

let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');

const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageNumEl = document.getElementById('page-num');
const pageCountEl = document.getElementById('page-count');
const zoomLevelEl = document.getElementById('zoom-level');
const titleEl = document.getElementById('title');

// URLパラメータからファイルパスを取得
const urlParams = new URLSearchParams(window.location.search);
const fileUrl = urlParams.get('file');

if (fileUrl) {
    // 拡張子の前のファイル名を取得
    const fileName = fileUrl.split(/[/\\]/).pop();
    titleEl.textContent = decodeURIComponent(fileName);
    document.title = `${decodeURIComponent(fileName)} - PDF Viewer`;
    
    loadPDF(fileUrl);
} else {
    titleEl.textContent = 'No PDF file specified';
}

function loadPDF(url) {
    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then((pdf) => {
        pdfDoc = pdf;
        pageCountEl.textContent = pdf.numPages;
        renderPage(pageNum);
    }).catch(err => {
        console.error('Error loading PDF:', err);
        titleEl.textContent = 'Error loading PDF';
    });
}

function renderPage(num) {
    pageRendering = true;
    pdfDoc.getPage(num).then((page) => {
        const viewport = page.getViewport({ scale: scale });
        
        // Use devicePixelRatio to render high-res on retina displays
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const renderContext = {
            canvasContext: ctx,
            transform: [outputScale, 0, 0, outputScale, 0, 0],
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        renderTask.promise.then(() => {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    pageNumEl.textContent = num;
    updateButtons();
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function onPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function onNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

function updateButtons() {
    prevPageBtn.disabled = pageNum <= 1;
    nextPageBtn.disabled = !pdfDoc || pageNum >= pdfDoc.numPages;
}

function onZoomIn() {
    scale += 0.2;
    updateZoomLevel();
    queueRenderPage(pageNum);
}

function onZoomOut() {
    if (scale <= 0.4) return;
    scale -= 0.2;
    updateZoomLevel();
    queueRenderPage(pageNum);
}

function updateZoomLevel() {
    zoomLevelEl.textContent = Math.round(scale * 100) + '%';
}

prevPageBtn.addEventListener('click', onPrevPage);
nextPageBtn.addEventListener('click', onNextPage);
zoomInBtn.addEventListener('click', onZoomIn);
zoomOutBtn.addEventListener('click', onZoomOut);
