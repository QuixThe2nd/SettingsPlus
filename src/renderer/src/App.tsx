import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronRight, Download, Shield, Sparkles, X } from "lucide-react";
import type { CliSettingCatalogItem } from "@/catalog/types";
import { unionPlaceholders } from "@/shared/commandTemplate";
import {
  AllCategoriesIcon,
  CategoryIcon,
  RunSectionIcon,
  TOOL_LABEL,
  TOOL_SUMMARY,
  ToolIcon,
} from "./catalogVisuals";
import { EmptyFlowVisual, SettingPreview } from "./SettingPreview";
import type { UpdateCheckResult } from "@/shared/updateCheckResult";

const ALL = "__all__";
const UPDATE_DISMISS_PREFIX = "sp-dismiss-update:";

const DEFAULT_PARAMS: Record<string, string> = {
  enabled: "true",
  networkService: "Wi-Fi",
  device: "en0",
  volume: "/",
  state: "on",
  seconds: "0.2",
  minutes: "10",
  mode: "Automatic",
  value: "1",
  format: "png",
  timezone: "America/Los_Angeles",
  dnsList: "8.8.8.8 8.8.4.4",
  domainList: "example.com",
  host: "127.0.0.1",
  port: "8080",
  text: "",
  prefix: "Screenshot",
  absolutePath: "",
};

const PARAM_LABEL: Record<string, string> = {
  enabled: "On or off",
  networkService: "Network service",
  device: "Wi-Fi device",
  volume: "Volume path",
  state: "State (on / off)",
  seconds: "Number",
  minutes: "Minutes",
  mode: "Mode or integer",
  value: "Numeric value",
  format: "File format",
  timezone: "Time zone",
  dnsList: "DNS servers",
  domainList: "Search domains",
  host: "Host",
  port: "Port",
  text: "Text",
  prefix: "Filename prefix",
  absolutePath: "Folder path",
};

function categoriesFrom(items: CliSettingCatalogItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) set.add(it.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function destructiveApplyToken(
  item: CliSettingCatalogItem,
  mode: "read" | "set" | "reset",
): "REBOOT" | "LOGOUT" | null {
  if (mode === "read") return null;
  if (item.applyAction === "reboot") return "REBOOT";
  if (item.applyAction === "logout") return "LOGOUT";
  return null;
}

function defaultParamsForItem(item: CliSettingCatalogItem | null): Record<string, string> {
  if (!item) return { ...DEFAULT_PARAMS };
  const modeDefault = item.id === "pmset.hibernatemode" ? "3" : "Automatic";
  return { ...DEFAULT_PARAMS, mode: modeDefault };
}

function paramsDirtyForItem(
  item: CliSettingCatalogItem,
  p: Record<string, string>,
): boolean {
  const d = defaultParamsForItem(item);
  const keys = new Set([...Object.keys(d), ...Object.keys(p)]);
  for (const k of keys) {
    if ((p[k] ?? "") !== (d[k] ?? "")) return true;
  }
  return false;
}

function worstDestructivePhraseForSet(
  items: CliSettingCatalogItem[],
): "REBOOT" | "LOGOUT" | null {
  let worst: "REBOOT" | "LOGOUT" | null = null;
  for (const it of items) {
    const t = destructiveApplyToken(it, "set");
    if (t === "REBOOT") return "REBOOT";
    if (t === "LOGOUT") worst = "LOGOUT";
  }
  return worst;
}

function riskPillClass(r: CliSettingCatalogItem["riskLevel"]): string {
  if (r === "safe") return "ss-pill ss-pill-risk-safe";
  if (r === "caution") return "ss-pill ss-pill-risk-caution";
  return "ss-pill ss-pill-risk-danger";
}

function ShellChrome({
  isMac,
  children,
}: {
  isMac: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={`ss-app${isMac ? " ss-is-mac" : ""}`}>{children}</div>
  );
}

export function App(): ReactElement {
  const [isMac, setIsMac] = useState(false);
  const [catalog, setCatalog] = useState<CliSettingCatalogItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [advancedOnly, setAdvancedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>(() => ({
    ...DEFAULT_PARAMS,
  }));
  /** Staged parameter sets for settings edited away from catalog defaults (batch apply). */
  const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, string>>>({});
  const pendingEditsRef = useRef(pendingEdits);
  pendingEditsRef.current = pendingEdits;

  const [output, setOutput] = useState<{
    text: string;
    err: boolean;
    mode: "read" | "set" | "reset" | "batch-set";
  } | null>(null);
  const [lastReadStdout, setLastReadStdout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [destructivePrompt, setDestructivePrompt] = useState<{
    mode: "read" | "set" | "reset";
    phrase: "REBOOT" | "LOGOUT";
    /** When set, confirm runs Apply for these ids instead of a single `performRun`. */
    batchApplyIds?: string[];
  } | null>(null);
  const [destructiveTyped, setDestructiveTyped] = useState("");
  const [updateBanner, setUpdateBanner] = useState<{
    latestVersion: string;
    htmlUrl: string;
  } | null>(null);

  useEffect(() => {
    const api = window.settingsPlus;
    if (!api?.checkForAppUpdates) return;
    void api.checkForAppUpdates().then((r: UpdateCheckResult) => {
      if (r.status !== "update_available") return;
      const key = `${UPDATE_DISMISS_PREFIX}${r.latestVersion}`;
      try {
        if (sessionStorage.getItem(key)) return;
      } catch {
        /* private mode */
      }
      setUpdateBanner({ latestVersion: r.latestVersion, htmlUrl: r.htmlUrl });
    });
  }, []);

  useEffect(() => {
    const api = window.settingsPlus;
    if (api?.platform === "darwin") setIsMac(true);
    if (!api) {
      setLoadError(
        "The preload bridge (window.settingsPlus) is missing. Quit fully and run `npm run dev` again from this project.",
      );
      return;
    }
    api
      .listCatalog()
      .then(setCatalog)
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  const cats = useMemo(() => categoriesFrom(catalog), [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((it) => {
      if (advancedOnly && it.showInDefaultView) return false;
      if (category !== ALL && it.category !== category) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.tool.toLowerCase().includes(q)
      );
    });
  }, [catalog, category, query, advancedOnly]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filtered.some((it) => it.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    setOutput(null);
    setLastReadStdout(null);
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!selectedId) return;
    const item = catalog.find((i) => i.id === selectedId);
    if (!item) return;
    const next =
      pendingEditsRef.current[selectedId] ?? defaultParamsForItem(item);
    setParams(next);
  }, [selectedId, catalog]);

  const selected = useMemo(
    () => catalog.find((it) => it.id === selectedId) ?? null,
    [catalog, selectedId],
  );

  useEffect(() => {
    if (!selected || !selectedId) return;
    setPendingEdits((prev) => {
      const dirty = paramsDirtyForItem(selected, params);
      if (!dirty) {
        if (!(selectedId in prev)) return prev;
        const next = { ...prev };
        delete next[selectedId];
        return next;
      }
      return { ...prev, [selectedId]: { ...params } };
    });
  }, [selected, selectedId, params]);

  const placeholders = useMemo(() => {
    if (!selected) return [];
    const parts = [selected.commands.read, selected.commands.set];
    if (selected.commands.reset) parts.push(selected.commands.reset);
    return unionPlaceholders(parts);
  }, [selected]);

  const pendingIdsSorted = useMemo(() => {
    const ids = Object.keys(pendingEdits);
    ids.sort((a, b) => {
      const ia = catalog.findIndex((x) => x.id === a);
      const ib = catalog.findIndex((x) => x.id === b);
      return ia - ib;
    });
    return ids;
  }, [pendingEdits, catalog]);

  const runCliItem = useCallback(
    async (
      itemId: string,
      mode: "read" | "set" | "reset",
      itemParams: Record<string, string>,
    ): Promise<{ text: string; err: boolean; code: number; stdout: string }> => {
      const api = window.settingsPlus;
      if (!api) {
        return {
          text: "Preload bridge (window.settingsPlus) is not available.",
          err: true,
          code: 1,
          stdout: "",
        };
      }
      try {
        const res = await api.runCli({
          id: itemId,
          mode,
          params: itemParams,
        });
        const text =
          (res.stdout || "") +
          (res.stderr ? (res.stdout ? "\n" : "") + res.stderr : "");
        return {
          text: text || "(no output)",
          err: res.code !== 0,
          code: res.code,
          stdout: res.stdout ?? "",
        };
      } catch (e: unknown) {
        return {
          text: e instanceof Error ? e.message : String(e),
          err: true,
          code: 1,
          stdout: "",
        };
      }
    },
    [],
  );

  const performRun = useCallback(
    async (mode: "read" | "set" | "reset") => {
      if (!selected) return;
      setBusy(true);
      setOutput(null);
      try {
        const r = await runCliItem(selected.id, mode, params);
        setOutput({
          text: r.text,
          err: r.err,
          mode,
        });
        if (mode === "read" && !r.err) {
          setLastReadStdout(r.stdout.trim());
        } else if ((mode === "set" || mode === "reset") && !r.err) {
          setLastReadStdout(null);
        }
      } finally {
        setBusy(false);
      }
    },
    [selected, params, runCliItem],
  );

  const runBatchSet = useCallback(
    async (ids: string[]) => {
      const pending = pendingEditsRef.current;
      const api = window.settingsPlus;
      if (!api) {
        setOutput({
          text: "Preload bridge (window.settingsPlus) is not available.",
          err: true,
          mode: "batch-set",
        });
        return;
      }
      if (ids.length === 0) return;

      setBusy(true);
      setOutput(null);
      const blocks: string[] = [];
      let anyErr = false;
      const succeeded: string[] = [];

      try {
        for (const id of ids) {
          const item = catalog.find((i) => i.id === id);
          const itemParams = pending[id];
          if (!item || !itemParams) continue;
          const title = item.title;
          const r = await runCliItem(id, "set", itemParams);
          blocks.push(`— ${title} (${id}) —\n${r.text}`);
          if (r.err) {
            anyErr = true;
            break;
          }
          succeeded.push(id);
        }

        setOutput({
          text: blocks.join("\n\n") || "(no output)",
          err: anyErr,
          mode: "batch-set",
        });

        if (succeeded.length > 0) {
          setPendingEdits((prev) => {
            const next = { ...prev };
            for (const id of succeeded) delete next[id];
            return next;
          });
          if (selectedId && succeeded.includes(selectedId)) {
            const item = catalog.find((i) => i.id === selectedId);
            if (item) setParams(defaultParamsForItem(item));
            setLastReadStdout(null);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [catalog, runCliItem, selectedId],
  );

  const run = useCallback(
    async (mode: "read" | "set" | "reset") => {
      if (!selected) return;
      const token = destructiveApplyToken(selected, mode);
      if (token) {
        setDestructiveTyped("");
        setDestructivePrompt({ mode, phrase: token });
        return;
      }
      await performRun(mode);
    },
    [selected, performRun],
  );

  const applyAllPending = useCallback(async () => {
    const ids = [...pendingIdsSorted];
    if (ids.length === 0) return;
    const items = ids
      .map((id) => catalog.find((i) => i.id === id))
      .filter((x): x is CliSettingCatalogItem => x != null);
    const phrase = worstDestructivePhraseForSet(items);
    if (phrase) {
      setDestructiveTyped("");
      setDestructivePrompt({ mode: "set", phrase, batchApplyIds: ids });
      return;
    }
    await runBatchSet(ids);
  }, [pendingIdsSorted, catalog, runBatchSet]);

  const clearAllPending = useCallback(() => {
    setPendingEdits({});
    if (selected) setParams(defaultParamsForItem(selected));
  }, [selected]);

  const browsePath = useCallback(async () => {
    const api = window.settingsPlus;
    if (!api) return;
    const p = await api.pickDirectory();
    if (p) setParams((prev) => ({ ...prev, absolutePath: p }));
  }, []);

  if (loadError) {
    return (
      <ShellChrome isMac={isMac}>
        <aside className="ss-sidebar">
          <div className="ss-brand">Settings</div>
          <div className="ss-brand-sub">SettingsPlus</div>
        </aside>
        <main className="ss-main">
          <div className="ss-empty">
            <div className="ss-empty-stack">
              <p style={{ fontWeight: 600, color: "var(--ss-text)" }}>
                Could not load settings
              </p>
              <p>{loadError}</p>
            </div>
          </div>
        </main>
      </ShellChrome>
    );
  }

  if (catalog.length === 0 && !loadError) {
    return (
      <ShellChrome isMac={isMac}>
        <aside className="ss-sidebar">
          <div className="ss-brand">Settings</div>
          <div className="ss-brand-sub">SettingsPlus</div>
        </aside>
        <main className="ss-main">
          <div className="ss-toolbar" />
          <div className="ss-empty">Loading settings…</div>
        </main>
      </ShellChrome>
    );
  }

  return (
    <ShellChrome isMac={isMac}>
      <aside className="ss-sidebar">
        <div className="ss-brand">Settings</div>
        <div className="ss-brand-sub">CLI-backed macOS preferences</div>
        <div className="ss-search-wrap">
          <input
            className="ss-search"
            type="search"
            placeholder="Search title, category, id, or tool…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search settings"
          />
        </div>
        <div className="ss-sidebar-pref">
          <label className="ss-sidebar-pref-row">
            <span>Advanced catalog only</span>
            <span className="ss-switch" style={{ transform: "scale(0.85)" }}>
              <input
                type="checkbox"
                checked={advancedOnly}
                onChange={(e) => setAdvancedOnly(e.target.checked)}
              />
              <span className="ss-switch-ui" />
            </span>
          </label>
        </div>
        <div className="ss-section-label">Browse</div>
        <nav className="ss-nav-scroll" aria-label="Categories">
          <button
            type="button"
            className={`ss-nav-item${category === ALL ? " ss-active" : ""}`}
            onClick={() => {
              setCategory(ALL);
            }}
          >
            <span className="ss-nav-icon-wrap" aria-hidden>
              <AllCategoriesIcon size={17} className="ss-nav-svg" />
            </span>
            <span className="ss-nav-label">All categories</span>
          </button>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={`ss-nav-item${category === c ? " ss-active" : ""}`}
              onClick={() => setCategory(c)}
            >
              <span className="ss-nav-icon-wrap" aria-hidden>
                <CategoryIcon category={c} size={17} className="ss-nav-svg" />
              </span>
              <span className="ss-nav-label">{c}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="ss-main">
        <header className="ss-toolbar">
          <div className="ss-toolbar-path" aria-label="Current location">
            {selected ? (
              <>
                <button
                  type="button"
                  className="ss-crumb-btn"
                  onClick={() => {
                    setCategory(selected.category);
                    setSelectedId(null);
                  }}
                >
                  {selected.category}
                </button>
                <ChevronRight
                  size={15}
                  className="ss-crumb-chevron"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="ss-crumb-current">{selected.title}</span>
              </>
            ) : category === ALL ? (
              <span className="ss-crumb-current">All macOS CLI settings</span>
            ) : (
              <>
                <button
                  type="button"
                  className="ss-crumb-btn"
                  onClick={() => setCategory(ALL)}
                >
                  All
                </button>
                <ChevronRight
                  size={15}
                  className="ss-crumb-chevron"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="ss-crumb-current">{category}</span>
              </>
            )}
          </div>
          <div className="ss-toolbar-actions">
            <span className="ss-toolbar-meta">
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
            </span>
            {pendingIdsSorted.length > 0 ? (
              <button
                type="button"
                className="ss-btn ss-btn-toolbar-clear"
                disabled={busy}
                onClick={clearAllPending}
              >
                Clear pending
              </button>
            ) : null}
            <button
              type="button"
              className="ss-btn ss-btn-default ss-btn-toolbar-apply"
              disabled={busy || pendingIdsSorted.length === 0}
              onClick={() => {
                void applyAllPending();
              }}
            >
              Apply pending
              {pendingIdsSorted.length > 0 ? (
                <span className="ss-pending-count">{pendingIdsSorted.length}</span>
              ) : null}
            </button>
          </div>
        </header>

        {updateBanner ? (
          <div className="ss-update-banner" role="status">
            <span className="ss-update-banner-text">
              A newer release is on GitHub{" "}
              <span className="ss-update-version">({updateBanner.latestVersion})</span>.
            </span>
            <div className="ss-update-banner-actions">
              <button
                type="button"
                className="ss-btn ss-btn-default ss-btn-compact"
                onClick={() => {
                  void window.settingsPlus?.openExternal(updateBanner.htmlUrl);
                }}
              >
                <Download size={14} aria-hidden />
                View release
              </button>
              <button
                type="button"
                className="ss-btn ss-btn-icon ss-update-dismiss"
                aria-label="Dismiss update notice"
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      `${UPDATE_DISMISS_PREFIX}${updateBanner.latestVersion}`,
                      "1",
                    );
                  } catch {
                    /* ignore */
                  }
                  setUpdateBanner(null);
                }}
              >
                <X size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        <div className="ss-main-inner">
          <div className="ss-list-pane">
            <div className="ss-list-header" id="ss-list-heading">
              <div className="ss-list-header-row">
                <h2 className="ss-list-header-title">Pick a setting</h2>
              </div>
              <p className="ss-list-header-hint">
                The preview updates as you edit. Staged tweaks appear in{" "}
                <strong>Apply pending</strong> in the toolbar — run Read to refresh the
                Now column.
              </p>
            </div>
            <div
              className="ss-list-scroll"
              role="listbox"
              aria-labelledby="ss-list-heading"
            >
              {filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  role="option"
                  aria-selected={it.id === selectedId}
                  className={`ss-setting-row${it.id === selectedId ? " ss-selected" : ""}`}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="ss-setting-row-inner">
                    <div className="ss-setting-icon-wrap" aria-hidden>
                      <CategoryIcon category={it.category} size={18} />
                    </div>
                    <div className="ss-setting-text">
                      <span className="ss-setting-title">{it.title}</span>
                      <span className="ss-setting-sub">
                        <ToolIcon tool={it.tool} size={12} className="ss-inline-tool" />
                        <span className="ss-setting-tool-label">
                          {TOOL_LABEL[it.tool]}
                        </span>
                        {!it.showInDefaultView ? (
                          <span className="ss-setting-advanced-tag">
                            {" "}
                            · Advanced
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div
                      className="ss-setting-badges"
                      aria-label={
                        [
                          it.requiresSudo ? "Requires administrator" : "",
                          !it.showInDefaultView ? "Advanced item" : "",
                        ]
                          .filter(Boolean)
                          .join(". ") || undefined
                      }
                    >
                      {it.requiresSudo ? (
                        <Shield
                          size={15}
                          className="ss-row-badge ss-badge-sudo"
                          aria-hidden
                        />
                      ) : null}
                      {!it.showInDefaultView ? (
                        <Sparkles
                          size={15}
                          className="ss-row-badge ss-badge-advanced"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 ? (
                <div className="ss-list-empty">No matching settings.</div>
              ) : null}
            </div>
          </div>

          <section className="ss-detail" aria-label="Setting details">
            {!selected ? (
              <div className="ss-detail-empty">
                <EmptyFlowVisual />
                <h2 className="ss-detail-empty-title">Inspector</h2>
                <p className="ss-detail-empty-lead">
                  Pick a row, then compare <strong>Now</strong> vs{" "}
                  <strong>After apply</strong> in the preview strip.
                </p>
              </div>
            ) : (
              <div className="ss-detail-scroll">
                <div className="ss-detail-head">
                  <div className="ss-detail-hero-icon" aria-hidden>
                    <CategoryIcon category={selected.category} size={30} />
                  </div>
                  <div className="ss-detail-head-main">
                    <p className="ss-detail-lede">
                      <ToolIcon tool={selected.tool} size={15} />
                      <span>{TOOL_SUMMARY[selected.tool]}</span>
                    </p>
                    <h1 className="ss-detail-title">{selected.title}</h1>
                  </div>
                </div>

                <div className="ss-meta-row">
                  <span className="ss-pill ss-pill-with-icon">
                    <CategoryIcon category={selected.category} size={12} />
                    {selected.category}
                  </span>
                  <span className="ss-pill ss-pill-with-icon">
                    <ToolIcon tool={selected.tool} size={12} />
                    {TOOL_LABEL[selected.tool]}
                  </span>
                  <span className={riskPillClass(selected.riskLevel)}>
                    {selected.riskLevel}
                  </span>
                  {selected.requiresSudo ? (
                    <span className="ss-pill ss-pill-accent ss-pill-with-icon">
                      <Shield size={12} aria-hidden />
                      Admin
                    </span>
                  ) : null}
                  {!selected.showInDefaultView ? (
                    <span className="ss-pill ss-pill-with-icon">
                      <Sparkles size={12} aria-hidden />
                      Advanced
                    </span>
                  ) : null}
                </div>

                <SettingPreview
                  item={selected}
                  params={params}
                  placeholders={placeholders}
                  lastReadStdout={lastReadStdout}
                />

                {selected.notes ? (
                  <p className="ss-notes-callout">{selected.notes}</p>
                ) : null}

                {placeholders.length > 0 ? (
                  <div className="ss-group">
                    <div className="ss-group-heading">
                      <span className="ss-group-heading-label">
                        Command parameters
                      </span>
                      <p className="ss-group-micro">
                        Fills <code className="ss-code-inline">{"{{name}}"}</code> in
                        the commands below.
                      </p>
                    </div>
                    <div className="ss-group-box">
                      {placeholders.map((key) => (
                        <div key={key} className="ss-pref-row">
                          <div className="ss-pref-label">
                            {PARAM_LABEL[key] ?? key}
                          </div>
                          <div className="ss-pref-control">
                            {key === "absolutePath" ? (
                              <div className="ss-path-row">
                                <input
                                  type="text"
                                  value={params[key] ?? ""}
                                  onChange={(e) =>
                                    setParams((p) => ({
                                      ...p,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  placeholder="/path/to/folder"
                                />
                                <button
                                  type="button"
                                  className="ss-btn"
                                  onClick={browsePath}
                                >
                                  Choose…
                                </button>
                              </div>
                            ) : key === "enabled" ? (
                              <label className="ss-switch">
                                <input
                                  type="checkbox"
                                  checked={(params[key] ?? "true") === "true"}
                                  onChange={(e) =>
                                    setParams((p) => ({
                                      ...p,
                                      [key]: e.target.checked ? "true" : "false",
                                    }))
                                  }
                                />
                                <span className="ss-switch-ui" />
                              </label>
                            ) : (
                              <input
                                type="text"
                                value={params[key] ?? ""}
                                onChange={(e) =>
                                  setParams((p) => ({
                                    ...p,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="ss-run-block">
                  <div className="ss-run-heading">
                    <RunSectionIcon size={15} className="ss-run-heading-icon" />
                    <span>Run on this Mac</span>
                  </div>
                  <p className="ss-run-caption">
                    Read and restore run here. Saving the Apply command uses{" "}
                    <strong>Apply pending</strong> in the toolbar so you can batch
                    changes across settings.
                  </p>
                  <div className="ss-action-bar">
                    <button
                      type="button"
                      className="ss-btn ss-btn-default"
                      disabled={busy}
                      onClick={() => run("read")}
                    >
                      Read current
                    </button>
                    <button
                      type="button"
                      className="ss-btn"
                      disabled={busy || !selected.commands.reset}
                      onClick={() => run("reset")}
                    >
                      Restore default
                    </button>
                  </div>
                </div>

                {selected.applyAction !== "none" ? (
                  <p className="ss-footnote">
                    After a successful apply (from the toolbar) or Restore Default, macOS
                    runs: <code className="ss-code-inline">{selected.applyAction}</code>
                  </p>
                ) : null}

                <div className="ss-group">
                  <div className="ss-group-heading">
                    <span className="ss-group-heading-label">
                      Terminal commands
                    </span>
                    <p className="ss-group-micro">
                      Catalog templates (placeholders not filled here).
                    </p>
                  </div>
                  <div className="ss-group-box">
                    <div className="ss-code-section">
                      <div className="ss-code-caption">Read</div>
                      <pre className="ss-code-block">
                        {selected.commands.read}
                      </pre>
                    </div>
                    <div className="ss-code-section">
                      <div className="ss-code-caption">Apply</div>
                      <pre className="ss-code-block">
                        {selected.commands.set}
                      </pre>
                    </div>
                    {selected.commands.reset ? (
                      <div className="ss-code-section">
                        <div className="ss-code-caption">Restore default</div>
                        <pre className="ss-code-block">
                          {selected.commands.reset}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>

                {output ? (
                  <div className="ss-group">
                    <div className="ss-group-heading">
                      <span className="ss-group-heading-label">
                        Output —{" "}
                        {output.mode === "batch-set" ? "batch apply" : output.mode}
                      </span>
                      <p className="ss-group-micro">Stdout + stderr.</p>
                    </div>
                    <div className="ss-group-box">
                      <pre
                        className={`ss-code-block${output.err ? " ss-err" : ""}`}
                        style={{ margin: 0, border: "none", maxHeight: 240 }}
                      >
                        {output.text}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </main>

      {destructivePrompt ? (
        <div
          className="ss-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ss-destructive-title"
        >
          <div className="ss-modal">
            <h2 id="ss-destructive-title" className="ss-modal-title">
              Confirm destructive follow-up
            </h2>
            <p className="ss-modal-body">
              {destructivePrompt.batchApplyIds?.length ? (
                <>
                  Applying{" "}
                  <strong>{destructivePrompt.batchApplyIds.length}</strong> pending
                  setting
                  {destructivePrompt.batchApplyIds.length === 1 ? "" : "s"} will run{" "}
                  <code className="ss-code-inline">
                    {destructivePrompt.phrase === "REBOOT" ? "reboot" : "logout"}
                  </code>{" "}
                  after the shell commands succeed. Type{" "}
                  <strong className="ss-modal-emph">{destructivePrompt.phrase}</strong>{" "}
                  to continue.
                </>
              ) : (
                <>
                  After this command succeeds, macOS will run{" "}
                  <code className="ss-code-inline">
                    {destructivePrompt.phrase === "REBOOT" ? "reboot" : "logout"}
                  </code>
                  . Type{" "}
                  <strong className="ss-modal-emph">{destructivePrompt.phrase}</strong>{" "}
                  to continue.
                </>
              )}
            </p>
            <input
              className="ss-modal-input"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={destructiveTyped}
              onChange={(e) => setDestructiveTyped(e.target.value)}
              aria-label={`Type ${destructivePrompt.phrase} to confirm`}
            />
            <div className="ss-modal-actions">
              <button
                type="button"
                className="ss-btn"
                onClick={() => {
                  setDestructivePrompt(null);
                  setDestructiveTyped("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ss-btn ss-btn-danger"
                disabled={
                  busy || destructiveTyped.trim() !== destructivePrompt.phrase
                }
                onClick={() => {
                  const batchIds = destructivePrompt.batchApplyIds;
                  const mode = destructivePrompt.mode;
                  setDestructivePrompt(null);
                  setDestructiveTyped("");
                  if (batchIds?.length) void runBatchSet(batchIds);
                  else void performRun(mode);
                }}
              >
                {destructivePrompt.batchApplyIds?.length
                  ? "Apply pending"
                  : "Run command"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ShellChrome>
  );
}
