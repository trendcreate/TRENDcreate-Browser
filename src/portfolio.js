document.addEventListener('DOMContentLoaded', () => {
    const portfolioGrid = document.getElementById("portfolio-grid");
    const openWorkspaceBtn = document.getElementById("open-workspace-btn");
    const goUpBtn = document.getElementById("go-up-btn");
    const currentPathLabel = document.getElementById("current-path-label");
    
    let baseWorkspacePath = localStorage.getItem('trendcreate-portfolio-workspace') || null;
    let currentPath = baseWorkspacePath;

    async function loadPortfolio(targetPath) {
        try {
            const projects = await window.ipcRenderer.invoke('get-portfolio-projects', targetPath);
            
            // Update state
            currentPath = targetPath;
            currentPathLabel.textContent = currentPath || "Default Workspace";
            
            // Enable/disable Go Up
            if (baseWorkspacePath && currentPath && currentPath.length > baseWorkspacePath.length) {
                goUpBtn.disabled = false;
            } else {
                goUpBtn.disabled = true;
            }
            
            portfolioGrid.innerHTML = '';
            
            if (!projects || projects.length === 0) {
                portfolioGrid.innerHTML = '<p style="color:#aaa; text-align:center; grid-column: 1 / -1; font-size: 1.2rem; margin-top: 50px;">No projects found in this workspace.</p>';
                return;
            }

            projects.forEach(project => {
                const card = document.createElement("div");
                card.className = "portfolio-card";
                
                const date = new Date(project.modifiedAt).toLocaleDateString();
                
                const SVG_ICONS = {
                    folder: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
                    web: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
                    image: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
                    code: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
                    file: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
                    game: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 1 1 20 0 10 10 0 0 1-20 0z"></path><circle cx="16" cy="12" r="1"></circle><circle cx="13" cy="15" r="1"></circle><path d="M7 12h4"></path><path d="M9 10v4"></path></svg>`,
                    app: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
                    music: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`
                };

                // Try to determine an icon
                let iconSvg = SVG_ICONS.folder;
                if (project.type === 'file') {
                    const ext = project.name.split('.').pop().toLowerCase();
                    if (['html', 'htm'].includes(ext)) iconSvg = SVG_ICONS.web;
                    else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) iconSvg = SVG_ICONS.image;
                    else if (['js', 'css', 'json', 'ts'].includes(ext)) iconSvg = SVG_ICONS.code;
                    else iconSvg = SVG_ICONS.file;
                } else {
                    if (project.title.toLowerCase().includes("game")) iconSvg = SVG_ICONS.game;
                    else if (project.title.toLowerCase().includes("app")) iconSvg = SVG_ICONS.app;
                    else if (project.title.toLowerCase().includes("site") || project.title.toLowerCase().includes("web")) iconSvg = SVG_ICONS.web;
                    else if (project.title.toLowerCase().includes("music")) iconSvg = SVG_ICONS.music;
                }

                let previewHtml = `<div class="portfolio-card-icon" style="color: rgba(255,255,255,0.7);">${iconSvg}</div>`;

                card.innerHTML = `
                    ${previewHtml}
                    <div class="portfolio-card-title" title="${project.title}">${project.title}</div>
                    <div class="portfolio-card-subtitle" title="${project.name}">${project.name}</div>
                    <div class="portfolio-card-date">Updated: ${date}</div>
                `;

                card.addEventListener("click", () => {
                    if (project.type === 'directory') {
                        loadPortfolio(project.path);
                    } else if (project.type === 'file') {
                        if (window.ipcRenderer) {
                            window.ipcRenderer.sendToHost('open-portfolio-file', project.path);
                        }
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
            baseWorkspacePath = result.filePaths[0];
            localStorage.setItem('trendcreate-portfolio-workspace', baseWorkspacePath);
            loadPortfolio(baseWorkspacePath);
        }
    });

    goUpBtn.addEventListener("click", () => {
        if (!currentPath) return;
        // Basic path.dirname equivalent
        const parentPath = currentPath.substring(0, Math.max(currentPath.lastIndexOf('\\'), currentPath.lastIndexOf('/')));
        if (parentPath && parentPath.length >= (baseWorkspacePath ? baseWorkspacePath.length : 0)) {
            loadPortfolio(parentPath);
        }
    });

    // Initial load
    window.ipcRenderer.invoke('get-portfolio-projects', null).then(projects => {
        // Just to get the default workspace path if baseWorkspacePath is null
        if (!baseWorkspacePath && projects.length > 0) {
             const samplePath = projects[0].path;
             baseWorkspacePath = samplePath.substring(0, Math.max(samplePath.lastIndexOf('\\'), samplePath.lastIndexOf('/')));
        }
        loadPortfolio(currentPath || baseWorkspacePath);
    });
});
