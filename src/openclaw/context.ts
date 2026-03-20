import { renderJson, renderMarkdown, renderPlain } from '../renderer.js';
import type { Edict } from '../types.js';
import type { EdictsPluginConfig, BeforePromptBuildResult, PromptContextSelection } from './types.js';
import { normalizePluginConfig } from './config.js';

export function selectEdictsForPrompt(edicts: Edict[], selection?: PromptContextSelection): Edict[] {
  let filtered = [...edicts];

  if (selection?.categories && selection.categories.length > 0) {
    const categories = new Set(selection.categories.map((value) => value.trim().toLowerCase()).filter(Boolean));
    filtered = filtered.filter((edict) => categories.has(edict.category));
  }

  if (selection?.tags && selection.tags.length > 0) {
    const tags = new Set(selection.tags.map((value) => value.trim().toLowerCase()).filter(Boolean));
    filtered = filtered.filter((edict) => edict.tags.some((tag) => tags.has(tag)));
  }

  if (selection?.confidence && selection.confidence.length > 0) {
    const confidence = new Set(selection.confidence);
    filtered = filtered.filter((edict) => confidence.has(edict.confidence));
  }

  filtered.sort((a, b) => {
    const aTime = new Date(a.updated ?? a.created).getTime();
    const bTime = new Date(b.updated ?? b.created).getTime();
    return bTime - aTime;
  });

  const maxEdicts = selection?.maxEdicts;
  if (typeof maxEdicts === 'number' && maxEdicts >= 0) {
    filtered = filtered.slice(0, maxEdicts);
  }

  return filtered;
}

export function renderPromptContext(edicts: Edict[], config?: EdictsPluginConfig): string {
  const cfg = normalizePluginConfig(config);
  if (edicts.length === 0) {
    return cfg.emptySystemContext;
  }

  switch (cfg.renderFormat) {
    case 'plain':
      return renderPlain(edicts);
    case 'json':
      return renderJson(edicts);
    case 'markdown':
    default:
      return renderMarkdown(edicts);
  }
}

export function buildBeforePromptBuildResult(edicts: Edict[], config?: EdictsPluginConfig): BeforePromptBuildResult {
  const cfg = normalizePluginConfig(config);
  if (!cfg.includeSystemContext) {
    return {};
  }

  const selected = selectEdictsForPrompt(edicts, {
    categories: cfg.contextCategories,
    tags: cfg.contextTags,
    confidence: cfg.contextConfidence,
    maxEdicts: cfg.contextMaxEdicts,
  });

  const body = renderPromptContext(selected, cfg);
  const heading = cfg.systemContextHeading.trim();
  const prependSystemContext = heading ? `${heading}:\n${body}` : body;

  return { prependSystemContext };
}
