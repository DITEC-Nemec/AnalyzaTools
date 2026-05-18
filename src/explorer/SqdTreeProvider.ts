import * as vscode from 'vscode';
import * as path from 'path';

export type SqdNodeKind = 'root' | 'domainModel' | 'algorithms' | 'catalogs' | 'algorithmFile' | 'domainFile';

export class SqdTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: SqdNodeKind,
    public readonly resourceUri?: vscode.Uri,
    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
  ) {
    super(label, collapsibleState);
    this.contextValue = kind;
    if (resourceUri) {
      this.resourceUri = resourceUri;
      this.command = {
        command: 'vscode.openWith',
        title: 'Open',
        arguments: [
          resourceUri,
          kind === 'algorithmFile' ? 'sqd.algorithmEditor' : 'sqd.domainModelEditor'
        ]
      };
    }
    this.iconPath = this._icon();
  }

  private _icon(): vscode.ThemeIcon {
    switch (this.kind) {
      case 'domainModel':    return new vscode.ThemeIcon('symbol-class');
      case 'algorithms':     return new vscode.ThemeIcon('symbol-method');
      case 'catalogs':       return new vscode.ThemeIcon('book');
      case 'algorithmFile':  return new vscode.ThemeIcon('symbol-interface');
      case 'domainFile':     return new vscode.ThemeIcon('symbol-namespace');
      default:               return new vscode.ThemeIcon('folder');
    }
  }
}

export class SqdTreeProvider implements vscode.TreeDataProvider<SqdTreeItem> {
  private _onDidChange = new vscode.EventEmitter<SqdTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void { this._onDidChange.fire(); }

  getTreeItem(element: SqdTreeItem): vscode.TreeItem { return element; }

  async getChildren(element?: SqdTreeItem): Promise<SqdTreeItem[]> {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!ws) { return []; }

    if (!element) {
      return [
        new SqdTreeItem('Domain Model', 'domainModel'),
        new SqdTreeItem('Algorithms',   'algorithms'),
        new SqdTreeItem('Catalogs',     'catalogs')
      ];
    }

    if (element.kind === 'domainModel') {
      const files = await vscode.workspace.findFiles('**/*.model.yaml');
      return files.map(f => new SqdTreeItem(
        path.basename(f.fsPath), 'domainFile', f,
        vscode.TreeItemCollapsibleState.None
      ));
    }

    if (element.kind === 'algorithms') {
      const files = await vscode.workspace.findFiles('**/*.sqd.yaml');
      return files.map(f => new SqdTreeItem(
        path.basename(f.fsPath, '.sqd.yaml'), 'algorithmFile', f,
        vscode.TreeItemCollapsibleState.None
      ));
    }

    if (element.kind === 'catalogs') {
      const files = await vscode.workspace.findFiles('Catalogs/**/*.yaml');
      return files.map(f => new SqdTreeItem(
        path.basename(f.fsPath), 'algorithmFile', f,
        vscode.TreeItemCollapsibleState.None
      ));
    }

    return [];
  }

  // --- Helpers pre commands ---

  async createAlgorithm(name: string): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!ws) { return; }
    const uri = vscode.Uri.joinPath(ws, 'Algoritm', `${name}.sqd.yaml`);
    const content = [
      `algorithm:`,
      `  name: ${name}`,
      `  description: ""`,
      `  inputs: []`,
      `steps:`,
      `  - id: "1"`,
      `    type: operation`,
      `    text: ""`,
    ].join('\n');
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    this.refresh();
    await vscode.commands.executeCommand('vscode.openWith', uri, 'sqd.algorithmEditor');
  }

  async createEntity(name: string): Promise<void> {
    // Otvori domain model editor – pridanie entity rieši UI
    const files = await vscode.workspace.findFiles('**/*.model.yaml');
    if (files.length) {
      await vscode.commands.executeCommand('vscode.openWith', files[0], 'sqd.domainModelEditor');
    }
    vscode.window.showInformationMessage(`Entita „${name}" – pridaj ju v Domain Model Editore.`);
  }
}
