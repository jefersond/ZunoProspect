import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const roots = [resolve(root, "src"), resolve(root, "index.html")];
const extensions = new Set([".ts", ".tsx", ".html"]);

function walk(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
}

function ext(path: string) {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] || "";
}

const files = roots
  .flatMap(walk)
  .filter((path) => extensions.has(ext(path)))
  .filter((path) => !/\.test\.(ts|tsx)$/.test(path));

function matchesFor(pattern: RegExp) {
  const matches: string[] = [];
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    text.split("\n").forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${relative(root, path)}:${index + 1}: ${line.trim()}`);
      }
      pattern.lastIndex = 0;
    });
  }
  return matches;
}

describe("public copy diagnostic", () => {
  it("prints remaining hardcoded trial and dash candidates for review", () => {
    const seven = matchesFor(/7\s*(?:dias?|days?)|sete\s+dias|7-day/i);
    const emDash = matchesFor(/[—–]/);
    const spacedHyphen = matchesFor(/\s-\s/);
    console.log("COPY_AUDIT_SEVEN", JSON.stringify(seven));
    console.log("COPY_AUDIT_EM_DASH", JSON.stringify(emDash));
    console.log("COPY_AUDIT_SPACED_HYPHEN", JSON.stringify(spacedHyphen));
    expect(true).toBe(true);
  });
});
