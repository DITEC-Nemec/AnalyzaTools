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
exports.pickNamespaceReference = pickNamespaceReference;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const yaml = __importStar(require("js-yaml"));
const SAME_PATH_CASE_INSENSITIVE = process.platform === 'win32';
function normalizeFsPath(filePath) {
    const normalized = path.normalize(filePath);
    return SAME_PATH_CASE_INSENSITIVE ? normalized.toLowerCase() : normalized;
}
function stripYamlExtensions(fileName) {
    return fileName.replace(/(\.model|\.sqd)?\.ya?ml$/i, '');
}
function asRelativeWorkspacePath(target, fallbackBase) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fallbackBase)
        ?? vscode.workspace.getWorkspaceFolder(target);
    if (!workspaceFolder) {
        return target.fsPath.replace(/\\/g, '/');
    }
    const relative = path.relative(workspaceFolder.uri.fsPath, target.fsPath);
    return (relative || path.basename(target.fsPath)).replace(/\\/g, '/');
}
function inferTypeFromContent(content) {
    let parsed;
    try {
        parsed = yaml.load(content);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') {
        return null;
    }
    const record = parsed;
    if (record.domain && Array.isArray(record.entities)) {
        return 'model';
    }
    if (record.algorithm && Array.isArray(record.steps)) {
        return 'sqd';
    }
    return null;
}
async function inferTypeFromFile(fileUri) {
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
async function pickNamespaceReference(currentDocumentUri) {
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
    const sourceType = isCurrent ? 'current' : await inferTypeFromFile(fileUri);
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
