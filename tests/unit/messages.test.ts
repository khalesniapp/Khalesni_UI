import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

/**
 * Catalogue parity — UI_Plan.md §9, §16.
 *
 * "Every user-facing string lives in messages/{en,ar}.json" only holds if the
 * two files stay in step. A key added to one and forgotten in the other throws
 * at render time in the *other* language, which is exactly the failure nobody
 * notices until an Arabic speaker opens the app.
 *
 * The ICU placeholder check catches the subtler version: a translation that
 * drops `{name}` renders a sentence with a hole in it rather than an error.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const english = flatten(en as Tree);
const arabic = flatten(ar as Tree);

describe("message catalogues", () => {
  it("define exactly the same keys", () => {
    const missingFromArabic = [...english.keys()].filter((key) => !arabic.has(key));
    const missingFromEnglish = [...arabic.keys()].filter((key) => !english.has(key));

    expect({ missingFromArabic, missingFromEnglish }).toEqual({
      missingFromArabic: [],
      missingFromEnglish: [],
    });
  });

  it("use the same ICU placeholders in both languages", () => {
    const mismatched: string[] = [];

    for (const [key, value] of english) {
      const other = arabic.get(key);
      if (other === undefined) continue;
      const a = placeholders(value);
      const b = placeholders(other);
      if (a.join(",") !== b.join(",")) mismatched.push(`${key}: [${a}] vs [${b}]`);
    }

    expect(mismatched).toEqual([]);
  });

  it("never ships an empty string", () => {
    const empty = [...english, ...arabic]
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });
});
