import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { pickNamespaceReference } from './namespacePicker';

interface ModelFile {
  path: string;
  label: string;
}

interface NamespaceEntity {
  alias: string;
  filePath: string;
  sourceType: 'current' | 'model' | 'sqd';
  status?: 'active' | 'deprecated' | 'draft';
}

/**
 * Custom Editor pre domain.model.yaml
 * Rovnaká štruktúra ako AlgorithmEditorProvider – iný webview app.
 */
export class DomainModelEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sqd.domainModelEditor';

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      DomainModelEditorProvider.viewType,
      new DomainModelEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  private async findAvailableModels(): Promise<ModelFile[]> {
    const allFiles = await vscode.workspace.findFiles('**/*.model.yaml', '**/node_modules/**');
    return allFiles.map(uri => ({
      path: uri.fsPath,
      label: path.basename(uri.fsPath)
    }));
  }

  private async loadModelFile(filePath: string): Promise<string | null> {
    try {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      return doc.getText();
    } catch (e) {
      console.error('Failed to load model:', e);
      return null;
    }
  }

  private resolveRequestedPath(documentUri: vscode.Uri, requestedPath: string): string {
    if (path.isAbsolute(requestedPath)) {
      return requestedPath;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    const workspaceRoot = workspaceFolder?.uri.fsPath;

    if (workspaceRoot) {
      return path.resolve(workspaceRoot, requestedPath);
    }

    // Fallback for single-file/no-folder context.
    return path.resolve(path.dirname(documentUri.fsPath), requestedPath);
  }

  private extractNamespaceCatalog(content: string): NamespaceEntity[] {
    try {
      const parsed = yaml.load(content) as any;
      const namespaceRef = Array.isArray(parsed?.meta?.namespaceRefList)
        ? parsed.meta.namespaceRefList
        : Array.isArray(parsed?.meta?.namespaceRef)
          ? parsed.meta.namespaceRef
        : Array.isArray(parsed?.namespaceRef)
          ? parsed.namespaceRef
          : [];

      return namespaceRef
        .map((entry: any) => ({
          alias: String(entry?.alias ?? '').trim(),
          filePath: String(entry?.filePath ?? '').trim(),
          sourceType: (entry?.sourceType === 'sqd' || entry?.sourceType === 'current') ? entry.sourceType : 'model',
          ...(entry?.status ? { status: entry.status } : {})
        }))
        .filter((entry: NamespaceEntity) => entry.alias.length > 0 && entry.filePath.length > 0);
    } catch {
      return [];
    }
  }

  private async loadGlobalNamespaceCatalog(documentUri: vscode.Uri): Promise<NamespaceEntity[]> {
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
      } catch {
        // ignore missing/invalid candidate and try next
      }
    }

    return [];
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist')
      ]
    };

    webviewPanel.webview.html = this._getHtml(webviewPanel.webview);

    const fileNameLower = path.basename(document.uri.fsPath).toLowerCase();
    if (fileNameLower.endsWith('.meta.yaml') && fileNameLower !== '_global.meta.yaml') {
      vscode.window.showWarningMessage('Odporucana konvencia je pomenovanie _global.meta.yaml pre globalny namespace katalog.');
    }

    const sendContent = async () => {
      const models = await this.findAvailableModels();
      const globalNamespaces = await this.loadGlobalNamespaceCatalog(document.uri);
      webviewPanel.webview.postMessage({
        type: 'update',
        content: document.getText(),
        currentPath: document.uri.fsPath,
        availableModels: models,
        globalNamespaces
      });
    };
    
    await sendContent();

    const changeDocSub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        sendContent();
      }
    });

    webviewPanel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'edit') {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), msg.content);
        await vscode.workspace.applyEdit(edit);
      } else if (msg.type === 'loadModel') {
        const resolvedPath = this.resolveRequestedPath(document.uri, msg.path);
        const content = await this.loadModelFile(resolvedPath);
        if (content) {
          webviewPanel.webview.postMessage({
            type: 'modelContent',
            path: resolvedPath,
            requestKey: msg.path,
            content: content
          });
        }
      } else if (msg.type === 'pickFile') {
        const picked = await pickNamespaceReference(document.uri);
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

  private _getHtml(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', 'domainModel');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.js'));
    const styleUri  = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.css'));
    const nonce = getNonce();

    return /* html */`<!DOCTYPE html>
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

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
