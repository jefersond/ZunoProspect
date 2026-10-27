import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O SDR ainda não foi aprovado para assinantes: botão e modal da lista só existem para administradores.
const list = readFileSync(new URL("./LeadsList.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("./LeadPlanDialog.tsx", import.meta.url), "utf8");

describe("SDR somente para administradores", () => {
  it("LeadsList: botão 'Abordar WhatsApp' e SdrWhatsAppModal atrás de isAdmin", () => {
    const button = list.indexOf("onClick={() => setSdrLead(lead)}");
    expect(list.lastIndexOf("{isAdmin && (", button)).toBeGreaterThan(list.lastIndexOf("</TableCell>", button));
    expect(list).toContain("{isAdmin && <SdrWhatsAppModal");
    expect(list).toContain("open={!!sdrLead && isAdmin}");
  });
  it("LeadPlanDialog: bloco SDR, ações por dia, handler e modal exigem isAdmin", () => {
    expect(dialog).toContain("if (!sdrEnabled()) return;");
    expect(dialog.match(/onExecuteInSdr=\{isAdmin \? handleOpenSdrWithDay : undefined\}/g)).toHaveLength(2);
    expect(dialog).toContain("{isAdmin && <SdrWhatsAppModal");
  });
});
