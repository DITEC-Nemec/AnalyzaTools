import uiSchema from './ui-schema.json';

type Dict = Record<string, unknown>;

function getByPath(source: unknown, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Dict)[segment];
  }

  return current;
}

export function label(path: string, fallback: string): string {
  const value = getByPath(uiSchema, path);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const uiLabels = uiSchema;
