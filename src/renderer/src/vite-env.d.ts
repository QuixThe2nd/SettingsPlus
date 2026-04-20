/// <reference types="vite/client" />
/// <reference types="react" />

import type { CliSettingCatalogItem } from "@/catalog/types";

export interface SettingsPlusApi {
  readonly platform: string;
  listCatalog(): Promise<CliSettingCatalogItem[]>;
  runCli(payload: {
    id: string;
    mode: "read" | "set" | "reset";
    params: Record<string, string>;
  }): Promise<{ stdout: string; stderr: string; code: number }>;
  pickDirectory(): Promise<string | null>;
}

declare global {
  interface Window {
    settingsPlus: SettingsPlusApi;
  }
}

export {};
