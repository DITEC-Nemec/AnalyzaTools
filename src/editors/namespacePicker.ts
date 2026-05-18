import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

export type NamespaceSourceType = 'current' | 'model' | 'sqd';

export interface NamespacePickResult {
  alias: string;
  filePath: string;
  sourceType: NamespaceSourceType;
}

const SAME_PATH_CASE_INSENSITIVE = process.platform === 'win32';

function normalizeFsPath(filePath: string): string {
  const normalized = path.normalize(filePath);
  return SAME_PATH_CASE_INSENSITIVE ? normalized.toLowerCase() : normalized;
}

function stripYamlExtensions(fileName: string): string {
  return fileName.replace(/(\.model|\.sqd)?\.ya?ml$/i, '');
}

function asRelativeWorkspacePath(target: vscode.Uri, fallbackBase: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fallbackBase)
    ?? vscode.workspace.getWorkspaceFolder(target);

  if (!workspaceFolder) {
    return target.fsPath.replace(/\\/g, '/');
  }

  const relative = path.relative(workspaceFolder.uri.fsPath, target.fsPath);
  return (relative || path.basename(target.fsPath)).replace(/\\/g, '/');
}

function inferTypeFromContent(content: string): NamespaceSourceType | null {
  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (record.domain && Array.isArray(record.entities)) {
    return 'model';
  }

  if (record.algorithm && Array.isArray(record.steps)) {
    return 'sqd';
  }

  return null;
}

async function inferTypeFromFile(fileUri: vscode.Uri): Promise<NamespaceSourceType> {
  const text = await vscode.workspace.fs.readFile(fileUri);
  const content = Buffer.from(text).toString('utf8');
  const byContent = inferTypeFromContent(content);

  if (byContent) {
    return byContent;
  }

  const lower = fileUri.fsPath.toLowerCase();
  if (lower.endsWith('.model.yaml') || lower.endsWith('.model.yml')) {
    return 'model';
  }
  if (lower.endsWith('.sqd.yaml') || lower.endsWith('.sqd.yml')) {
    return 'sqd';
  }

  return 'model';
}

export async function pickNamespaceReference(currentDocumentUri: vscode.Uri): Promise<NamespacePickResult | null> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      YAML: ['yaml', 'yml']
    },
    openLabel: 'Vybrať namespace súbor'
  });

  const fileUri = selected?.[0];
  if (!fileUri) {
    return null;
  }

  const currentPath = normalizeFsPath(currentDocumentUri.fsPath);
  const selectedPath = normalizeFsPath(fileUri.fsPath);
  const isCurrent = currentPath === selectedPath;

  const sourceType: NamespaceSourceType = isCurrent ? 'current' : await inferTypeFromFile(fileUri);
  const filePath = asRelativeWorkspacePath(fileUri, currentDocumentUri);
  const alias = sourceType === 'current'
    ? 'local'
    : stripYamlExtensions(path.basename(fileUri.fsPath));

  return {
    alias,
    filePath,
    sourceType
  };
}
