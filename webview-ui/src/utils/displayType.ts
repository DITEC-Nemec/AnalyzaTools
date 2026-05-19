import type { NamedType, SimpleTypeRef, SimpleTypeDefinition } from '../types/sqd';

/**
 * Formátuje namedType pre zobrazenie v tabuľkách a UI.
 *
 * - entityRef: "namespaceAlias:entity"
 * - typeRef: "namespaceAlias:simpleType"
 * - definition:
 *   - restriction s simpleTypeRef base: "namespaceAlias:simpleType"
 *   - restriction s primitívnym base: "base"
 */
export function displayType(namedType?: NamedType): string {
  if (!namedType) {
    return '—';
  }

  const type = namedType.type ?? 'typeRef';

  switch (type) {
    case 'entityRef': {
      const alias = namedType.entityRef?.namespaceAlias ?? '';
      const entity = namedType.entityRef?.entity ?? '';
      return alias || entity ? `${alias}:${entity}` : '—';
    }

    case 'typeRef': {
      const alias = namedType.typeRef?.namespaceAlias ?? '';
      const simpleType = namedType.typeRef?.simpleType ?? '';
      return alias || simpleType ? `${alias}:${simpleType}` : '—';
    }

    case 'definition': {
      return displaySimpleTypeDefinition(namedType.definition);
    }

    default:
      return type;
  }
}

/**
 * Formátuje SimpleTypeDefinition pre zobrazenie.
 *
 * - restriction s simpleTypeRef base: "namespaceAlias:simpleType"
 * - restriction s primitívnym base: "primitívny typ"
 */
export function displaySimpleTypeDefinition(def?: SimpleTypeDefinition): string {
  if (!def) {
    return '—';
  }

  // Restriction
  if (def.restriction) {
    const base = def.restriction.base;
    if (!base) {
      return 'restriction';
    }
    if (typeof base === 'string') {
      // Primitívny typ
      return base;
    } else {
      // SimpleTypeRef
      const ref = base as SimpleTypeRef;
      const alias = ref.namespaceAlias ?? '';
      const simpleType = ref.simpleType ?? '';
      return alias || simpleType ? `${alias}:${simpleType}` : 'restriction';
    }
  }

  return 'definition';
}
