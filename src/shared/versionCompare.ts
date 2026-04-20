/** Strip leading "v" and prerelease suffix for simple x.y.z comparison. */
function coreVersion(semverLike: string): string {
  return semverLike.trim().replace(/^v/i, "").split("-")[0].trim();
}

function parseCoreParts(version: string): [number, number, number] | null {
  const m = coreVersion(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True if `remoteTag` names a version strictly newer than `currentVersion` (app). */
export function isRemoteVersionNewer(remoteTag: string, currentVersion: string): boolean {
  const r = parseCoreParts(remoteTag);
  const c = parseCoreParts(currentVersion);
  if (!r || !c) return false;
  if (r[0] !== c[0]) return r[0] > c[0];
  if (r[1] !== c[1]) return r[1] > c[1];
  return r[2] > c[2];
}
