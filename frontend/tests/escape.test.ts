import { describe, it, expect } from "vitest";
import { escapeHtml } from "../src/escape";

function ent(name: string): string {
  return "&" + name + ";";
}

describe("escapeHtml", () => {
  it("encodes ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom " + ent("amp") + " Jerry");
  });

  it("encodes less-than and greater-than", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      ent("lt") + "script" + ent("gt") + "alert(1)" + ent("lt") + "/script" + ent("gt")
    );
  });

  it("encodes double and single quotes", () => {
    const input = 'He said "it\'s fine"';
    const expected = "He said " + ent("quot") + "it" + ent("#39") + "s fine" + ent("quot");
    expect(escapeHtml(input)).toBe(expected);
  });

  it("encodes mixed HTML-like input", () => {
    const raw = '<img src=x onerror="alert(\'xss\')">&';
    const expected =
      ent("lt") + "img src=x onerror=" + ent("quot") + "alert(" + ent("#39") + "xss" + ent("#39") + ")" + ent("quot") + ent("gt") + ent("amp");
    expect(escapeHtml(raw)).toBe(expected);
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Plain text 123")).toBe("Plain text 123");
  });

  it("handles empty and nullish", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("does not interpret tags as HTML (string remains escaped)", () => {
    const escaped = escapeHtml("<b>bold</b>");
    expect(escaped).not.toContain("<b>");
    expect(escaped).toContain(ent("lt") + "b" + ent("gt"));
  });
});
