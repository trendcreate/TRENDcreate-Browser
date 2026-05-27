document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('notepad-textarea');
    const clearBtn = document.getElementById('clear-btn');
    const charCount = document.getElementById('char-count');
    const saveStatus = document.getElementById('save-status');
    let saveTimeout;

    // Load saved notes
    const savedNotes = localStorage.getItem('mobileNotepad') || '';
    textarea.value = savedNotes;
    updateCharCount();

    textarea.addEventListener('input', () => {
        updateCharCount();
        
        // Show saving status
        saveStatus.textContent = 'Saving...';
        saveStatus.style.display = 'inline';
        
        // Auto-save logic with debounce
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem('mobileNotepad', textarea.value);
            saveStatus.textContent = 'Saved';
            setTimeout(() => {
                saveStatus.style.display = 'none';
            }, 1500);
        }, 500);
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('メモをすべて消去しますか？ / Are you sure you want to clear the notepad?')) {
            textarea.value = '';
            localStorage.setItem('mobileNotepad', '');
            updateCharCount();
            saveStatus.textContent = 'Cleared';
            saveStatus.style.display = 'inline';
            setTimeout(() => {
                saveStatus.style.display = 'none';
            }, 1500);
        }
    });

    function updateCharCount() {
        charCount.textContent = `${textarea.value.length} characters`;
    }
});
