const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

class PreviewPanel {
    static currentPanel = null;
    static lastOpenedHtmlFile = null; // Stores the last opened HTML file

    static createOrShow(extensionUri) {
        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.Two);
            PreviewPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "htmlView",
            "HTML Preview",
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(vscode.workspace.rootPath || "")],
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel);
    }

    constructor(panel) {
        this.panel = panel;
        this.zoomLevel = 1.0;

        this.update();
        this.panel.onDidDispose(() => this.dispose(), null, []);
        this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));

        // Auto-refresh on file save
        this.fileWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === "html") this.update();
        });

        // Track last active HTML file
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === "html") {
                PreviewPanel.lastOpenedHtmlFile = editor.document.uri.fsPath;
            }
        });
    }

    update() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "html") {
            this.panel.webview.html = this.getErrorMessage();
            return;
        }

        PreviewPanel.lastOpenedHtmlFile = editor.document.uri.fsPath;
        const documentUri = editor.document.uri;
        this.panel.webview.html = this.wrapHTML(editor.document.getText(), documentUri);
    }

    wrapHTML(content, documentUri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(documentUri.fsPath);

        content = content.replace(/(src|href)="([^"]+)"/g, (match, attr, filePath) => {
            if (filePath.startsWith("http") || filePath.startsWith("#")) return match;

            const fileUri = vscode.Uri.file(path.join(workspacePath, filePath));
            const webviewUri = this.panel.webview.asWebviewUri(fileUri);
            return `${attr}="${webviewUri}"`;
        });

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HTML Preview</title>
            <style>
                body { margin: 0; font-family: Arial, sans-serif; }
                #toolbar {
                    background: #333; color: white; padding: 8px;
                    display: flex; gap: 10px; align-items: center;
                    position: fixed; top: 0; width: 100%;
                    z-index: 1000;
                }
                button {
                    background: #444; border: none; color: white;
                    padding: 5px 10px; cursor: pointer; border-radius: 5px;
                }
                button:hover { background: #555; }
                #zoomText {
                    font-size: 14px; color: #ddd;
                }
                #content {
                    margin-top: 40px;
                    transform: scale(${this.zoomLevel});
                    transform-origin: top left;
                }
            </style>
        </head>
        <body>
            <div id="toolbar">
                <button onclick="zoomIn()">🔍 +</button>
                <button onclick="zoomOut()">🔍 -</button>
                <button onclick="openInBrowser()">🌐 Open in Browser</button>
                <span id="zoomText">Zoom: ${Math.round(this.zoomLevel * 100)}%</span>
            </div>
            <div id="content">${content}</div>

            <script>
                let zoomLevel = ${this.zoomLevel};
                const vscode = acquireVsCodeApi();

                function zoomIn() {
                    document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1);
                    updateZoomText();
                }

                function zoomOut() {
                    document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) - 0.1);
                    updateZoomText();
                }

                function updateZoomText() {
                    let zoomPercentage = Math.round(parseFloat(document.body.style.zoom || 1) * 100);
                    document.getElementById("zoomText").textContent = "Zoom: " + zoomPercentage + "%";
                }

                function openInBrowser() {
                    vscode.postMessage({ command: 'openInBrowser' });
                }
            </script>
        </body>
        </html>
        `;
    }

    handleMessage(message) {
        if (message.command === "zoom") {
            this.zoomLevel = message.value;
        } else if (message.command === "openInBrowser") {
            this.openInBrowser();
        }
    }

    openInBrowser() {
        let filePath = PreviewPanel.lastOpenedHtmlFile;

        if (!filePath || !fs.existsSync(filePath)) {
            vscode.window.showErrorMessage("No valid HTML file found. Please save and reopen the file.");
            return;
        }

        vscode.env.openExternal(vscode.Uri.file(filePath));
    }

    getErrorMessage() {
        return `
        <html><body>
        <h2>No HTML file detected</h2>
        <p>Please open an HTML file to preview.</p>
        </body></html>
        `;
    }

    dispose() {
        PreviewPanel.currentPanel = null;
        this.panel.dispose();
        this.fileWatcher.dispose();
    }
}

module.exports = PreviewPanel;
