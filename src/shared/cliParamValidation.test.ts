import { describe, expect, it } from "vitest";
import { macosCliSettingsCatalog } from "../catalog/macosCliSettingsCatalog";
import type { CliSettingCatalogItem } from "../catalog/types";
import { validateCliParams } from "./cliParamValidation";

function item(id: string): CliSettingCatalogItem {
  const found = macosCliSettingsCatalog.find((i) => i.id === id);
  if (!found) throw new Error(`missing catalog id ${id}`);
  return found;
}

describe("validateCliParams", () => {
  it("rejects command injection in dnsList", () => {
    const r = validateCliParams(item("network.dns-servers"), "set", {
      networkService: "Wi-Fi",
      dnsList: "8.8.8.8; rm -rf /",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("dnsList");
  });

  it("accepts valid dnsList", () => {
    const r = validateCliParams(item("network.dns-servers"), "set", {
      networkService: "Wi-Fi",
      dnsList: "  8.8.8.8   8.8.4.4 ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.params.dnsList).toBe("8.8.8.8 8.8.4.4");
  });

  it("rejects semicolon in absolutePath", () => {
    const r = validateCliParams(item("screencapture.location"), "set", {
      absolutePath: "/tmp/foo;rm -rf /",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts absolute folder path with space", () => {
    const r = validateCliParams(item("screencapture.location"), "set", {
      absolutePath: "/Users/test/My Screenshots",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.params.absolutePath).toBe("/Users/test/My Screenshots");
  });

  it("validates scroll bar mode allowlist", () => {
    const scroll = item("global.scroll-bars");
    expect(validateCliParams(scroll, "set", { mode: "Always" }).ok).toBe(true);
    expect(validateCliParams(scroll, "set", { mode: "3" }).ok).toBe(false);
  });

  it("validates hibernate mode as digits", () => {
    const h = item("pmset.hibernatemode");
    expect(validateCliParams(h, "set", { mode: "3" }).ok).toBe(true);
    expect(validateCliParams(h, "set", { mode: "Automatic" }).ok).toBe(false);
  });

  it("requires enabled boolean", () => {
    const r = validateCliParams(item("finder.show-path-bar"), "set", {
      enabled: "yes",
    });
    expect(r.ok).toBe(false);
  });
});
