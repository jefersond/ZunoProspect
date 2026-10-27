// Gera o arquivo único da Edge Function analisar-lead-ia (módulo compartilhado embutido), usado quando a publicação
// aceita um arquivo só. Uso: node scripts/build-analisar-lead-ia-bundle.mjs
import { readFileSync, writeFileSync } from "node:fs";

const guard = readFileSync("supabase/functions/_shared/refine-provider-guard.ts", "utf8")
  .replace(/^export (async function|function|const|interface|type) /gm, "$1 ");
let index = readFileSync("supabase/functions/analisar-lead-ia/index.ts", "utf8");
index = index.replace(/import \{[^}]*\} from "\.\.\/_shared\/refine-provider-guard\.ts";\n/, "");
const head = 'import { serve } from "https://deno.land/std@0.224.0/http/server.ts";\nimport { createClient } from "npm:@supabase/supabase-js@2";\n';
index = index.replace(head, "");

const out = `${head}
// GERADO por scripts/build-analisar-lead-ia-bundle.mjs: não edite. Fonte: supabase/functions/analisar-lead-ia/index.ts
// e supabase/functions/_shared/refine-provider-guard.ts.
// ===== refine-provider-guard =====
${guard}
// ===== analisar-lead-ia =====
${index}`;
writeFileSync("scripts/deploy/analisar-lead-ia.bundle.ts", out);
console.log(`scripts/deploy/analisar-lead-ia.bundle.ts (${out.length} bytes)`);
