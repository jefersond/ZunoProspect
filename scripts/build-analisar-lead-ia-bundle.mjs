// Gera o arquivo único da Edge Function analisar-lead-ia (módulos compartilhados embutidos), usado quando a
// publicação aceita um arquivo só. Uso: node scripts/build-analisar-lead-ia-bundle.mjs
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const result = await build({
  entryPoints: ["supabase/functions/analisar-lead-ia/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "esnext",
  write: false,
  minify: false,
  legalComments: "none",
  external: ["https://*", "npm:*"],
  logLevel: "warning",
});

const banner = `// GERADO por scripts/build-analisar-lead-ia-bundle.mjs: não edite.
// Fontes: supabase/functions/analisar-lead-ia/index.ts, _shared/refine-provider-guard.ts e _shared/lead-analysis.ts.
`;
writeFileSync("scripts/deploy/analisar-lead-ia.bundle.ts", banner + result.outputFiles[0].text);
console.log(`scripts/deploy/analisar-lead-ia.bundle.ts (${readFileSync("scripts/deploy/analisar-lead-ia.bundle.ts").length} bytes)`);
