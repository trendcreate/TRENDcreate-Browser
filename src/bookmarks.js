document.addEventListener("DOMContentLoaded", () => {

    const bookmarksList = document.getElementById("bookmarks-list");
    const clearBtn = document.getElementById("clear-bookmarks-btn");
    const deleteSelectedBtn = document.getElementById("delete-selected-btn");
    const pageTitle = document.getElementById("page-title");

    const lang = localStorage.getItem('appLang') || 'en';
    const uiText = {
        ja: {
            title: 'ブックマーク',
            deleteSelected: '選択したものを削除',
            clearAll: 'すべて削除',
            empty: 'ブックマークはありません。',
            confirmDeleteAll: 'すべてのブックマークを削除しますか？',
            confirmDeleteSelected: '件のブックマークを削除しますか？'
        },
        en: {
            title: 'Bookmarks',
            deleteSelected: 'Delete Selected',
            clearAll: 'Clear All',
            empty: 'No bookmarks found.',
            confirmDeleteAll: 'Are you sure you want to delete all bookmarks?',
            confirmDeleteSelected: 'bookmarks will be deleted. Are you sure?'
        },
        ko: {
            title: '북마크',
            deleteSelected: '선택 항목 삭제',
            clearAll: '모두 지우기',
            empty: '북마크가 없습니다.',
            confirmDeleteAll: '모든 북마크를 삭제하시겠습니까?',
            confirmDeleteSelected: '개의 북마크를 삭제하시겠습니까?'
        },
        zh: {
            title: '书签',
            deleteSelected: '删除所选',
            clearAll: '全部清除',
            empty: '没有找到书签。',
            confirmDeleteAll: '您确定要删除所有书签吗？',
            confirmDeleteSelected: '个书签将被删除。确定吗？'
        },
        ar: {
            title: 'العلامات',
            deleteSelected: 'حذف المحدد',
            clearAll: 'مسح الكل',
            empty: 'لم يتم العثور على علامات.',
            confirmDeleteAll: 'هل أنت متأكد أنك تريد حذف جميع العلامات؟',
            confirmDeleteSelected: 'علامات سيتم حذفها. هل أنت متأكد؟'
        }
    };
    const t = uiText[lang] || uiText['en'];

    pageTitle.textContent = t.title;
    deleteSelectedBtn.textContent = t.deleteSelected;
    clearBtn.textContent = t.clearAll;

    function updateDeleteBtnVisibility() {
        const checkedBoxes = document.querySelectorAll(".bookmark-checkbox:checked");
        if (checkedBoxes.length > 0) {
            deleteSelectedBtn.style.display = "block";
        } else {
            deleteSelectedBtn.style.display = "none";
        }
    }

    function loadBookmarks() {
        bookmarksList.replaceChildren();
        const bookmarksData = JSON.parse(localStorage.getItem("bookmarks") || "[]");

        if (bookmarksData.length === 0) {
            const emptyMsg = document.createElement("div");
            emptyMsg.className = "empty-message";
            emptyMsg.textContent = t.empty;
            bookmarksList.appendChild(emptyMsg);
            deleteSelectedBtn.style.display = "none";
            return;
        }

        bookmarksData.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "bookmark-item";

            const checkboxWrapper = document.createElement("div");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "bookmark-checkbox";
            checkbox.dataset.index = index;
            checkbox.addEventListener("change", updateDeleteBtnVisibility);
            checkboxWrapper.appendChild(checkbox);

            const infoEl = document.createElement("div");
            infoEl.className = "bookmark-info";

            const titleEl = document.createElement("a");
            titleEl.className = "bookmark-title";
            titleEl.textContent = item.title || item.url;
            titleEl.href = item.url;
            titleEl.addEventListener("click", (event) => {
                event.preventDefault();
                window.location.href = item.url;
            });

            const urlEl = document.createElement("div");
            urlEl.className = "bookmark-url";
            urlEl.textContent = item.url;

            infoEl.append(titleEl, urlEl);

            const date = new Date(item.timestamp);
            const timeEl = document.createElement("div");
            timeEl.className = "bookmark-time";
            timeEl.textContent = date.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US');

            li.append(checkboxWrapper, infoEl, timeEl);
            bookmarksList.appendChild(li);
        });
        updateDeleteBtnVisibility();
    }

    deleteSelectedBtn.addEventListener("click", () => {
        const checkedBoxes = Array.from(document.querySelectorAll(".bookmark-checkbox:checked"));
        if (checkedBoxes.length === 0) return;
        
        let confirmMsg = lang === 'ja' || lang === 'ko' ? `${checkedBoxes.length}${t.confirmDeleteSelected}` : `${checkedBoxes.length} ${t.confirmDeleteSelected}`;
        if (!confirm(confirmMsg)) return;
        
        const indicesToRemove = checkedBoxes.map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
        let bookmarksData = JSON.parse(localStorage.getItem("bookmarks") || "[]");
        
        indicesToRemove.forEach(index => {
            bookmarksData.splice(index, 1);
        });
        
        localStorage.setItem("bookmarks", JSON.stringify(bookmarksData));
        loadBookmarks();
    });

    clearBtn.addEventListener("click", () => {
        if (!confirm(t.confirmDeleteAll)) return;
        localStorage.removeItem("bookmarks");
        loadBookmarks();
    });

    loadBookmarks();
});
