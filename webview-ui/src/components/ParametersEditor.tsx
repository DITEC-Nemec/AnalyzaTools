import React from 'react';
import * as yaml from 'js-yaml';
import { VariableList } from '../algorithm/VariableList';
import { normalizeModelFormat } from '../domainModel/schemaNormalization';
import type { NamespaceEntity, ParameterDirection, Variable } from '../types/sqd';

type ParameterItem = Variable & { direction?: ParameterDirection };
type ModelLike = {
  entities?: Array<{ name?: string; attributes?: Array<{ name?: string; namedType?: { name?: string } }> }>;
  simpleTypes?: Array<{ name?: string }>;
};

interface VscodeApiLike {
  postMessage(msg: unknown): void;
}

export interface ParametersEditorProps {
  value: ParameterItem[];
  onChange: (value: ParameterItem[]) => void;
  useSelectsForRefs?: boolean;
  namespaceAliases?: string[];
  getAvailableEntities?: (namespaceAlias?: string) => string[];
  getAvailableAttributes?: (entityName: string, namespaceAlias?: string) => string[];
  getAvailableSimpleTypes?: (namespaceAlias?: string) => string[];
  namespaceRef?: NamespaceEntity[];
  sourceModel?: ModelLike | null;
  vscodeApi?: VscodeApiLike;
  showDirection?: boolean;
}

export const ParametersEditor: React.FC<ParametersEditorProps> = ({
  value,
  onChange,
  useSelectsForRefs,
  namespaceAliases,
  getAvailableEntities,
  getAvailableAttributes,
  getAvailableSimpleTypes,
  namespaceRef,
  sourceModel,
  vscodeApi,
  showDirection
}) => {
  const [namespaceModels, setNamespaceModels] = React.useState<Record<string, ModelLike>>({});
  const pendingNamespaceByRequestKey = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, content, requestKey } = event.data ?? {};
      if (type !== 'modelContent' || typeof content !== 'string' || typeof requestKey !== 'string') {
        return;
      }

      const alias = pendingNamespaceByRequestKey.current.get(requestKey);
      pendingNamespaceByRequestKey.current.delete(requestKey);
      if (!alias) {
        return;
      }

      try {
        const parsed = yaml.load(content);
        const normalized = normalizeModelFormat(parsed) as unknown as ModelLike;
        if (!normalized || typeof normalized !== 'object') {
          return;
        }
        setNamespaceModels((prev) => ({ ...prev, [alias]: normalized }));
      } catch {
        setNamespaceModels((prev) => {
          const next = { ...prev };
          delete next[alias];
          return next;
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  React.useEffect(() => {
    const aliasesInUse = new Set(
      (namespaceRef ?? [])
        .filter((ns) => !!ns.alias)
        .map((ns) => ns.alias)
    );

    setNamespaceModels((prev) => {
      const next: Record<string, ModelLike> = {};
      Object.entries(prev).forEach(([alias, model]) => {
        if (aliasesInUse.has(alias)) {
          next[alias] = model;
        }
      });
      return next;
    });

    if (!vscodeApi) {
      return;
    }

    (namespaceRef ?? []).forEach((ns) => {
      if (ns.sourceType !== 'model' || !ns.alias || !ns.filePath) {
        return;
      }

      pendingNamespaceByRequestKey.current.set(ns.filePath, ns.alias);
      vscodeApi.postMessage({ type: 'loadModel', path: ns.filePath });
    });
  }, [namespaceRef, vscodeApi]);

  const fallbackNamespaceAliases = React.useMemo(
    () => (namespaceRef ?? []).map((ns) => ns.alias).filter((alias): alias is string => Boolean(alias)),
    [namespaceRef]
  );

  const effectiveNamespaceAliases = namespaceAliases ?? fallbackNamespaceAliases;

  const getModelByAlias = (alias?: string): ModelLike | null => {
    if (!alias || alias === 'local') {
      return sourceModel ?? null;
    }
    return namespaceModels[alias] ?? null;
  };

  const fallbackGetAvailableEntities = (alias?: string): string[] => {
    const model = getModelByAlias(alias);
    return (model?.entities ?? []).map((entity) => entity.name).filter((name): name is string => Boolean(name));
  };

  const fallbackGetAvailableAttributes = (entityName: string, alias?: string): string[] => {
    const model = getModelByAlias(alias);
    const entity = (model?.entities ?? []).find((item) => item.name === entityName);
    return (entity?.attributes ?? [])
      .map((attribute) => attribute.namedType?.name ?? attribute.name)
      .filter((name): name is string => Boolean(name));
  };

  const fallbackGetAvailableSimpleTypes = (alias?: string): string[] => {
    const model = getModelByAlias(alias);
    return (model?.simpleTypes ?? [])
      .map((simpleType) => simpleType.name)
      .filter((name): name is string => Boolean(name));
  };

  return (
    <VariableList
      value={value}
      onChange={onChange}
      useSelectsForRefs={useSelectsForRefs ?? effectiveNamespaceAliases.length > 0}
      namespaceAliases={effectiveNamespaceAliases}
      getAvailableEntities={getAvailableEntities ?? fallbackGetAvailableEntities}
      getAvailableAttributes={getAvailableAttributes ?? fallbackGetAvailableAttributes}
      getAvailableSimpleTypes={getAvailableSimpleTypes ?? fallbackGetAvailableSimpleTypes}
      showDirection={showDirection}
    />
  );
};
