import { describe, expect, it } from "vitest";
import { isRemoteVersionNewer } from "./versionCompare";

describe("isRemoteVersionNewer", () => {
  it("detects newer patch", () => {
    expect(isRemoteVersionNewer("v0.1.1", "0.1.0")).toBe(true);
  });
  it("detects newer minor", () => {
    expect(isRemoteVersionNewer("0.2.0", "0.1.9")).toBe(true);
  });
  it("rejects same version", () => {
    expect(isRemoteVersionNewer("v0.1.0", "0.1.0")).toBe(false);
  });
  it("rejects older", () => {
    expect(isRemoteVersionNewer("0.0.9", "0.1.0")).toBe(false);
  });
  it("compares prerelease tag core", () => {
    expect(isRemoteVersionNewer("v1.0.0-beta.2", "0.9.0")).toBe(true);
  });
});
