import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("temporary diagnostic placement",()=>{
  it("is absent from the Zuno admin frontend",()=>{
    const admin=readFileSync(resolve(process.cwd(),"src/pages/AdminCommandCenter.tsx"),"utf8");
    expect(admin).not.toContain("MpReadonlyDiagnosticTemp");
  });
});
