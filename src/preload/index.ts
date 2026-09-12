// Preload script for WordSetu.
// Runs in an isolated context and exposes a minimal, typed API to the renderer
// via the contextBridge. The dictionary IPC surface is added in later features;
// for now only static metadata is exposed to prove the bridge is wired.
import { contextBridge } from 'electron';
import { APP_NAME, APP_VERSION } from '../shared/constants';

export interface WordSetuApi {
  readonly appName: string;
  readonly appVersion: string;
}

const api: WordSetuApi = {
  appName: APP_NAME,
  appVersion: APP_VERSION,
};

contextBridge.exposeInMainWorld('wordsetu', api);
