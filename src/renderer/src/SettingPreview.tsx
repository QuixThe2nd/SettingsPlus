import { Fragment, type ReactElement } from "react";
import { ArrowRight, Eye, ListTree, Search, Zap } from "lucide-react";
import type { CliSettingCatalogItem } from "@/catalog/types";
import { interpolate } from "@/shared/commandTemplate";
import { DockIconBounceDemo } from "./visualDemos/DockIconBounceDemo";

const GLYPH = { strokeWidth: 1.75 as const };

export function interpretReadout(stdout: string):
  | { kind: "bool"; value: boolean }
  | { kind: "text"; display: string }
  | { kind: "empty" } {
  const raw = stdout.trim();
  if (!raw) return { kind: "empty" };
  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] ?? raw;
  const t = last.toLowerCase();
  if (t === "1" || t === "true" || t === "yes") return { kind: "bool", value: true };
  if (t === "0" || t === "false" || t === "no") return { kind: "bool", value: false };
  const compact = last.length > 120 ? `${last.slice(0, 117)}…` : last;
  return { kind: "text", display: compact };
}

function BoolTile({
  on,
  variant,
}: {
  on: boolean;
  variant: "before" | "after";
}): ReactElement {
  return (
    <div
      className={`ss-bool-tile ss-bool-tile--${variant} ${on ? "ss-bool-tile-on" : "ss-bool-tile-off"}`}
      aria-label={on ? "On" : "Off"}
    >
      <span className="ss-bool-dot" aria-hidden />
      <span className="ss-bool-label">{on ? "On" : "Off"}</span>
    </div>
  );
}

function CmdPair({
  readLine,
  setLine,
}: {
  readLine: string;
  setLine: string;
}): ReactElement {
  return (
    <div className="ss-cmd-pair" aria-label="Read and apply shell commands">
      <div className="ss-cmd-pane">
        <div className="ss-cmd-pane-label">
          <Eye size={12} aria-hidden {...GLYPH} />
          Read
        </div>
        <pre className="ss-cmd-pre" tabIndex={0}>
          {readLine}
        </pre>
      </div>
      <ArrowRight className="ss-cmd-arrow" size={18} aria-hidden strokeWidth={2} />
      <div className="ss-cmd-pane ss-cmd-pane-apply">
        <div className="ss-cmd-pane-label">
          <Zap size={12} aria-hidden {...GLYPH} />
          Apply
        </div>
        <pre className="ss-cmd-pre" tabIndex={0}>
          {setLine}
        </pre>
      </div>
    </div>
  );
}

export function EmptyFlowVisual(): ReactElement {
  const steps = [
    { Icon: Search, label: "Find" },
    { Icon: ListTree, label: "Pick" },
    { Icon: Eye, label: "Read" },
    { Icon: Zap, label: "Apply" },
  ] as const;
  return (
    <div className="ss-flow-visual" aria-hidden>
      {steps.map(({ Icon, label }, i) => (
        <Fragment key={label}>
          <div className="ss-flow-step">
            <div className="ss-flow-icon">
              <Icon size={20} {...GLYPH} />
            </div>
            <span className="ss-flow-label">{label}</span>
          </div>
          {i < steps.length - 1 ? (
            <ArrowRight className="ss-flow-arrow" size={14} strokeWidth={2} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

type SettingPreviewProps = {
  item: CliSettingCatalogItem;
  params: Record<string, string>;
  placeholders: string[];
  lastReadStdout: string | null;
};

export function SettingPreview({
  item,
  params,
  placeholders,
  lastReadStdout,
}: SettingPreviewProps): ReactElement {
  const readI = interpolate(item.commands.read, params);
  const setI = interpolate(item.commands.set, params);
  const readLine = readI.ok ? readI.value : item.commands.read;
  const setLine = setI.ok ? setI.value : item.commands.set;

  const hasEnabled = placeholders.includes("enabled");
  const applyOn = (params.enabled ?? "true") === "true";
  const readState = lastReadStdout
    ? interpretReadout(lastReadStdout)
    : { kind: "empty" as const };

  let readBool: boolean | null = null;
  if (readState.kind === "bool") readBool = readState.value;

  const boolMismatch =
    hasEnabled && readBool !== null && readBool !== applyOn;

  const dockBounceBefore =
    item.visualDemo === "dock-icon-bounce"
      ? readState.kind === "bool"
        ? !readState.value
        : null
      : null;
  const dockBounceAfter =
    item.visualDemo === "dock-icon-bounce"
      ? (params.enabled ?? "true") === "false"
      : false;

  const beforeVisual =
    readState.kind === "empty" ? (
      <div className="ss-preview-placeholder">
        <Eye size={22} className="ss-preview-ph-icon" aria-hidden {...GLYPH} />
        <span>Run Read current</span>
      </div>
    ) : readState.kind === "bool" ? (
      <BoolTile on={readState.value} variant="before" />
    ) : (
      <div className="ss-preview-text">{readState.display}</div>
    );

  const afterVisual = hasEnabled ? (
    <BoolTile on={applyOn} variant="after" />
  ) : (
    <div className="ss-preview-text ss-preview-text-mono">{setLine}</div>
  );

  return (
    <div className="ss-preview-card">
      <div className="ss-preview-heading">Preview</div>
      {item.visualDemo === "dock-icon-bounce" ? (
        <DockIconBounceDemo
          beforeBounce={dockBounceBefore}
          afterBounce={dockBounceAfter}
        />
      ) : null}
      <div
        className={`ss-preview-strip${boolMismatch ? " ss-preview-strip--diff" : ""}`}
      >
        <div className="ss-preview-col">
          <span className="ss-preview-tag">Now</span>
          {beforeVisual}
        </div>
        <div className="ss-preview-mid" aria-hidden>
          <ArrowRight size={22} strokeWidth={2} className="ss-preview-mid-icon" />
        </div>
        <div className="ss-preview-col ss-preview-col-after">
          <span className="ss-preview-tag">After apply</span>
          {afterVisual}
        </div>
      </div>
      {boolMismatch ? (
        <p className="ss-preview-diff-note">
          Values differ — use Apply pending in the toolbar to update macOS.
        </p>
      ) : null}
      <CmdPair readLine={readLine} setLine={setLine} />
    </div>
  );
}
