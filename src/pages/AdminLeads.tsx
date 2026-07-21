import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useSubscription } from "@/hooks/useSubscription";
import { LeadCustomFieldsEditor } from "@/components/admin/LeadCustomFieldsEditor";
import { LeadEditDialog } from "@/components/prospeccao/LeadEditDialog";
import { transformSecureLead } from "@/hooks/useSecureLeads";
import { toast } from "sonner";
import { LeadDataQualityBadge, buildDataQualitySummary } from "@/components/admin/LeadDataQualityBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Loader2, Pencil } from "lucide-react";
import type { LeadProspeccao } from "@/types/lead";

const PAGE_SIZE = 50;

export default function AdminLeads() {
  const { subscription, isAdmin } = useSubscription();
  const [leads, setLeads] = useState<LeadProspeccao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<LeadProspeccao | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("leads")
        .select(
          `id, nome, cidade, nicho, foco, status, probabilidade_conversao,
           rating, total_reviews, nome_responsavel,
           custom_fields, data_sources, ai_used_fallback, ai_fallback_reason,
           created_at, notas, salvo`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (query.trim()) {
        q = q.or(
          `nome.ilike.%${query}%,cidade.ilike.%${query}%,nicho.ilike.%${query}%`
        );
      }

      const { data, error, count } = await q;
      if (error) throw error;
      setLeads((data as unknown as LeadProspeccao[]) ?? []);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function openLeadDetails(lead: LeadProspeccao) {
    setSelected(lead);
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-leads-secure", {
        body: { action: "view_detail", leadId: lead.id },
      });
      if (error) throw error;
      if (!data?.data) throw new Error(data?.error || "Detalhes do lead nao encontrados.");

      const secureLead = transformSecureLead(data.data);
      setSelected((current) =>
        current?.id === lead.id ? { ...current, ...secureLead } : current
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar os dados seguros.";
      toast.error(message);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    fetchLeads();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={isAdmin} showUpgradeButton={false} subscription={subscription} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Leads</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString("pt-BR")} leads no banco · admin only
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Busca */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou nicho…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" size="sm">Buscar</Button>
        </form>

        {/* Tabela */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Empresa</TableHead>
                <TableHead>Cidade / Nicho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Qualidade</TableHead>
                <TableHead>Campos extra</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {loading ? "Carregando…" : "Nenhum lead encontrado."}
                  </TableCell>
                </TableRow>
              )}
              {leads.map((lead) => {
                const quality = buildDataQualitySummary(lead);
                const customCount = Object.keys(lead.custom_fields ?? {}).length;
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openLeadDetails(lead)}
                  >
                    <TableCell className="font-medium truncate max-w-[180px]">
                      {lead.nome}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.cidade} · {lead.nicho}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.probabilidade_conversao ?? "—"}
                    </TableCell>
                    <TableCell>
                      <LeadDataQualityBadge quality={quality} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {customCount > 0 ? `${customCount} campo${customCount > 1 ? "s" : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openLeadDetails(lead);
                        }}
                        className="h-8 text-xs text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Painel lateral de detalhes */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-lg">{selected.nome}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {selected.cidade} · {selected.nicho}
                </p>
              </SheetHeader>

              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  disabled={detailLoading}
                  className="w-full border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                >
                  {detailLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="mr-2 h-4 w-4" />
                  )}
                  {detailLoading ? "Carregando dados seguros..." : "Corrigir dados do lead"}
                </Button>
              </div>

              <div className="space-y-6">
                {/* Qualidade dos dados */}
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Qualidade dos dados
                  </p>
                  <LeadDataQualityBadge quality={buildDataQualitySummary(selected)} />
                  {selected.ai_used_fallback && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      A IA usou fallback nesta análise
                      {selected.ai_fallback_reason && `: ${selected.ai_fallback_reason}`}
                    </p>
                  )}
                </section>

                {/* Dados básicos */}
                <section className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Dados do lead
                  </p>
                  {[
                    { label: "Status", value: selected.status },
                    { label: "Score IA", value: selected.probabilidade_conversao ? `${selected.probabilidade_conversao}%` : null },
                    { label: "Rating", value: selected.rating ? `${selected.rating} ⭐ (${selected.total_reviews} avaliações)` : null },
                    { label: "WhatsApp", value: selected.whatsapp_link },
                    { label: "Email", value: selected.email },
                  ].map(({ label, value }) =>
                    value ? (
                      <div key={label} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground min-w-[90px]">{label}</span>
                        <span className="text-foreground break-all">{value}</span>
                      </div>
                    ) : null
                  )}
                </section>

                {/* Dados principais (editáveis) */}

                {/* Campos customizáveis */}
                <section className="border-t pt-4">
                  <LeadCustomFieldsEditor
                    leadId={selected.id}
                    initialFields={selected.custom_fields ?? {}}
                    onSave={(fields) => {
                      setSelected((prev) => prev ? { ...prev, custom_fields: fields } : prev);
                      setLeads((prev) =>
                        prev.map((l) => l.id === selected.id ? { ...l, custom_fields: fields } : l)
                      );
                    }}
                  />
                </section>

                {/* Notas */}
                {selected.notas && (
                  <section className="border-t pt-4 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Notas
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{selected.notas}</p>
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <LeadEditDialog
        lead={selected}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={(updatedLead) => {
          setSelected(updatedLead);
          setLeads((current) =>
            current.map((lead) => lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead)
          );
        }}
      />
    </div>
  );
}
