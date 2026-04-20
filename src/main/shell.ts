import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

function stripSudo(cmd: string): string {
  return cmd.replace(/\bsudo\s+/g, "");
}

export async function runShellCommand(
  script: string,
  options: { needsAdmin: boolean },
): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  const scriptToRun = options.needsAdmin ? stripSudo(script) : script;
  let adminScriptPath: string | null = null;
  try {
    if (options.needsAdmin) {
      const tmpSh = path.join(
        os.tmpdir(),
        `settingsplus-${process.pid}-${Date.now()}.sh`,
      );
      adminScriptPath = tmpSh;
      await fs.writeFile(
        tmpSh,
        `#!/bin/bash\nset -euo pipefail\n${scriptToRun}\n`,
        { mode: 0o700 },
      );
      const quotedPath = tmpSh.replace(/'/g, `'\\''`);
      const appleScript = `do shell script "bash '${quotedPath}'" with administrator privileges`;
      const { stdout, stderr } = await execFileAsync("osascript", ["-e", appleScript], {
        maxBuffer: 32 * 1024 * 1024,
      });
      return {
        ok: true,
        stdout: stdout.toString(),
        stderr: stderr?.toString() ?? "",
        code: 0,
      };
    }
    const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", scriptToRun], {
      maxBuffer: 32 * 1024 * 1024,
    });
    return {
      ok: true,
      stdout: stdout.toString(),
      stderr: stderr?.toString() ?? "",
      code: 0,
    };
  } catch (err: unknown) {
    const e = err as {
      code?: number;
      stdout?: Buffer;
      stderr?: Buffer;
      message?: string;
    };
    return {
      ok: false,
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? e.message ?? "Command failed",
      code: typeof e.code === "number" ? e.code : 1,
    };
  } finally {
    if (adminScriptPath) await fs.unlink(adminScriptPath).catch(() => {});
  }
}

export function commandNeedsAdmin(cmd: string): boolean {
  return /(^|\s)sudo(\s|$)/.test(cmd);
}
