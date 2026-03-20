export type EdictsToolName =
  | 'edicts_list'
  | 'edicts_get'
  | 'edicts_add'
  | 'edicts_update'
  | 'edicts_remove'
  | 'edicts_search'
  | 'edicts_stats';

export interface EdictsPluginConfig {
  path?: string;
  format?: 'yaml' | 'json';
  maxEdicts?: number;
  tokenBudget?: number;
  categories?: string[];
  staleThresholdDays?: number;
  categoryLimits?: Record<string, number>;
  defaultCategoryLimit?: number;
  defaultEphemeralTtlSeconds?: number;
  autoSave?: boolean;
  renderFormat?: 'plain' | 'markdown' | 'json';
  includeSystemContext?: boolean;
  systemContextHeading?: string;
  emptySystemContext?: string;
  contextMaxEdicts?: number;
  contextCategories?: string[];
  contextTags?: string[];
  contextConfidence?: Array<'verified' | 'inferred' | 'user'>;
  tools?: {
    enabled?: boolean;
    names?: EdictsToolName[];
    optional?: boolean;
  };
}

export interface BeforePromptBuildResult {
  prependSystemContext?: string;
  appendSystemContext?: string;
}

export interface PromptContextSelection {
  categories?: string[];
  tags?: string[];
  confidence?: Array<'verified' | 'inferred' | 'user'>;
  maxEdicts?: number;
}
