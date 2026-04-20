import { readFileSync } from "node:fs";
import path from "node:path";
import type { App } from "electron";
import { isRemoteVersionNewer } from "../shared/versionCompare";
import type { UpdateCheckResult } from "../shared/updateCheckResult";

type GitHubLatestRelease = {
  tag_name: string;
  html_url: string;
  published_at: string | null;
};

export function readGitHubRepoSlug(app: App): string {
  try {
    const raw = readFileSync(path.join(app.getAppPath(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { repository?: { url?: string } };
    const url = pkg.repository?.url ?? "";
    const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
    if (m) return `${m[1]}/${m[2].replace(/\.git$/i, "")}`;
  } catch {
    /* ignore */
  }
  return "QuixThe2nd/SettingsPlus";
}

async function fetchLatestRelease(
  repoSlug: string,
  appVersion: string,
): Promise<GitHubLatestRelease | null> {
  const url = `https://api.github.com/repos/${repoSlug}/releases/latest`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `SettingsPlus/${appVersion} (Electron)`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = (await res.json()) as Partial<GitHubLatestRelease>;
  if (typeof body.tag_name !== "string" || typeof body.html_url !== "string") {
    return null;
  }
  return {
    tag_name: body.tag_name,
    html_url: body.html_url,
    published_at: typeof body.published_at === "string" ? body.published_at : null,
  };
}

export async function checkGitHubForNewerRelease(
  app: App,
): Promise<UpdateCheckResult> {
  const current = app.getVersion();
  const repo = readGitHubRepoSlug(app);
  try {
    const latest = await fetchLatestRelease(repo, current);
    if (!latest) return { status: "up_to_date" };
    if (!isRemoteVersionNewer(latest.tag_name, current)) {
      return { status: "up_to_date" };
    }
    return {
      status: "update_available",
      latestVersion: latest.tag_name.replace(/^v/i, ""),
      htmlUrl: latest.html_url,
      publishedAt: latest.published_at,
    };
  } catch {
    return { status: "check_failed" };
  }
}
