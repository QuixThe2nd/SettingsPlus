import { contextBridge, ipcRenderer } from "electron";
import type { CliSettingCatalogItem } from "../catalog/types";

contextBridge.exposeInMainWorld("settingsPlus", {
  platform: process.platform,
  listCatalog: (): Promise<CliSettingCatalogItem[]> =>
    ipcRenderer.invoke("catalog:list"),
  runCli: (payload: {
    id: string;
    mode: "read" | "set" | "reset";
    params: Record<string, string>;
  }): Promise<{ stdout: string; stderr: string; code: number }> =>
    ipcRenderer.invoke("cli:run", payload),
  pickDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:pickDirectory"),
});
