export type SettingTool =
  | "defaults"
  | "pmset"
  | "networksetup"
  | "scutil"
  | "systemsetup"
  | "mdutil"
  | "softwareupdate";

export type ApplyAction =
  | "none"
  | "killall Finder"
  | "killall Dock"
  | "killall SystemUIServer"
  | "logout"
  | "reboot";

export type RiskLevel = "safe" | "caution" | "danger";

/** Optional in-app visualization of the user-visible effect (see `visualDemos/`). */
export type SettingVisualDemoId = "dock-icon-bounce";

export interface CommandSet {
  read: string;
  set: string;
  reset?: string;
}

export interface CliSettingCatalogItem {
  id: string;
  title: string;
  category: string;
  tool: SettingTool;
  commands: CommandSet;
  applyAction: ApplyAction;
  requiresSudo: boolean;
  riskLevel: RiskLevel;
  showInDefaultView: boolean;
  introducedIn?: string;
  notes?: string;
  visualDemo?: SettingVisualDemoId;
}
