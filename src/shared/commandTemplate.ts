const PLACEHOLDER = /\{\{([a-zA-Z0-9_]+)\}\}/g;

export function extractPlaceholders(template: string): string[] {
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER.source, "g");
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

export function unionPlaceholders(templates: string[]): string[] {
  const all = new Set<string>();
  for (const t of templates) {
    for (const p of extractPlaceholders(t)) {
      all.add(p);
    }
  }
  return [...all].sort();
}

export function interpolate(
  template: string,
  params: Record<string, string>,
): { ok: true; value: string } | { ok: false; error: string } {
  const missing: string[] = [];
  const value = template.replace(PLACEHOLDER, (_, key: string) => {
    const v = params[key];
    if (v === undefined) missing.push(key);
    return v ?? "";
  });
  if (missing.length > 0) {
    return { ok: false, error: `Missing values for: ${missing.join(", ")}` };
  }
  return { ok: true, value };
}
