/* eslint-disable no-control-regex -- intentional ASCII control checks for shell safety */
import type { CliSettingCatalogItem } from "../catalog/types";
import { extractPlaceholders } from "./commandTemplate";

const MAX_PATH = 4096;
const MAX_LABEL = 255;
const MAX_LOGIN_TEXT = 500;
const MAX_PREFIX = 120;

function err(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function ok(value: string): { ok: true; value: string } {
  return { ok: true, value };
}

/** Integers safe for defaults / pmset flags (no shell metacharacters). */
function parseStrictInt(raw: string, min: number, max: number): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!/^-?\d+$/.test(t)) return err("Expected an integer.");
  const n = Number(t);
  if (!Number.isFinite(n) || n < min || n > max) return err(`Integer must be between ${min} and ${max}.`);
  return ok(t);
}

function parseStrictUInt(raw: string, max: number): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return err("Expected a non-negative integer.");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max) return err(`Must be between 0 and ${max}.`);
  return ok(t);
}

function parseStrictFloat(raw: string, min: number, max: number): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return err("Expected a number.");
  const n = Number(t);
  if (!Number.isFinite(n) || n < min || n > max) return err(`Must be between ${min} and ${max}.`);
  return ok(t);
}

/** Relaxed IPv6 check: hex/colon only, reasonable length. */
const IPV6 = /^[0-9a-fA-F:]{2,128}$/;

function isIpv4(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false;
  return m.slice(1, 5).every((oct) => {
    const n = Number(oct);
    return n >= 0 && n <= 255;
  });
}

function isIpToken(s: string): boolean {
  if (isIpv4(s)) return true;
  if (!s.includes(":")) return false;
  return IPV6.test(s);
}

function validateDnsList(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length > 512) return err("DNS list is too long.");
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return err("Enter at least one DNS server IP.");
  for (const p of parts) {
    if (!isIpToken(p)) return err(`Invalid DNS server: ${p}`);
  }
  return ok(parts.join(" "));
}

function validateDomainList(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length > 1024) return err("Domain list is too long.");
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return err("Enter at least one search domain.");
  const domainRe = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  for (const p of parts) {
    if (p.length > 253 || !domainRe.test(p)) return err(`Invalid domain: ${p}`);
  }
  return ok(parts.join(" "));
}

function validateAbsolutePath(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length === 0) return err("Path is required.");
  if (t.length > MAX_PATH) return err("Path is too long.");
  if (t.includes("\0")) return err("Path contains invalid characters.");
  if (!t.startsWith("/")) return err("Path must be absolute (start with /).");
  if (t.includes("~")) return err("Do not use ~ in paths; use an absolute path.");
  if (/[\x00-\x1f$`"'|;<>\\]/.test(t)) return err("Path contains invalid characters.");
  const norm = t.replace(/\/+/g, "/");
  if (/\/\.\.(\/|$)/.test(norm) || norm.endsWith("/..") || norm === "..") {
    return err("Path must not contain parent directory segments.");
  }
  return ok(norm);
}

function validateNetworkService(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > 128) return err("Network service name length must be 1–128.");
  if (!/^[A-Za-z0-9_. \-()]+$/.test(t)) return err("Network service name has invalid characters.");
  return ok(t);
}

function validateOnOff(raw: string, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim().toLowerCase();
  if (t !== "on" && t !== "off") return err(`${label} must be on or off.`);
  return ok(t);
}

function validateWifiDevice(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!/^en[0-9]+$/i.test(t)) return err("Device must look like en0 (Wi‑Fi interface).");
  return ok(t.toLowerCase());
}

function validateVolume(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "/") return ok("/");
  if (t.length < 2 || t.length > MAX_PATH) return err("Invalid volume path.");
  if (!t.startsWith("/")) return err("Volume must be / or an absolute path.");
  if (t.includes("\0") || /[$`"'|;<>\\]/.test(t)) return err("Volume path has invalid characters.");
  return ok(t.replace(/\/+/g, "/"));
}

function validateHost(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > 253) return err("Host length invalid.");
  if (isIpToken(t)) return ok(t);
  if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(t)) {
    return ok(t);
  }
  return err("Host must be a hostname or IP address.");
}

function validatePort(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return err("Port must be a number.");
  const n = Number(t);
  if (n < 1 || n > 65535) return err("Port must be 1–65535.");
  return ok(t);
}

function validateTimezone(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > 128) return err("Timezone string too long or empty.");
  if (!/^[A-Za-z0-9_/+.-]+$/.test(t)) return err("Timezone has invalid characters.");
  return ok(t);
}

function validateScrollBarMode(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  const allowed = new Set(["Always", "Automatic", "WhenScrolling"]);
  if (!allowed.has(t)) return err('Mode must be Always, Automatic, or WhenScrolling.');
  return ok(t);
}

function validateHibernateMode(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!/^\d{1,2}$/.test(t)) return err("Hibernation mode must be a 1–2 digit number.");
  const n = Number(t);
  if (n < 0 || n > 99) return err("Hibernation mode must be 0–99.");
  return ok(t);
}

function validateAdminHostInfo(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > 64) return err("Value length must be 1–64.");
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(t)) {
    return err("Use letters, numbers, underscore, or hyphen (Apple login window info types).");
  }
  return ok(t);
}

function validateComputerName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > MAX_LABEL) return err(`Name length must be 1–${MAX_LABEL}.`);
  // Allow apostrophe in friendly names; still block shell metacharacters for unquoted interpolation.
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f$`"\\;&|<>()]/.test(t)) {
    return err("Name contains characters that are not allowed.");
  }
  return ok(t);
}

function validateHostName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim().toLowerCase();
  if (t.length < 1 || t.length > 253) return err("Host name length invalid.");
  const labels = t.split(".").filter((l) => l.length > 0);
  if (labels.length === 0) return err("Host name must not be empty.");
  const labelOk = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  for (const label of labels) {
    if (!labelOk.test(label)) return err("Host name must be a valid DNS hostname (lowercase).");
  }
  return ok(t);
}

function validateLocalHostName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length < 1 || t.length > 63) return err("Local host name length must be 1–63.");
  if (!/^[a-zA-Z0-9-]+$/.test(t)) return err("Local host name may only contain letters, numbers, and hyphens.");
  return ok(t);
}

function validateLoginWindowText(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length > MAX_LOGIN_TEXT) return err(`Message must be at most ${MAX_LOGIN_TEXT} characters.`);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f$`"'|\\;&<>()]/.test(t)) {
    return err("Message contains characters that are not allowed.");
  }
  return ok(t);
}

function validateScreenshotPrefix(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (t.length > MAX_PREFIX) return err(`Prefix must be at most ${MAX_PREFIX} characters.`);
  if (!/^[a-zA-Z0-9 _().-]*$/.test(t)) return err("Prefix may only use letters, numbers, spaces, and simple punctuation.");
  return ok(t);
}

const FORMATS = new Set(["png", "jpg", "jpeg", "gif", "tiff", "pdf", "bmp", "heic"]);

function validateScreenshotFormat(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim().toLowerCase();
  if (!FORMATS.has(t)) return err(`Format must be one of: ${[...FORMATS].sort().join(", ")}.`);
  return ok(t);
}

function validateEnabled(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = raw.trim().toLowerCase();
  if (t !== "true" && t !== "false") return err("Toggle must be true or false.");
  return ok(t);
}

function validateParam(
  key: string,
  raw: string,
  item: CliSettingCatalogItem,
): { ok: true; value: string } | { ok: false; error: string } {
  switch (key) {
    case "enabled":
      return validateEnabled(raw);
    case "seconds":
      return parseStrictFloat(raw, 0, 1e7);
    case "minutes":
      return parseStrictUInt(raw, 10_080); // 1 week in minutes
    case "value": {
      if (item.id === "loginwindow.admin-host-info") return validateAdminHostInfo(raw);
      if (item.id === "host.computer-name") return validateComputerName(raw);
      if (item.id === "host.host-name") return validateHostName(raw);
      if (item.id === "host.local-host-name") return validateLocalHostName(raw);
      if (
        item.id === "pmset.womp" ||
        item.id === "pmset.standby" ||
        item.id === "pmset.powernap" ||
        item.id === "pmset.tcpkeepalive" ||
        item.id === "pmset.autopoweroff"
      ) {
        return parseStrictInt(raw, 0, 1);
      }
      if (item.id === "global.key-repeat") return parseStrictInt(raw, 1, 120);
      if (item.id === "global.initial-key-repeat") return parseStrictInt(raw, 15, 120);
      if (item.id === "global.full-keyboard-access") return parseStrictInt(raw, 0, 3);
      if (item.id === "trackpad.tap-behavior-current-host") return parseStrictInt(raw, 0, 2);
      if (item.id === "trackpad.secondary-click-corner") return parseStrictInt(raw, 0, 4);
      return parseStrictInt(raw, -2_147_483_648, 2_147_483_647);
    }
    case "mode":
      if (item.id === "global.scroll-bars") return validateScrollBarMode(raw);
      if (item.id === "pmset.hibernatemode") return validateHibernateMode(raw);
      return err("Unknown mode parameter for this setting.");
    case "format":
      return validateScreenshotFormat(raw);
    case "absolutePath":
      return validateAbsolutePath(raw);
    case "prefix":
      return validateScreenshotPrefix(raw);
    case "text":
      return validateLoginWindowText(raw);
    case "networkService":
      return validateNetworkService(raw);
    case "dnsList":
      return validateDnsList(raw);
    case "domainList":
      return validateDomainList(raw);
    case "host":
      return validateHost(raw);
    case "port":
      return validatePort(raw);
    case "timezone":
      return validateTimezone(raw);
    case "state":
      if (item.id === "softwareupdate.schedule") return validateOnOff(raw, "Schedule");
      if (
        item.id.startsWith("network.") ||
        item.id.startsWith("host.remote") ||
        item.tool === "mdutil"
      ) {
        return validateOnOff(raw, "State");
      }
      return validateOnOff(raw, "State");
    case "device":
      return validateWifiDevice(raw);
    case "volume":
      return validateVolume(raw);
    default:
      return err(`Unsupported parameter: ${key}`);
  }
}

export function getCommandTemplate(
  item: CliSettingCatalogItem,
  mode: "read" | "set" | "reset",
): string | null {
  if (mode === "read") return item.commands.read;
  if (mode === "set") return item.commands.set;
  return item.commands.reset ?? null;
}

/**
 * Validates only placeholders present in the command template for the given item/mode.
 * Returns sanitized values (trimmed / normalized where applicable).
 */
export function validateCliParams(
  item: CliSettingCatalogItem,
  mode: "read" | "set" | "reset",
  params: Record<string, string>,
): { ok: true; params: Record<string, string> } | { ok: false; error: string } {
  const template = getCommandTemplate(item, mode);
  if (!template) return err("No command for this action");
  const keys = extractPlaceholders(template);
  const next: Record<string, string> = { ...params };
  for (const key of keys) {
    const raw = params[key];
    if (raw === undefined) return err(`Missing values for: ${key}`);
    const r = validateParam(key, raw, item);
    if (!r.ok) return { ok: false, error: `${key}: ${r.error}` };
    next[key] = r.value;
  }
  return { ok: true, params: next };
}
