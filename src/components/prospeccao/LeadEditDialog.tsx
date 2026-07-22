import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadProspeccao } from "@/types/lead";

interface LeadEditDialogProps {
  lead: LeadProspeccao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (lead: LeadProspeccao) => void;
}

interface LeadEditFields {
  nome: string;
  nome_responsavel: string;
  telefone: string;
  whatsapp_number: string;
  email: string;
  website: string;
  instagram_url: string;
  cidade: string;
  endereco: string;
  nicho: string;
}

const EMPTY_FIELDS: LeadEditFields = {
  nome: "",
  nome_responsavel: "",
  telefone: "",
  whatsapp_number: "",
  email: "",
  website: "",
  instagram_url: "",
  cidade: "",
  endereco: "",
  nicho: "",
};

function extractWhatsAppNumber(link: string | null): string {
  if (!link) return "";
  return link.match(/\d{10,15}/)?.[0] ?? "";
}

function buildFields(lead: LeadProspeccao | null): LeadEditFields {
  if (!lead) return EMPTY_FIELDS;

  return {
    nome: lead.nome ?? "",
    nome_responsavel: lead.nome_responsavel ?? "",
    telefone: lead.telefone ?? "",
    whatsapp_number: lead.whatsapp_number ?? extractWhatsAppNumber(lead.whatsapp_link),
    email: lead.email ?? "",
    website: lead.website ?? "",
    instagram_url: lead.instagram_url ?? "",
    cidade: lead.cidade ?? "",
    endereco: lead.endereco ?? "",
    nicho: lead.nicho ?? "",
  };
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeInstagram(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) {
    return `https://instagram.com/${trimmed.slice(1)}`;
  }
  return normalizeUrl(trimmed);
}

function createWhatsAppLink(whatsappNumber: string | null, telefone: string | null): string | null {
  const source = whatsappNumber || telefone;
  if (!source) return null;

  const digits = source.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function readFunctionError(error: unknown): Promise<string> {
  const functionError = error as { context?: unknown; message?: string };
  const contextResponse = functionError.context;
  if (contextResponse instanceof Response) {
    try {
      const payload: unknown = await contextResponse.clone().json();
      if (payload && typeof payload === "object") {
        const errorPayload = payload as Record<string, unknown>;
        if (typeof errorPayload.details === "string") return errorPayload.details;
        if (typeof errorPayload.error === "string") return errorPayload.error;
      }
    } catch {
      // Mantem a mensagem original quando a resposta nao for JSON.
    }
  }
  return functionError.message || "Erro ao salvar";
}

function validateFields(fields: LeadEditFields): string | null {
  if (!fields.nome.trim()) return "Informe o nome da empresa.";
  if (!fields.cidade.trim()) return "Informe a cidade do lead.";
  if (!fields.nicho.trim()) return "Informe o nicho do lead.";

  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    return "Informe um e-mail valido.";
  }

  for (const [label, value] of [
    ["Telefone", fields.telefone],
    ["WhatsApp", fields.whatsapp_number],
  ] as const) {
    if (!value.trim()) continue;
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return `${label} deve ter entre 8 e 15 digitos.`;
    }
  }

  for (const [label, value] of [
    ["Site", fields.website],
    ["Instagram", fields.instagram_url],
  ] as const) {
    if (!value.trim()) continue;
    try {
      const url = new URL(label === "Instagram" ? normalizeInstagram(value) : normalizeUrl(value));
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("invalid protocol");
    } catch {
      return `${label} precisa ser uma URL valida.`;
    }
  }

  return null;
}

export function LeadEditDialog({ lead, open, onOpenChange, onSaved }: LeadEditDialogProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<LeadEditFields>(EMPTY_FIELDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFields(buildFields(lead));
  }, [lead, open]);

  const initialFields = useMemo(() => buildFields(lead), [lead]);
  const hasChanges = JSON.stringify(fields) !== JSON.stringify(initialFields);

  function updateField(key: keyof LeadEditFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!lead) return;

    const validationError = validateFields(fields);
    if (validationError) {
      toast({ title: "Revise os dados", description: validationError, variant: "destructive" });
      return;
    }

    const normalizedFields: LeadEditFields = {
      ...fields,
      nome: fields.nome.trim(),
      nome_responsavel: fields.nome_responsavel.trim(),
      telefone: fields.telefone.trim(),
      whatsapp_number: fields.whatsapp_number.trim(),
      email: fields.email.trim().toLowerCase(),
      website: normalizeUrl(fields.website),
      instagram_url: normalizeInstagram(fields.instagram_url),
      cidade: fields.cidade.trim(),
      endereco: fields.endereco.trim(),
      nicho: fields.nicho.trim(),
    };

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-leads-secure", {
        body: {
          action: "update_core_fields",
          leadId: lead.id,
          fields: normalizedFields,
        },
      });

      if (error) throw new Error(await readFunctionError(error));
      if (!data?.success || !data?.data) throw new Error(data?.error || "A Zuno nao confirmou a alteracao.");

      const updatedData = data.data as Partial<LeadEditFields>;
      const whatsappNumber = updatedData.whatsapp_number ?? normalizedFields.whatsapp_number ?? null;
      const telefone = updatedData.telefone ?? normalizedFields.telefone ?? null;
      const updatedLead: LeadProspeccao = {
        ...lead,
        nome: updatedData.nome ?? normalizedFields.nome,
        nome_responsavel: updatedData.nome_responsavel || null,
        telefone: telefone || null,
        whatsapp_number: whatsappNumber || null,
        whatsapp_link: createWhatsAppLink(whatsappNumber || null, telefone || null),
        email: updatedData.email || null,
        website: updatedData.website || null,
        instagram_url: updatedData.instagram_url || null,
        cidade: updatedData.cidade ?? normalizedFields.cidade,
        endereco: updatedData.endereco || null,
        nicho: updatedData.nicho ?? normalizedFields.nicho,
      };

      onSaved(updatedLead);
      onOpenChange(false);
      toast({
        title: "Dados do lead atualizados",
        description: "A correcao manual ja sera usada nas proximas analises e abordagens.",
      });
    } catch (error: unknown) {
      toast({
        title: "Nao foi possivel salvar",
        description: getErrorMessage(error, "Tente novamente em alguns instantes."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Corrigir dados do lead</DialogTitle>
              <DialogDescription className="mt-1">
                Disponivel em todos os planos para corrigir os seus proprios leads.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>Os dados corrigidos ficam salvos no lead e seguem para o pipeline quando voce salvar o resultado.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-edit-name">Nome da empresa</Label>
              <Input id="lead-edit-name" value={fields.nome} onChange={(event) => updateField("nome", event.target.value)} maxLength={160} autoFocus />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-edit-owner">Nome do tomador de decisao</Label>
              <Input id="lead-edit-owner" value={fields.nome_responsavel} onChange={(event) => updateField("nome_responsavel", event.target.value)} placeholder="Ex.: Mariana Souza" maxLength={160} />
              <p className="text-xs text-muted-foreground">Use somente um nome confirmado. A IA nao deve inventar este dado.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-phone">Telefone</Label>
              <Input id="lead-edit-phone" value={fields.telefone} onChange={(event) => updateField("telefone", event.target.value)} placeholder="(11) 3333-4444" inputMode="tel" maxLength={30} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-whatsapp">WhatsApp</Label>
              <Input id="lead-edit-whatsapp" value={fields.whatsapp_number} onChange={(event) => updateField("whatsapp_number", event.target.value)} placeholder="(11) 99999-9999" inputMode="tel" maxLength={30} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-email">E-mail</Label>
              <Input id="lead-edit-email" value={fields.email} onChange={(event) => updateField("email", event.target.value)} type="email" placeholder="contato@empresa.com.br" maxLength={254} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-instagram">Instagram</Label>
              <Input id="lead-edit-instagram" value={fields.instagram_url} onChange={(event) => updateField("instagram_url", event.target.value)} placeholder="@empresa ou instagram.com/empresa" maxLength={300} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-website">Site</Label>
              <Input id="lead-edit-website" value={fields.website} onChange={(event) => updateField("website", event.target.value)} placeholder="empresa.com.br" maxLength={300} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-niche">Nicho</Label>
              <Input id="lead-edit-niche" value={fields.nicho} onChange={(event) => updateField("nicho", event.target.value)} maxLength={120} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-edit-city">Cidade</Label>
              <Input id="lead-edit-city" value={fields.cidade} onChange={(event) => updateField("cidade", event.target.value)} maxLength={120} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-edit-address">Endereco</Label>
              <Input id="lead-edit-address" value={fields.endereco} onChange={(event) => updateField("endereco", event.target.value)} maxLength={300} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !hasChanges}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar correcoes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
