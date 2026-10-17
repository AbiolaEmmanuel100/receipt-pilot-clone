/**
 * HTML escaping for safe interpolation into innerHTML and attribute values.
 * Encodes &, <, >, " and ' so user input is rendered as text, not markup.
 */

function ent(name: string): string {
  return "&" + name + ";";
}

const ESCAPE_MAP: Record<string, string> = {
  "&": ent("amp"),
  "<": ent("lt"),
  ">": ent("gt"),
  '"': ent("quot"),
  "'": ent("#39"),
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}
