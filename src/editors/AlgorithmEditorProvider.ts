import * as vscode from 'vscode';

/**
 * Custom Editor pre *.sqd.yaml súbory.
 * Webview UI je samostatná React aplikácia v ./webview-ui/dist/algorithm/
 */
export class AlgorithmEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sqd.algorithmEditor';

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      AlgorithmEditorProvider.viewType,
      new AlgorithmEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

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

    webviewPanel.webview.html = this._getHtml(webviewPanel.webview, 'algorithm');

    // Pošli obsah súboru do webview
    const sendContent = () => {
      webviewPanel.webview.postMessage({
        type: 'update',
        content: document.getText(),
        fileName: document.uri.path.split('/').pop() ?? document.fileName
      });
    };
    sendContent();

    // Sleduj zmeny dokumentu
    const changeDocSub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        sendContent();
      }
    });

    // Prijímaj správy z webview (edity)
    webviewPanel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'edit') {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), msg.content);
        await vscode.workspace.applyEdit(edit);
      }
    });

    webviewPanel.onDidDispose(() => changeDocSub.dispose());
  }

  private _getHtml(webview: vscode.Webview, app: 'algorithm' | 'domainModel'): string {
    const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', app);
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
  <title>SQD Algorithm Editor</title>
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
