document.addEventListener("DOMContentLoaded", () => {

    const historyList = document.getElementById("history-list");
    const clearBtn = document.getElementById("clear-history-btn");
    const deleteSelectedBtn = document.getElementById("delete-selected-btn");

    function updateDeleteBtnVisibility() {
        const checkedBoxes = document.querySelectorAll(".history-checkbox:checked");
        if (checkedBoxes.length > 0) {
            deleteSelectedBtn.style.display = "block";
        } else {
            deleteSelectedBtn.style.display = "none";
        }
    }

    function loadHistory() {
        historyList.replaceChildren();
        const historyData = JSON.parse(localStorage.getItem("browserHistory") || "[]");

        if (historyData.length === 0) {
            const emptyMsg = document.createElement("div");
            emptyMsg.className = "empty-message";
            emptyMsg.textContent = "閲覧履歴はありません。";
            historyList.appendChild(emptyMsg);
            deleteSelectedBtn.style.display = "none";
            return;
        }

        historyData.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "history-item";
            li.style.gridTemplateColumns = "30px 128px minmax(0, 1fr)";

            const checkboxWrapper = document.createElement("div");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "history-checkbox";
            checkbox.dataset.index = index;
            checkbox.addEventListener("change", updateDeleteBtnVisibility);
            checkboxWrapper.appendChild(checkbox);

            const date = new Date(item.timestamp);
            const timeEl = document.createElement("div");
            timeEl.className = "history-time";
            timeEl.textContent = date.toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

            const infoEl = document.createElement("div");
            infoEl.className = "history-info";

            const titleEl = document.createElement("a");
            titleEl.className = "history-title";
            titleEl.textContent = item.title || item.url;
            titleEl.href = item.url;
            titleEl.addEventListener("click", (event) => {
                event.preventDefault();
                window.location.href = item.url;
            });

            const urlEl = document.createElement("div");
            urlEl.className = "history-url";
            urlEl.textContent = item.url;

            infoEl.append(titleEl, urlEl);
            li.append(checkboxWrapper, timeEl, infoEl);
            historyList.appendChild(li);
        });
        updateDeleteBtnVisibility();
    }

    deleteSelectedBtn.addEventListener("click", () => {
        const checkedBoxes = Array.from(document.querySelectorAll(".history-checkbox:checked"));
        if (checkedBoxes.length === 0) return;
        
        if (!confirm(`${checkedBoxes.length}件の履歴を削除しますか？`)) return;
        
        const indicesToRemove = checkedBoxes.map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
        let historyData = JSON.parse(localStorage.getItem("browserHistory") || "[]");
        
        indicesToRemove.forEach(index => {
            historyData.splice(index, 1);
        });
        
        localStorage.setItem("browserHistory", JSON.stringify(historyData));
        loadHistory();
    });

    clearBtn.addEventListener("click", () => {
        if (!confirm("すべての閲覧履歴を削除しますか？")) return;
        localStorage.removeItem("browserHistory");
        loadHistory();
    });

    loadHistory();
});
