const vscode = require("vscode");
const PreviewPanel = require("./previewPanel");

function activate(context) {
    let disposable = vscode.commands.registerCommand("htmlView.preview", function () {
        PreviewPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
