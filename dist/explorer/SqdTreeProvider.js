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
exports.SqdTreeProvider = exports.SqdTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class SqdTreeItem extends vscode.TreeItem {
    constructor(label, kind, resourceUri, collapsibleState = vscode.TreeItemCollapsibleState.Collapsed) {
        super(label, collapsibleState);
        this.label = label;
        this.kind = kind;
        this.resourceUri = resourceUri;
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
    _icon() {
        switch (this.kind) {
            case 'domainModel': return new vscode.ThemeIcon('symbol-class');
            case 'algorithms': return new vscode.ThemeIcon('symbol-method');
            case 'catalogs': return new vscode.ThemeIcon('book');
            case 'algorithmFile': return new vscode.ThemeIcon('symbol-interface');
            case 'domainFile': return new vscode.ThemeIcon('symbol-namespace');
            default: return new vscode.ThemeIcon('folder');
        }
    }
}
exports.SqdTreeItem = SqdTreeItem;
class SqdTreeProvider {
    constructor(context) {
        this.context = context;
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChange.event;
    }
    refresh() { this._onDidChange.fire(); }
    getTreeItem(element) { return element; }
    async getChildren(element) {
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!ws) {
            return [];
        }
        if (!element) {
            return [
                new SqdTreeItem('Domain Model', 'domainModel'),
                new SqdTreeItem('Algorithms', 'algorithms'),
                new SqdTreeItem('Catalogs', 'catalogs')
            ];
        }
        if (element.kind === 'domainModel') {
            const files = await vscode.workspace.findFiles('**/*.model.yaml');
            return files.map(f => new SqdTreeItem(path.basename(f.fsPath), 'domainFile', f, vscode.TreeItemCollapsibleState.None));
        }
        if (element.kind === 'algorithms') {
            const files = await vscode.workspace.findFiles('**/*.sqd.yaml');
            return files.map(f => new SqdTreeItem(path.basename(f.fsPath, '.sqd.yaml'), 'algorithmFile', f, vscode.TreeItemCollapsibleState.None));
        }
        if (element.kind === 'catalogs') {
            const files = await vscode.workspace.findFiles('Catalogs/**/*.yaml');
            return files.map(f => new SqdTreeItem(path.basename(f.fsPath), 'algorithmFile', f, vscode.TreeItemCollapsibleState.None));
        }
        return [];
    }
    // --- Helpers pre commands ---
    async createAlgorithm(name) {
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!ws) {
            return;
        }
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
    async createEntity(name) {
        // Otvori domain model editor – pridanie entity rieši UI
        const files = await vscode.workspace.findFiles('**/*.model.yaml');
        if (files.length) {
            await vscode.commands.executeCommand('vscode.openWith', files[0], 'sqd.domainModelEditor');
        }
        vscode.window.showInformationMessage(`Entita „${name}" – pridaj ju v Domain Model Editore.`);
    }
}
exports.SqdTreeProvider = SqdTreeProvider;
