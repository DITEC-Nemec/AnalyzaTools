import * as vscode from 'vscode';
import { SqdTreeProvider } from './explorer/SqdTreeProvider';
import { AlgorithmEditorProvider } from './editors/AlgorithmEditorProvider';
import { DomainModelEditorProvider } from './editors/DomainModelEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // --- Explorer (sidebar) ---
  const treeProvider = new SqdTreeProvider(context);
  vscode.window.createTreeView('sqd.explorer', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  // --- Custom editors ---
  context.subscriptions.push(
    AlgorithmEditorProvider.register(context),
    DomainModelEditorProvider.register(context)
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('sqd.refreshExplorer', () => treeProvider.refresh()),

    vscode.commands.registerCommand('sqd.newAlgorithm', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Názov algoritmu', placeHolder: 'Prenos_vysledkov' });
      if (!name) { return; }
      await treeProvider.createAlgorithm(name);
    }),

    vscode.commands.registerCommand('sqd.newEntity', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Názov entity', placeHolder: 'Spracovanie' });
      if (!name) { return; }
      await treeProvider.createEntity(name);
    }),

    vscode.commands.registerCommand('sqd.importXml', async () => {
      const uris = await vscode.window.showOpenDialog({
        filters: { 'XML files': ['xml'] },
        canSelectMany: false,
        title: 'Import legacy XML'
      });
      if (!uris?.length) { return; }
      vscode.window.showInformationMessage(`SQD: Import z ${uris[0].fsPath} — TODO`);
    }),

    vscode.commands.registerCommand('sqd.exportXml', async (uri?: vscode.Uri) => {
      if (!uri) { return; }
      vscode.window.showInformationMessage(`SQD: Export ${uri.fsPath} → XML — TODO`);
    })
  );
}

export function deactivate() {}
