import type { OpenClawPluginApi } from './plugin-api.js';
import { EdictStore } from '../store.js';
import { getDefaultToolNames, toStoreOptions } from './config.js';
import { buildBeforePromptBuildResult } from './context.js';
import { createEdictsTools } from './tools.js';
import type { EdictsPluginConfig } from './types.js';

const edictsPlugin = {
  id: 'openclaw-plugin-edicts',
  name: 'Edicts OpenClaw Integration',
  description: 'Inject Edicts store context into prompts and expose Edicts CRUD/search tools.',
  register(api: OpenClawPluginApi) {
    const pluginConfig = (api.pluginConfig ?? {}) as EdictsPluginConfig;

    api.registerTool(() => createEdictsTools(pluginConfig), {
      names: getDefaultToolNames(),
      optional: pluginConfig.tools?.optional ?? true,
    });

    api.on('before_prompt_build', async () => {
      try {
        const store = new EdictStore(toStoreOptions(pluginConfig));
        await store.load();
        const edicts = await store.all();
        return buildBeforePromptBuildResult(edicts, pluginConfig);
      }
      catch (error) {
        console.warn('[edicts] Failed to build prompt context:', error);
        return {};
      }
    });
  },
};

export default edictsPlugin;
