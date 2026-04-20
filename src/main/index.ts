import { app, BrowserWindow, ipcMain, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { macosCliSettingsCatalog } from "../catalog/macosCliSettingsCatalog";
import type { ApplyAction, CliSettingCatalogItem } from "../catalog/types";
import { commandNeedsAdmin, runShellCommand } from "./shell";
import { validateCliParams } from "../shared/cliParamValidation";
import { interpolate } from "../shared/commandTemplate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Skip macOS-only guard (e.g. UI scaffolding on other OSes). CLI actions are unsupported off macOS. */
const allowNonDarwin = ["1", "true", "yes"].includes(
  (process.env.SETTINGSPLUS_ALLOW_NON_DARWIN ?? "").toLowerCase(),
);

function resolvePreloadPath(): string {
  const candidates = [
    path.join(__dirname, "../preload/index.mjs"),
    path.join(__dirname, "../preload/index.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const catalogById = new Map<string, CliSettingCatalogItem>(
  macosCliSettingsCatalog.map((item) => [item.id, item]),
);

function applyShellLine(action: ApplyAction): string | null {
  if (action === "none") return null;
  return action;
}

function getSettingOrThrow(id: string): CliSettingCatalogItem {
  const item = catalogById.get(id);
  if (!item) {
    throw new Error(`Unknown setting: ${id}`);
  }
  return item;
}

function buildCommand(
  item: CliSettingCatalogItem,
  mode: "read" | "set" | "reset",
  params: Record<string, string>,
): { ok: true; cmd: string } | { ok: false; error: string } {
  const template =
    mode === "read"
      ? item.commands.read
      : mode === "set"
        ? item.commands.set
        : item.commands.reset;
  if (!template) {
    return { ok: false, error: "No command for this action" };
  }
  const validated = validateCliParams(item, mode, params);
  if (!validated.ok) return validated;
  const interpolated = interpolate(template, validated.params);
  if (!interpolated.ok) return interpolated;
  return { ok: true, cmd: interpolated.value };
}

async function runCli(
  item: CliSettingCatalogItem,
  mode: "read" | "set" | "reset",
  params: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const built = buildCommand(item, mode, params);
  if (!built.ok) {
    return { stdout: "", stderr: built.error, code: 1 };
  }
  const cmd = built.cmd;
  const needsAdmin = commandNeedsAdmin(cmd);
  const first = await runShellCommand(cmd, { needsAdmin });
  if (!first.ok) {
    return { stdout: first.stdout, stderr: first.stderr, code: first.code };
  }
  if ((mode === "set" || mode === "reset") && item.applyAction !== "none") {
    const follow = applyShellLine(item.applyAction);
    if (follow) {
      const second = await runShellCommand(follow, { needsAdmin: false });
      return {
        stdout: [first.stdout, second.stdout].filter(Boolean).join("\n"),
        stderr: [first.stderr, second.stderr].filter(Boolean).join("\n"),
        code: second.ok ? 0 : second.code,
      };
    }
  }
  return { stdout: first.stdout, stderr: first.stderr, code: 0 };
}

function createWindow(): void {
  const isMac = process.platform === "darwin";
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 680,
    minWidth: 820,
    minHeight: 540,
    title: "SettingsPlus",
    show: false,
    backgroundColor: "#ececef",
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 13, y: 13 },
        }
      : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[SettingsPlus] did-fail-load", { code, desc, url });
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    const normalized = new URL(devUrl);
    normalized.pathname = "/";
    void mainWindow.loadURL(normalized.href);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function startMacApp(): void {
  app.whenReady().then(() => {
    ipcMain.handle("catalog:list", () => macosCliSettingsCatalog);

    ipcMain.handle(
      "cli:run",
      async (
        _evt,
        payload: { id: string; mode: "read" | "set" | "reset"; params: Record<string, string> },
      ) => {
        const item = getSettingOrThrow(payload.id);
        return runCli(item, payload.mode, payload.params ?? {});
      },
    );

    ipcMain.handle("dialog:pickDirectory", async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    });

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

if (process.platform !== "darwin" && !allowNonDarwin) {
  app.whenReady().then(() => {
    dialog.showErrorBox(
      "SettingsPlus",
      "SettingsPlus only runs on macOS. It applies preferences using macOS command-line tools (defaults, pmset, networksetup, and others).",
    );
    app.quit();
  });
} else {
  startMacApp();
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
