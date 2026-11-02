// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const copyToClipboard = vi.fn(async (_text: string) => true);
const toast = vi.fn();

vi.mock("@/utils/templateUtils", () => ({ copyToClipboard: (text: string) => copyToClipboard(text) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/metaPixel", () => ({ trackMetaCustomEvent: vi.fn() }));

import { LeadAnalysis } from "./LeadAnalysis";
import { makeLegacyLead, makeNewLead } from "@/test/leadFixtures";
import type { LeadProspeccao } from "@/types/lead";

const renderAnalysis = (lead: LeadProspeccao, extra: Partial<React.ComponentProps<typeof LeadAnalysis>> = {}) =>
  render(
    <LeadAnalysis
      lead={lead}
      diagnostico={lead.diagnostico_bullets}
      probabilidade={lead.probabilidade_conversao ?? null}
      plano={lead.plano_prospecao_7dias}
      geradoEm={lead.ai_analise_gerada_em}
      {...extra}
    />,
  );

// Tópicos no formato gravado hoje pela análise (motor local e função atual).
const TYPICAL_BULLETS = [
  "Clínica Sorriso atua no segmento de clínica odontológica em Vitória.",
  "Sinais observados: URL informada no perfil público (requer conferência manual de funcionamento) e 87 avaliações no Google (4.8 estrelas).",
  "Possibilidade comercial para Oportunidade comercial: avaliar se a entrada de novos clientes hoje acontece com previsibilidade.",
  "Próximo passo útil: enviar abertura curta e consultiva focada na rotina comercial da empresa, sem promessas agressivas.",
];

describe("LeadAnalysis · estrutura do painel", () => {
  beforeEach(() => { copyToClipboard.mockClear(); toast.mockClear(); });
  afterEach(cleanup);

  it("ordem: cabeçalho → resumo → dados da empresa → oportunidade → próximo passo → plano de 7 dias", () => {
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS });
    const ids = ["analysis-header", "analysis-summary", "company-data", "analysis-opportunity", "analysis-next-step", "analysis-plan"];
    const nodes = ids.map((id) => screen.getByTestId(id));
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("separa os tópicos já existentes sem alterar seu texto e sem rótulo repetido", () => {
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS });
    const summary = screen.getByTestId("analysis-summary");
    expect(within(summary).getByText(TYPICAL_BULLETS[0])).toBeTruthy();
    expect(within(summary).getByText(TYPICAL_BULLETS[1])).toBeTruthy();

    const opportunity = screen.getByTestId("analysis-opportunity");
    expect(within(opportunity).getByText("Avaliar se a entrada de novos clientes hoje acontece com previsibilidade.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Possibilidade comercial para Oportunidade comercial/);

    const next = screen.getByTestId("analysis-next-step");
    expect(within(next).getByText(/Enviar abertura curta e consultiva/)).toBeTruthy();
  });

  it("resumo em parágrafos, sem lista com hífens", () => {
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS });
    const summary = screen.getByTestId("analysis-summary");
    expect(summary.querySelectorAll("ul, li")).toHaveLength(0);
    expect(summary.textContent).not.toMatch(/(^|\s)-\s/);
  });

  it("mais de três frases: as demais ficam em 'ver mais', nada some", () => {
    const many = ["A.", "B.", "C.", "D extra.", "E extra."].map((x) => `${x} texto de observação`);
    renderAnalysis(makeNewLead(), { diagnostico: many });
    const summary = screen.getByTestId("analysis-summary");
    expect(within(summary).getByText(/Ver mais detalhes da análise \(2\)/)).toBeTruthy();
    for (const t of many) expect(within(summary).getByText(t)).toBeTruthy();
  });

  it("sem tópico de oportunidade, a análise não ganha esse card (nada é inventado)", () => {
    renderAnalysis(makeNewLead(), { diagnostico: ["Empresa atua em Serra.", "Sem mais sinais públicos."] });
    expect(screen.queryByTestId("analysis-opportunity")).toBeNull();
  });

  it("próximo passo sem tópico: usa a ação do primeiro dia pendente do próprio plano; pula dias concluídos", () => {
    const lead = makeNewLead();
    const plano = lead.plano_prospecao_7dias.map((d) => (d.dia === 1 ? { ...d, status_dia: "concluido" as const } : d));
    renderAnalysis(lead, { diagnostico: ["Empresa atua em Serra."], plano });
    const day = screen.getByTestId("next-step-day");
    expect(day.textContent).toContain("Dia 2");
    expect(day.textContent).toContain(plano[1].acao_sugerida);
  });

  it("sem tópico e sem dia com mensagem: não existe card de próximo passo", () => {
    const lead = makeNewLead();
    const plano = lead.plano_prospecao_7dias.map((d) => ({ ...d, mensagem: "", status_dia: "concluido" as const }));
    renderAnalysis(lead, { diagnostico: ["Empresa atua em Serra."], plano });
    expect(screen.queryByTestId("analysis-next-step")).toBeNull();
  });

  it("próximo passo: botão executa o dia recomendado no SDR e outro leva ao plano", () => {
    const onExecute = vi.fn();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onExecuteInSdr: onExecute });
    const next = screen.getByTestId("analysis-next-step");
    fireEvent.click(within(next).getByText("Executar Dia 1 no SDR"));
    expect(onExecute).toHaveBeenCalledWith(1);
    fireEvent.click(within(next).getByText("Ver plano de 7 dias"));
    expect(scroll).toHaveBeenCalled();
    expect(document.getElementById("plano-7-dias")).toBe(screen.getByTestId("analysis-plan"));
  });

  it("cabeçalho: nome em destaque, segmento e cidade abaixo, data; nome oculto quando o diálogo já o mostra", () => {
    const lead = makeNewLead();
    const { unmount } = renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    const header = screen.getByTestId("analysis-header");
    expect(within(header).getByRole("heading", { name: lead.nome })).toBeTruthy();
    expect(within(header).getByText(`${lead.nicho} · ${lead.cidade}`)).toBeTruthy();
    expect(within(header).getByText(/Gerado em \d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
    unmount();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, showCompanyName: false });
    expect(within(screen.getByTestId("analysis-header")).queryByRole("heading")).toBeNull();
  });
});

describe("LeadAnalysis · dados da empresa e honestidade dos status", () => {
  afterEach(cleanup);

  it("dados completos: informado no cadastro; site existe mas funcionamento 'não verificado'", () => {
    const lead = { ...makeNewLead(), website: "https://sorriso.com.br/", telefone: "(27) 99888-7766" } as LeadProspeccao;
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    const site = screen.getByTestId("fact-website");
    expect(within(site).getByText("sorriso.com.br")).toBeTruthy();
    expect(within(site).getByText("Informado no cadastro")).toBeTruthy();
    expect(within(site).getByText("Não verificado")).toBeTruthy();
    expect(within(site).getByText(/não testa se o site está no ar/)).toBeTruthy();
    const phone = screen.getByTestId("fact-telefone");
    expect(within(phone).getByText("(27) 99888-7766")).toBeTruthy();
    expect(within(phone).getByText("Informado no cadastro")).toBeTruthy();
    expect(within(screen.getByTestId("fact-avaliacoes")).getByText(`${lead.total_reviews} avaliações · nota ${String(lead.rating).replace(".", ",")}`)).toBeTruthy();
    expect(within(screen.getByTestId("fact-local")).getByText(`${lead.cidade} · ${lead.nicho}`)).toBeTruthy();
  });

  it("dados incompletos: 'Indisponível' (nunca 'não possui') e sem valores inventados", () => {
    const lead = { ...makeNewLead(), telefone: null, whatsapp_number: null, website: null, total_reviews: null, rating: null, cidade: "", nicho: "" } as unknown as LeadProspeccao;
    renderAnalysis(lead, { diagnostico: ["Registro com poucos dados públicos."] });
    for (const key of ["telefone", "website", "local", "avaliacoes"]) {
      const card = screen.getByTestId(`fact-${key}`);
      expect(within(card).getByText("Indisponível")).toBeTruthy();
      expect(within(card).getByText("—")).toBeTruthy();
    }
    expect(within(screen.getByTestId("fact-website")).getByText(/não prova que a empresa não tenha um/)).toBeTruthy();
    expect(screen.getByTestId("company-data").textContent).not.toMatch(/não possui|sem site\.|não tem site/i);
  });

  it("origem registrada: google_places/cnpj_api → 'Confirmado na fonte'; estimado → 'Não verificado'", () => {
    const lead = {
      ...makeNewLead(),
      data_sources: { telefone: "google_places", rating: "cnpj_api", nicho: "estimado" },
    } as unknown as LeadProspeccao;
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    expect(within(screen.getByTestId("fact-telefone")).getByText("Confirmado na fonte")).toBeTruthy();
    expect(within(screen.getByTestId("fact-avaliacoes")).getByText("Confirmado na fonte")).toBeTruthy();
    expect(within(screen.getByTestId("fact-local")).getByText("Não verificado")).toBeTruthy();
  });

  it("telefone fixo e fora do padrão são descritos como tal", () => {
    const fixo = { ...makeNewLead(), telefone: "2733221100" } as LeadProspeccao;
    const { unmount } = renderAnalysis(fixo, { diagnostico: TYPICAL_BULLETS });
    expect(within(screen.getByTestId("fact-telefone")).getByText("Telefone fixo.")).toBeTruthy();
    unmount();
    renderAnalysis({ ...makeNewLead(), telefone: "123" } as LeadProspeccao, { diagnostico: TYPICAL_BULLETS });
    const card = screen.getByTestId("fact-telefone");
    expect(within(card).getByText("Não verificado")).toBeTruthy();
    expect(within(card).getByText(/Fora do padrão brasileiro/)).toBeTruthy();
  });

  it("não mostra Pixel/GTM/tags nem trata sinais como verificados, mesmo que venham preenchidos", () => {
    const lead = { ...makeNewLead(), sinais: { has_whatsapp_on_site: true, has_meta_pixel: true, has_gtag: true, has_gtm: true } } as LeadProspeccao;
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    expect(screen.getByTestId("company-data").textContent).not.toMatch(/pixel|gtm|gtag|tag manager|rastreamento/i);
  });

  it("alinhamento cadastral: selo no cabeçalho da seção, sem percentual", () => {
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS });
    const section = screen.getByTestId("company-data");
    expect(within(section).getByText(/Alinhamento cadastral para abordagem/)).toBeTruthy();
    expect(within(section).getByText(/Compatibilidade (Alta|Média|Básica|não determinada)/)).toBeTruthy();
    expect(section.textContent).not.toMatch(/\d+\s*%/);
  });

  it("prop compatibilidade é usada quando informada, mesmo sem lead", () => {
    renderAnalysis(makeNewLead(), {
      lead: null,
      diagnostico: TYPICAL_BULLETS,
      compatibilidade: { level: "alta", label: "Alinhamento alto (teste)", description: "descrição de teste", criteria: [], score: null },
    });
    expect(screen.getByText("Alinhamento alto (teste)")).toBeTruthy();
    expect(screen.queryByTestId("fact-telefone")).toBeNull();
  });
});

describe("LeadAnalysis · análises antigas e estados vazios", () => {
  afterEach(cleanup);

  it("análise antiga (probabilidade legada, foco nulo, plano antigo): renderiza tudo, sem exceção, mensagens idênticas", () => {
    const lead = makeLegacyLead();
    expect(() => renderAnalysis(lead)).not.toThrow();
    expect(screen.getByText("Diagnóstico antigo 1")).toBeTruthy();
    for (let d = 1; d <= 7; d++) expect(screen.getByText(`Mensagem antiga personalizada do dia ${d}`)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/85\s*%/);
  });

  it("tópicos fora do padrão ficam no resumo como vieram", () => {
    renderAnalysis(makeNewLead(), { diagnostico: ["Texto livre sem rótulo.", "Outro texto qualquer."] });
    const summary = screen.getByTestId("analysis-summary");
    expect(within(summary).getByText("Texto livre sem rótulo.")).toBeTruthy();
    expect(within(summary).getByText("Outro texto qualquer.")).toBeTruthy();
  });

  it("rótulos antigos da análise anterior (Oportunidade/Ângulo/Ponto de dor) são organizados", () => {
    renderAnalysis(makeNewLead(), {
      diagnostico: ["Oportunidade: empresa atua em Serra.", "Ponto de dor principal: oscilação de demanda.", "Ângulo comercial recomendado: estruturar captação local."],
    });
    expect(within(screen.getByTestId("analysis-opportunity")).getByText("Empresa atua em Serra.")).toBeTruthy();
    expect(within(screen.getByTestId("analysis-opportunity")).getByText("Estruturar captação local.")).toBeTruthy();
    expect(within(screen.getByTestId("analysis-summary")).getByText("Ponto de dor principal: oscilação de demanda.")).toBeTruthy();
  });

  it("estado vazio (sem diagnóstico ou sem plano) continua com o aviso e sem painel", () => {
    renderAnalysis(makeNewLead(), { plano: [] });
    expect(screen.getByText(/Analise premium de IA ainda nao gerada/)).toBeTruthy();
    expect(screen.queryByTestId("analysis-panel")).toBeNull();
    cleanup();
    renderAnalysis(makeNewLead(), { diagnostico: [] });
    expect(screen.queryByTestId("analysis-panel")).toBeNull();
  });
});

describe("LeadAnalysis · botões", () => {
  beforeEach(() => { copyToClipboard.mockClear(); toast.mockClear(); });
  afterEach(cleanup);

  it("Antes da geração, não há botão duplicado no cabeçalho; após o Gemini, exibe 'Refinar novamente' com aviso de crédito", () => {
    const onReanalyze = vi.fn();
    // 1. Antes da geração: cabeçalho limpo, único CTA é o card destacado
    const { unmount } = renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onReanalyze });
    expect(screen.queryByTestId("refine-action")).toBeNull();
    const highlightBtn = screen.getByTestId("btn-refinar-abordagem-ia");
    expect(highlightBtn.textContent).toContain("Gerar plano comercial completo com IA");
    unmount();

    // 2. Após geração do Gemini: cabeçalho exibe 'Refinar novamente' com aviso e modal
    const refinedLead = { ...makeNewLead(), ai_used_fallback: false };
    renderAnalysis(refinedLead, { diagnostico: TYPICAL_BULLETS, onReanalyze, geradoEm: "2026-10-29T10:00:00Z" });
    const header = screen.getByTestId("analysis-header");
    const action = within(header).getByTestId("refine-action");
    fireEvent.click(within(action).getByText("Refinar novamente"));
    expect(screen.getByText("Gerar uma nova análise com IA?")).toBeTruthy();
    expect(within(action).getByText(/Pode consumir 1 análise de IA/)).toBeTruthy();
  });

  it("sem saldo: texto de upgrade e aviso de limite; durante a execução fica desabilitado", () => {
    const refinedLead = { ...makeNewLead(), ai_used_fallback: false };
    const { unmount } = renderAnalysis(refinedLead, { diagnostico: TYPICAL_BULLETS, onReanalyze: vi.fn(), canAnalyzeAI: false, geradoEm: "2026-10-29T10:00:00Z" });
    expect(screen.getByText("Liberar análises IA")).toBeTruthy();
    expect(screen.getByText(/limite de análises de IA foi atingido/)).toBeTruthy();
    unmount();
    renderAnalysis(refinedLead, { diagnostico: TYPICAL_BULLETS, onReanalyze: vi.fn(), isReanalyzing: true, geradoEm: "2026-10-29T10:00:00Z" });
    expect((screen.getByText("Refinando...").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Atualizar Cópias: só existe com handler, fica na área avançada e permanece desativado na interface", async () => {
    const onUpdate = vi.fn();
    const { unmount } = renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS });
    expect(screen.queryByText(/Atualizar C[óo]pias/)).toBeNull();
    unmount();

    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onUpdateCopiesLocally: onUpdate, isAdmin: true });
    const advanced = screen.getByTestId("advanced-copy-action");
    expect(screen.getByTestId("analysis-plan").contains(advanced)).toBe(true);
    const button = within(advanced).getByText(/Atualizar C[óo]pias/).closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.className).not.toMatch(/bg-primary|bg-emerald-6/); // não é ação principal
    expect(screen.queryByTestId("analysis-header")!.textContent).not.toMatch(/Atualizar C[óo]pias/); // não disputa o topo

    fireEvent.click(button);
    expect(screen.queryByText("Substituir mensagens pelo modelo padrão?")).toBeNull();
  });

  it("oculta a ferramenta avançada e o botão Atualizar Cópias para assinantes comuns (isAdmin = false)", () => {
    const onUpdate = vi.fn();
    const lead = makeNewLead();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, onUpdateCopiesLocally: onUpdate, isAdmin: false });

    expect(screen.queryByTestId("advanced-copy-action")).toBeNull();
    expect(screen.queryByText(/Ferramenta avançada/)).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("Atualizar Cópias: botão é inacessível na interface e protege copies geradas por IA contra sobrescrita", () => {
    const onUpdate = vi.fn();
    const lead = makeNewLead();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, onUpdateCopiesLocally: onUpdate, isAdmin: true });

    const advanced = screen.getByTestId("advanced-copy-action");
    expect(within(advanced).getByText(/temporariamente desativada na interface para proteger as mensagens geradas por IA/)).toBeTruthy();
    const button = within(advanced).getByText(/Atualizar C[óo]pias/).closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("Substituir mensagens pelo modelo padrão?")).toBeNull();
  });

  it("oculta a ferramenta avançada e o botão Atualizar Cópias para assinantes comuns (isAdmin = false)", () => {
    const onUpdate = vi.fn();
    const lead = makeNewLead();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, onUpdateCopiesLocally: onUpdate, isAdmin: false });

    expect(screen.queryByTestId("advanced-copy-action")).toBeNull();
    expect(screen.queryByText(/Ferramenta avançada/)).toBeNull();
  });
});

describe("LeadAnalysis · plano de 7 dias e SDR intactos", () => {
  beforeEach(() => { copyToClipboard.mockClear(); toast.mockClear(); });
  afterEach(cleanup);

  it("os 7 dias aparecem como etapas numa lista ordenada, com a mensagem exatamente como salva", () => {
    const lead = makeNewLead();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    const plan = screen.getByTestId("analysis-plan");
    expect(plan.querySelectorAll("ol > li")).toHaveLength(7);
    for (const day of lead.plano_prospecao_7dias) {
      const item = within(plan).getByTestId(`dia-${day.dia}`);
      const messageBox = within(item).getByText("Mensagem:").parentElement!.parentElement!;
      expect(messageBox.querySelector("p.whitespace-pre-wrap")!.textContent).toBe(day.mensagem);
    }
  });

  it("'Executar no SDR' por dia continua chamando o handler com o dia certo (7 botões)", () => {
    const onExecute = vi.fn();
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onExecuteInSdr: onExecute });
    const buttons = screen.getAllByText("Executar no SDR");
    expect(buttons).toHaveLength(7);
    fireEvent.click(buttons[3]);
    expect(onExecute).toHaveBeenCalledWith(4);
  });

  it("copiar mensagem copia exatamente o texto do dia", async () => {
    const lead = makeNewLead();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    fireEvent.click(screen.getByLabelText("Copiar mensagem do Dia 1"));
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(lead.plano_prospecao_7dias[0].mensagem));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copiado!" }));
  });
});

describe("LeadAnalysis · responsividade (contrato de layout)", () => {
  afterEach(cleanup);

  it("mobile em coluna única; desktop com cabeçalho em linha e dados em duas colunas", () => {
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onReanalyze: vi.fn(), onUpdateCopiesLocally: vi.fn() });
    expect(screen.getByTestId("analysis-header").className).toMatch(/flex-col/);
    expect(screen.getByTestId("analysis-header").className).toMatch(/sm:flex-row/);
    const grid = screen.getByTestId("company-data").querySelector(".grid") as HTMLElement;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-2/);
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-[2-9]/); // nunca 2+ colunas no celular
  });

  it("botões ocupam a largura no celular e encolhem no desktop; ações nunca ficam em posição absoluta", () => {
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onReanalyze: vi.fn(), onUpdateCopiesLocally: vi.fn(), onExecuteInSdr: vi.fn(), isAdmin: true });
    const buttons = [
      screen.getByTestId("btn-refinar-abordagem-ia"),
      screen.getByText(/Atualizar C[óo]pias/).closest("button")!,
      screen.getByText("Executar Dia 1 no SDR").closest("button")!,
      screen.getByText("Ver plano de 7 dias").closest("button")!,
    ];
    for (const b of buttons) {
      expect(b.className).toMatch(/w-full/);
      expect(b.className).toMatch(/sm:w-auto/);
    }
    const panel = screen.getByTestId("analysis-panel");
    expect(panel.innerHTML).not.toMatch(/(^|[\s"])absolute([\s"])/);
  });

  it("textos longos quebram dentro do contêiner e não há larguras fixas em pixels nem rolagem horizontal", () => {
    const long = "palavra".repeat(40);
    renderAnalysis({ ...makeNewLead(), nome: `Empresa ${long}`, website: `https://${long}.com.br` } as LeadProspeccao, { diagnostico: [long, `Possibilidade comercial: ${long}`] });
    const html = screen.getByTestId("analysis-panel").innerHTML;
    expect(html).not.toMatch(/(?:^|[\s"])(?:min-)?w-\[\d+px\]/);
    expect(html).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(screen.getByRole("heading", { name: new RegExp(long.slice(0, 20)) }).className).toMatch(/break-words/);
    for (const el of screen.getByTestId("analysis-summary").querySelectorAll("p")) expect(el.className).toMatch(/break-words/);
    expect(within(screen.getByTestId("fact-website")).getByText(new RegExp(long.slice(0, 20))).className).toMatch(/break-words/);
  });
});

describe("LeadAnalysis · recusa registrada (opt-out) bloqueia o contato", () => {
  beforeEach(() => { copyToClipboard.mockClear(); toast.mockClear(); });
  afterEach(cleanup);

  const optOutByStatus = () => ({ ...makeNewLead(), status: "recusou_optout" }) as unknown as LeadProspeccao;
  const optOutByNotes = () => ({ ...makeNewLead(), notas: "Cliente pediu para não contatar mais." }) as unknown as LeadProspeccao;
  const legacyPendingPlan = () => {
    const lead = { ...makeNewLead(), status: "recusou_optout" } as unknown as LeadProspeccao;
    // plano antigo salvo antes do bloqueio: tudo pendente e sem marcador bloqueado_optout
    lead.plano_prospecao_7dias = lead.plano_prospecao_7dias.map((d) => ({ ...d, status: "pendente" }) as typeof d);
    return lead;
  };

  const expectBlockedPanel = (lead: LeadProspeccao, onExecute = vi.fn()) => {
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS, onExecuteInSdr: onExecute });
    expect(screen.getByTestId("contact-blocked")).toBeTruthy();
    expect(screen.getByText("Contato bloqueado por recusa registrada")).toBeTruthy();
    expect(screen.queryByTestId("analysis-next-step")).toBeNull();
    // fora do plano (consulta), nada recomenda contato
    const plan = screen.getByTestId("analysis-plan");
    const outside = Array.from(document.body.querySelectorAll("button, p, h3, h4, span")).filter((n) => !plan.contains(n));
    expect(outside.some((n) => /Iniciar contato|Enviar mensagem|Executar Dia/i.test(n.textContent || ""))).toBe(false);
    expect(screen.queryByText(/Executar Dia/i)).toBeNull();
    expect(screen.getByTestId("plan-read-only")).toBeTruthy();
    const buttons = screen.getAllByText("Executar no SDR").map((n) => n.closest("button") as HTMLButtonElement);
    expect(buttons).toHaveLength(7);
    buttons.forEach((b) => {
      expect(b.disabled).toBe(true);
      expect(b.getAttribute("aria-disabled")).toBe("true");
    });
    return { onExecute, buttons };
  };

  it("status recusou_optout: troca o próximo passo pelo aviso e desativa os 7 botões", () => {
    expectBlockedPanel(optOutByStatus());
  });

  it("recusa explícita nas anotações: mesmo bloqueio", () => {
    expectBlockedPanel(optOutByNotes());
  });

  it("plano antigo com mensagens pendentes e sem marcador bloqueado_optout continua bloqueado", () => {
    const lead = legacyPendingPlan();
    expect(lead.plano_prospecao_7dias.some((d) => ((d as unknown as { status?: string }).status) === "bloqueado_optout")).toBe(false);
    expectBlockedPanel(lead);
  });

  it("handlers também bloqueiam: forçar o clique em botão sem 'disabled' não executa nem copia", async () => {
    const lead = optOutByStatus();
    const { onExecute, buttons } = expectBlockedPanel(lead);
    buttons[0].removeAttribute("disabled");
    fireEvent.click(buttons[0]);
    expect(onExecute).not.toHaveBeenCalled();
    const copy = screen.getByLabelText("Copiar mensagem do Dia 1") as HTMLButtonElement;
    copy.removeAttribute("disabled");
    fireEvent.click(copy);
    await new Promise((r) => setTimeout(r, 0));
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("o plano segue acessível para consulta, com as mensagens exatamente como salvas", () => {
    const lead = optOutByStatus();
    renderAnalysis(lead, { diagnostico: TYPICAL_BULLETS });
    const plan = screen.getByTestId("analysis-plan");
    const texts = Array.from(plan.querySelectorAll("p.whitespace-pre-wrap")).map((n) => n.textContent);
    expect(texts).toEqual(lead.plano_prospecao_7dias.map((d) => d.mensagem));
    expect(screen.getByText("Consultar plano de 7 dias")).toBeTruthy();
  });

  it("lead normal, sem recusa, continua podendo prospectar", () => {
    const onExecute = vi.fn();
    renderAnalysis(makeNewLead(), { diagnostico: TYPICAL_BULLETS, onExecuteInSdr: onExecute });
    expect(screen.queryByTestId("contact-blocked")).toBeNull();
    expect(screen.queryByTestId("plan-read-only")).toBeNull();
    expect(screen.getByTestId("analysis-next-step")).toBeTruthy();
    const buttons = screen.getAllByText("Executar no SDR").map((n) => n.closest("button") as HTMLButtonElement);
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    fireEvent.click(buttons[0]);
    expect(onExecute).toHaveBeenCalledWith(1);
  });
});
