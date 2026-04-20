import type { ReactElement } from "react";
import type { SettingTool } from "@/catalog/types";
import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Battery,
  Camera,
  Download,
  FolderOpen,
  Globe,
  Keyboard,
  LayoutGrid,
  Lock,
  MousePointerClick,
  Search,
  Server,
  Settings2,
  SlidersHorizontal,
  Terminal,
  Wifi,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Finder: FolderOpen,
  Dock: AppWindow,
  "Global UI and Input": Keyboard,
  "Trackpad and Mouse": MousePointerClick,
  Screenshots: Camera,
  "Login Window": Lock,
  "Power Management": Battery,
  "Network Services": Wifi,
  "Host and Discovery": Server,
  Spotlight: Search,
  "Software Update": Download,
};

const TOOL_ICONS: Record<SettingTool, LucideIcon> = {
  defaults: SlidersHorizontal,
  pmset: Battery,
  networksetup: Wifi,
  scutil: Globe,
  systemsetup: Settings2,
  mdutil: Search,
  softwareupdate: Download,
};

export const TOOL_LABEL: Record<SettingTool, string> = {
  defaults: "defaults",
  pmset: "pmset",
  networksetup: "networksetup",
  scutil: "scutil",
  systemsetup: "systemsetup",
  mdutil: "mdutil",
  softwareupdate: "softwareupdate",
};

/** One-line context for the inspector panel */
export const TOOL_SUMMARY: Record<SettingTool, string> = {
  defaults: "Reads or writes macOS preference domains (.plist keys).",
  pmset: "Controls sleep, wake, and battery power settings.",
  networksetup: "Configures network locations, DNS, and interfaces.",
  scutil: "Edits system configuration databases (hostname, DNS, etc.).",
  systemsetup: "Sets machine-wide options such as time zone and sleep.",
  mdutil: "Manages Spotlight indexing on volumes.",
  softwareupdate: "Lists and installs Apple software updates.",
};

const GLYPH = { strokeWidth: 1.75 as const };

export function CategoryIcon({
  category,
  size = 18,
  className,
}: {
  category: string;
  size?: number;
  className?: string;
}): ReactElement {
  const Icon = CATEGORY_ICONS[category] ?? Settings2;
  return <Icon size={size} className={className} aria-hidden {...GLYPH} />;
}

export function ToolIcon({
  tool,
  size = 16,
  className,
}: {
  tool: SettingTool;
  size?: number;
  className?: string;
}): ReactElement {
  const Icon = TOOL_ICONS[tool];
  return <Icon size={size} className={className} aria-hidden {...GLYPH} />;
}

export function AllCategoriesIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}): ReactElement {
  return <LayoutGrid size={size} className={className} aria-hidden {...GLYPH} />;
}

export function RunSectionIcon({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}): ReactElement {
  return <Terminal size={size} className={className} aria-hidden {...GLYPH} />;
}
