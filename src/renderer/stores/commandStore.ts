import { create } from 'zustand';

export interface SlashCommand {
  id: string;
  trigger: string;        // "/compact"
  title: string;          // "压缩上下文"
  description: string;    // "压缩当前会话上下文以释放 token"
  category: string;       // "内置" | "设置" | "工具"
  keybind?: string;       // "Ctrl+Shift+C"
  icon?: string;          // lucide 图标名
  action: () => void | Promise<void>;
}

interface CommandStore {
  commands: SlashCommand[];
  register: (cmd: SlashCommand) => void;
  unregister: (id: string) => void;
  getByTrigger: (trigger: string) => SlashCommand | undefined;
  search: (query: string) => SlashCommand[];
}

export const useCommandStore = create<CommandStore>((set, get) => ({
  commands: [],

  register: (cmd) => set((state) => ({
    commands: [...state.commands.filter((c) => c.id !== cmd.id), cmd],
  })),

  unregister: (id) => set((state) => ({
    commands: state.commands.filter((c) => c.id !== id),
  })),

  getByTrigger: (trigger) => {
    return get().commands.find((c) => c.trigger === trigger);
  },

  search: (query) => {
    const q = query.toLowerCase().replace(/^\//, '');
    if (!q) return get().commands;
    return get().commands.filter(
      (cmd) =>
        cmd.trigger.toLowerCase().includes(q) ||
        cmd.title.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q),
    );
  },
}));
