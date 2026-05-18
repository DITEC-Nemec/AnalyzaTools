"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainModelEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Custom Editor pre domain.model.yaml
 * Rovnaká štruktúra ako AlgorithmEditorProvider – iný webview app.
 */
class DomainModelEditorProvider {
    static register(context) {
        return vscode.window.registerCustomEditorProvider(DomainModelEditorProvider.viewType, new DomainModelEditorProvider(context), { supportsMultipleEditorsPerDocument: false });
    }
    constructor(context) {
        this.context = context;
    }
    async findAvailableModels() {
        const allFiles = await vscode.workspace.findFiles('**/*.model.yaml', '**/node_modules/**');
        return allFiles.map(uri => ({
            path: uri.fsPath,
            label: path.basename(uri.fsPath)
        }));
    }
    async loadModelFile(filePath) {
        try {
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            return doc.getText();
        }
        catch (e) {
            console.error('Failed to load model:', e);
            return null;
        }
    }
    async resolveCustomTextEditor(document, webviewPanel) {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist')
            ]
        };
        webviewPanel.webview.html = this._getHtml(webviewPanel.webview);
        const sendContent = async () => {
            const models = await this.findAvailableModels();
            webviewPanel.webview.postMessage({
                type: 'update',
                content: document.getText(),
                currentPath: document.uri.fsPath,
                availableModels: models
            });
        };
        await sendContent();
        const changeDocSub = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                sendContent();
            }
        });
        webviewPanel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'edit') {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), msg.content);
                await vscode.workspace.applyEdit(edit);
            }
            else if (msg.type === 'loadModel') {
                const content = await this.loadModelFile(msg.path);
                if (content) {
                    webviewPanel.webview.postMessage({
                        type: 'modelContent',
                        path: msg.path,
                        content: content
                    });
                }
            }
        });
        webviewPanel.onDidDispose(() => changeDocSub.dispose());
    }
    _getHtml(webview) {
        const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', 'domainModel');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.css'));
        const nonce = getNonce();
        return /* html */ `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src ${webview.cspSource} 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>SQD Domain Model Editor</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.DomainModelEditorProvider = DomainModelEditorProvider;
DomainModelEditorProvider.viewType = 'sqd.domainModelEditor';
function getNonce() {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
