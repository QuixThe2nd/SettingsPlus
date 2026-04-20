import type { ReactElement } from "react";

/**
 * Visual for `com.apple.dock` `no-bouncing`: when the plist is true, launch
 * bounce is off; when false, the Dock tile bounces.
 */
export function DockIconBounceDemo({
  beforeBounce,
  afterBounce,
}: {
  /** `true` = icon bounce on launch; `null` = not read yet */
  beforeBounce: boolean | null;
  /** Same, from current Apply parameters */
  afterBounce: boolean;
}): ReactElement {
  return (
    <div
      className="ss-vdemo ss-vdemo-dock-bounce"
      role="group"
      aria-label="Dock launch bounce, now versus after apply"
    >
      <div className="ss-vdemo-caption">When an app opens from the Dock</div>
      <div className="ss-vdemo-row">
        <DockStrip
          label="Now"
          bounce={beforeBounce}
          unknown={beforeBounce === null}
        />
        <DockStrip label="After apply" bounce={afterBounce} unknown={false} />
      </div>
    </div>
  );
}

function DockStrip({
  label,
  bounce,
  unknown,
}: {
  label: string;
  bounce: boolean | null;
  unknown: boolean;
}): ReactElement {
  const animating = !unknown && bounce === true;
  const foot = unknown
    ? "Run Read current"
    : bounce
      ? "Bounces"
      : "Stays put";

  return (
    <div
      className={`ss-dock-strip${unknown ? " ss-dock-strip-unknown" : ""}`}
    >
      <span className="ss-dock-strip-label">{label}</span>
      <div className="ss-dock-bar" aria-hidden>
        <span className="ss-dock-dot" />
        <span
          className={`ss-dock-dot ss-dock-dot-app${animating ? " ss-dock-dot-bounce" : ""}`}
        />
        <span className="ss-dock-dot" />
      </div>
      <span className="ss-dock-foot">{foot}</span>
    </div>
  );
}
