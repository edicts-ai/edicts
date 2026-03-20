import type { EdictsPluginConfig, EdictsToolName } from './types.js';
import type { EdictStoreOptions } from '../types.js';

const DEFAULT_TOOL_NAMES: EdictsToolName[] = [
  'edicts_list',
  'edicts_get',
  'edicts_add',
  'edicts_update',
  'edicts_remove',
  'edicts_search',
  'edicts_stats',
];

export function getDefaultToolNames(): EdictsToolName[] {
  return [...DEFAULT_TOOL_NAMES];
}

export function normalizePluginConfig(input?: EdictsPluginConfig): Required<Pick<
  EdictsPluginConfig,
  | 'path'
  | 'format'
  | 'renderFormat'
  | 'includeSystemContext'
  | 'systemContextHeading'
  | 'emptySystemContext'
  | 'contextMaxEdicts'
>> & EdictsPluginConfig {
  const cfg = input ?? {};
  return {
    ...cfg,
    path: cfg.path ?? './edicts.yaml',
    format: cfg.format ?? (cfg.path?.endsWith('.json') ? 'json' : 'yaml'),
    renderFormat: cfg.renderFormat ?? 'markdown',
    includeSystemContext: cfg.includeSystemContext ?? true,
    systemContextHeading: cfg.systemContextHeading ?? 'Edicts',
    emptySystemContext: cfg.emptySystemContext ?? 'No edicts loaded.',
    contextMaxEdicts: cfg.contextMaxEdicts ?? 25,
  };
}

export function toStoreOptions(config?: EdictsPluginConfig): EdictStoreOptions {
  const cfg = normalizePluginConfig(config);
  return {
    path: cfg.path,
    format: cfg.format,
    maxEdicts: cfg.maxEdicts,
    tokenBudget: cfg.tokenBudget,
    categories: cfg.categories,
    staleThresholdDays: cfg.staleThresholdDays,
    categoryLimits: cfg.categoryLimits,
    defaultCategoryLimit: cfg.defaultCategoryLimit,
    defaultEphemeralTtlSeconds: cfg.defaultEphemeralTtlSeconds,
    autoSave: cfg.autoSave,
  };
}

export function resolveEnabledToolNames(config?: EdictsPluginConfig): EdictsToolName[] {
  if (config?.tools?.enabled === false) {
    return [];
  }

  const names = config?.tools?.names;
  if (!names || names.length === 0) {
    return getDefaultToolNames();
  }

  return names.filter((name, idx, arr) => DEFAULT_TOOL_NAMES.includes(name) && arr.indexOf(name) === idx);
}
