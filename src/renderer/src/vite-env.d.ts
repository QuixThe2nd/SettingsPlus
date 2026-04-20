/// <reference types="vite/client" />
/// <reference types="react" />

import type { CliSettingCatalogItem } from "@/catalog/types";
import type { UpdateCheckResult } from "@/shared/updateCheckResult";

export interface SettingsPlusApi {
  readonly platform: string;
  listCatalog(): Promise<CliSettingCatalogItem[]>;
  runCli(payload: {
    id: string;
    mode: "read" | "set" | "reset";
    params: Record<string, string>;
  }): Promise<{ stdout: string; stderr: string; code: number }>;
  pickDirectory(): Promise<string | null>;
  checkForAppUpdates(): Promise<UpdateCheckResult>;
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    settingsPlus: SettingsPlusApi;
  }
}

export {};
