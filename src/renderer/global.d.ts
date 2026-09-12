// Global type augmentation so the renderer sees a fully typed window.wordsetu.
// The concrete implementation is provided by the preload script via
// contextBridge.exposeInMainWorld. The renderer never touches ipcRenderer or
// any Node API directly.

import type { WordSetuApi } from '../shared/api';

declare global {
  interface Window {
    readonly wordsetu: WordSetuApi;
  }
}

export {};
