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
exports.AlgorithmEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const namespacePicker_1 = require("./namespacePicker");
/**
 * Custom Editor pre *.sqd.yaml súbory.
 * Webview UI je samostatná React aplikácia v ./webview-ui/dist/algorithm/
 */
class AlgorithmEditorProvider {
    static register(context) {
        return vscode.window.registerCustomEditorProvider(AlgorithmEditorProvider.viewType, new AlgorithmEditorProvider(context), { supportsMultipleEditorsPerDocument: false });
    }
    constructor(context) {
        this.context = context;
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
    resolveRequestedPath(documentUri, requestedPath) {
        if (path.isAbsolute(requestedPath)) {
            return requestedPath;
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        const workspaceRoot = workspaceFolder?.uri.fsPath;
        if (workspaceRoot) {
            return path.resolve(workspaceRoot, requestedPath);
        }
        return path.resolve(path.dirname(documentUri.fsPath), requestedPath);
    }
    extractNamespaceCatalog(content) {
        try {
            const parsed = yaml.load(content);
            const namespaceRef = Array.isArray(parsed?.meta?.namespaceRef)
                ? parsed.meta.namespaceRef
                : Array.isArray(parsed?.namespaceRef)
                    ? parsed.namespaceRef
                    : [];
            return namespaceRef
                .map((entry) => ({
                alias: String(entry?.alias ?? '').trim(),
                filePath: String(entry?.filePath ?? '').trim(),
                sourceType: (entry?.sourceType === 'sqd' || entry?.sourceType === 'current') ? entry.sourceType : 'model',
                ...(entry?.status ? { status: entry.status } : {})
            }))
                .filter((entry) => entry.alias.length > 0 && entry.filePath.length > 0);
        }
        catch {
            return [];
        }
    }
    async loadGlobalNamespaceCatalog(documentUri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (!workspaceFolder) {
            return [];
        }
        const candidates = ['_global.meta.yaml', '_global.meta.yml'];
        for (const fileName of candidates) {
            try {
                const uri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                const doc = await vscode.workspace.openTextDocument(uri);
                const catalog = this.extractNamespaceCatalog(doc.getText());
                if (catalog.length > 0) {
                    return catalog;
                }
            }
            catch {
                // ignore missing/invalid candidate and try next
            }
        }
        return [];
    }
    async resolveCustomTextEditor(document, webviewPanel) {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist')
            ]
        };
        webviewPanel.webview.html = this._getHtml(webviewPanel.webview, 'algorithm');
        // Pošli obsah súboru do webview
        const sendContent = async () => {
            const globalNamespaces = await this.loadGlobalNamespaceCatalog(document.uri);
            webviewPanel.webview.postMessage({
                type: 'update',
                content: document.getText(),
                fileName: document.uri.path.split('/').pop() ?? document.fileName,
                globalNamespaces
            });
        };
        await sendContent();
        // Sleduj zmeny dokumentu
        const changeDocSub = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                sendContent();
            }
        });
        // Prijímaj správy z webview (edity)
        webviewPanel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'edit') {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), msg.content);
                await vscode.workspace.applyEdit(edit);
            }
            else if (msg.type === 'loadModel') {
                const resolvedPath = this.resolveRequestedPath(document.uri, msg.path);
                const content = await this.loadModelFile(resolvedPath);
                if (content) {
                    webviewPanel.webview.postMessage({
                        type: 'modelContent',
                        path: resolvedPath,
                        requestKey: msg.path,
                        content
                    });
                }
            }
            else if (msg.type === 'pickFile') {
                const picked = await (0, namespacePicker_1.pickNamespaceReference)(document.uri);
                if (!picked) {
                    return;
                }
                webviewPanel.webview.postMessage({
                    type: 'filePicked',
                    ...picked
                });
            }
        });
        webviewPanel.onDidDispose(() => changeDocSub.dispose());
    }
    _getHtml(webview, app) {
        const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', app);
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
  <title>SQD Algorithm Editor</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.AlgorithmEditorProvider = AlgorithmEditorProvider;
AlgorithmEditorProvider.viewType = 'sqd.algorithmEditor';
function getNonce() {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
