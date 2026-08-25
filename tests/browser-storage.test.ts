import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("temporary board configuration storage", () => {
  it("does not use browser persistence APIs or cookies in the React flow", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/intelligence-console.tsx"), "utf8");
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/i);
  });

  it("persists only the non-sensitive theme preference", () => {
    const ui = readFileSync(path.join(process.cwd(), "src/components/ui.tsx"), "utf8");
    const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(`${ui}\n${layout}`).toMatch(/skylark-theme/);
    expect(`${ui}\n${layout}`).not.toMatch(/MONDAY_API_TOKEN|mondayConfig|boardIds|token:|sessionStorage|indexedDB|document\.cookie/i);
  });
});
