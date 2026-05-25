document.addEventListener('DOMContentLoaded', () => {
    const portfolioGrid = document.getElementById("portfolio-grid");
    const openWorkspaceBtn = document.getElementById("open-workspace-btn");

    async function loadPortfolio() {
        try {
            const workspacePath = localStorage.getItem('trendcreate-portfolio-workspace') || null;
            const projects = await window.ipcRenderer.invoke('get-portfolio-projects', workspacePath);
            
            portfolioGrid.innerHTML = '';
            
            if (!projects || projects.length === 0) {
                portfolioGrid.innerHTML = '<p style="color:#aaa; text-align:center; grid-column: 1 / -1; font-size: 1.2rem; margin-top: 50px;">No projects found in this workspace.</p>';
                return;
            }

            projects.forEach(project => {
                const card = document.createElement("div");
                card.className = "portfolio-card";
                
                const date = new Date(project.modifiedAt).toLocaleDateString();
                
                // Try to determine an icon
                let icon = "📁";
                if (project.title.toLowerCase().includes("game")) icon = "🎮";
                else if (project.title.toLowerCase().includes("app")) icon = "📱";
                else if (project.title.toLowerCase().includes("site") || project.title.toLowerCase().includes("web")) icon = "🌐";
                else if (project.title.toLowerCase().includes("music")) icon = "🎵";

                card.innerHTML = `
                    <div class="portfolio-card-icon">${icon}</div>
                    <div class="portfolio-card-title" title="${project.title}">${project.title}</div>
                    <div class="portfolio-card-subtitle" title="${project.name}">${project.name}</div>
                    <div class="portfolio-card-date">Updated: ${date}</div>
                `;

                card.addEventListener("click", () => {
                    if (window.ipcRenderer) {
                        window.ipcRenderer.sendToHost('open-portfolio-project', project.path);
                    }
                });

                portfolioGrid.appendChild(card);
            });
        } catch (e) {
            console.error("Failed to load portfolio", e);
            portfolioGrid.innerHTML = '<p style="color:red; text-align:center; grid-column: 1 / -1;">Failed to load projects.</p>';
        }
    }

    openWorkspaceBtn.addEventListener("click", async () => {
        const result = await window.ipcRenderer.invoke('show-open-dialog');
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
            localStorage.setItem('trendcreate-portfolio-workspace', result.filePaths[0]);
            loadPortfolio();
        }
    });

    // Initial load
    loadPortfolio();
});
