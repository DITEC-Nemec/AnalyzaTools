import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
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
    }),

    // --- New SQD file from Explorer context menu ---
    vscode.commands.registerCommand('sqd.newSqdFile', async (folderUri?: vscode.Uri) => {
      const targetFolder = folderUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!targetFolder) { return; }

      const name = await vscode.window.showInputBox({
        prompt: 'Názov SQD súboru (bez prípony)',
        placeHolder: 'prenos_vysledkov',
        validateInput: v => v?.trim() ? undefined : 'Názov nesmie byť prázdny'
      });
      if (!name) { return; }

      const safeName = name.trim().replace(/\.sqd\.yaml$/i, '');
      const fileUri = vscode.Uri.joinPath(targetFolder, `${safeName}.sqd.yaml`);

      const content = [
        `algorithm:`,
        `  name: '${safeName}'`,
        `steps:`,
        `  - id: '1'`,
        `    type: step`,
        `    text: ''`,
      ].join('\n') + '\n';

      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
      await vscode.commands.executeCommand('vscode.openWith', fileUri, 'sqd.algorithmEditor');
    }),

    // --- New Domain Model file from Explorer context menu ---
    vscode.commands.registerCommand('sqd.newModelFile', async (folderUri?: vscode.Uri) => {
      const targetFolder = folderUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!targetFolder) { return; }

      const name = await vscode.window.showInputBox({
        prompt: 'Názov súboru doménového modelu (bez prípony)',
        placeHolder: 'ziak',
        validateInput: v => v?.trim() ? undefined : 'Názov nesmie byť prázdny'
      });
      if (!name) { return; }

      const safeName = name.trim().replace(/\.model\.yaml$/i, '');
      const fileUri = vscode.Uri.joinPath(targetFolder, `${safeName}.model.yaml`);

      const relPath = computeRelativePath(fileUri);

      const content = [
        `domain:`,
        `  name: '${safeName}'`,
        `entities: []`,
        `namespaceRef:`,
        `  - alias: local`,
        `    filePath: ${relPath}`,
        `    sourceType: current`,
      ].join('\n') + '\n';

      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
      await vscode.commands.executeCommand('vscode.openWith', fileUri, 'sqd.domainModelEditor');
    }),

    // --- Auto-update local namespace filePath on rename/move ---
    vscode.workspace.onDidRenameFiles(async (e) => {
      for (const { newUri } of e.files) {
        if (!newUri.fsPath.endsWith('.model.yaml')) { continue; }
        try {
          const doc = await vscode.workspace.openTextDocument(newUri);
          const parsed = yaml.load(doc.getText()) as Record<string, unknown>;
          if (!parsed || !Array.isArray(parsed.namespaceRef)) { continue; }

          const nsArray = parsed.namespaceRef as Array<Record<string, unknown>>;
          const localNs = nsArray.find(ns => ns.alias === 'local' && ns.sourceType === 'current');
          if (!localNs) { continue; }

          const newRelPath = computeRelativePath(newUri);
          if (localNs.filePath === newRelPath) { continue; }

          localNs.filePath = newRelPath;

          const newContent = yaml.dump(parsed, { lineWidth: -1, noRefs: true, quotingType: '"' });
          const edit = new vscode.WorkspaceEdit();
          edit.replace(newUri, new vscode.Range(0, 0, doc.lineCount, 0), newContent);
          await vscode.workspace.applyEdit(edit);
        } catch (err) {
          console.error('sqd: failed to update local namespace on rename', err);
        }
      }
    })
  );
}

export function deactivate() {}

function computeRelativePath(fileUri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  if (workspaceFolder) {
    return path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath).replace(/\\/g, '/');
  }
  return path.basename(fileUri.fsPath);
}
