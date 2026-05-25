document.addEventListener("DOMContentLoaded", () => {
    const bgElement = document.getElementById("background");
    const imageUrl = `https://picsum.photos/1080/720?grayscale&random=${Date.now()}`;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
        bgElement.style.backgroundImage = `url('${imageUrl}')`;
        bgElement.classList.add("loaded");
    };

    const historyList = document.getElementById("history-list");
    const clearBtn = document.getElementById("clear-history-btn");

    function loadHistory() {
        historyList.replaceChildren();
        const historyData = JSON.parse(localStorage.getItem("browserHistory") || "[]");

        if (historyData.length === 0) {
            const emptyMsg = document.createElement("div");
            emptyMsg.className = "empty-message";
            emptyMsg.textContent = "閲覧履歴はありません。";
            historyList.appendChild(emptyMsg);
            return;
        }

        historyData.forEach((item) => {
            const li = document.createElement("li");
            li.className = "history-item";

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
            li.append(timeEl, infoEl);
            historyList.appendChild(li);
        });
    }

    clearBtn.addEventListener("click", () => {
        if (!confirm("すべての閲覧履歴を削除しますか？")) return;
        localStorage.removeItem("browserHistory");
        loadHistory();
    });

    loadHistory();
});
