export interface OpenClawTool {
  name: string;
  description: string;
  parameters: unknown;
  execute: (id: string, params: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}

export interface OpenClawPluginApi {
  pluginConfig?: unknown;
  registerTool: (tool: OpenClawTool[] | OpenClawTool | (() => OpenClawTool[] | OpenClawTool | null), opts?: { names?: string[]; optional?: boolean }) => void;
  on: (hookName: 'before_prompt_build', handler: (event?: unknown, ctx?: unknown) => Promise<unknown> | unknown, opts?: { priority?: number }) => void;
}
