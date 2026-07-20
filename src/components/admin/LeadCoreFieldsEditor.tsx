import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoreFields {
  nome: string;
  whatsapp_link: string | null;
  email: string | null;
  website: string | null;
  instagram_url: string | null;
  cidade: string;
  endereco: string | null;
  nome_responsavel: string | null;
}

interface Props {
  leadId: string;
  initialFields: CoreFields;
  onSave?: (fields: CoreFields) => void;
}

const FIELD_LABELS: { key: keyof CoreFields; label: string }[] = [
  { key: "nome", label: "Nome da empresa" },
  { key: "nome_responsavel", label: "Nome de quem decide" },
  { key: "whatsapp_link", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "website", label: "Site" },
  { key: "instagram_url", label: "Instagram" },
  { key: "cidade", label: "Cidade" },
  { key: "endereco", label: "Endereço" },
];

export function LeadCoreFieldsEditor({ leadId, initialFields, onSave }: Props) {
  const [fields, setFields] = useState<CoreFields>(initialFields);
  const [editingKey, setEditingKey] = useState<keyof CoreFields | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(key: keyof CoreFields) {
    setEditingKey(key);
    setEditValue(fields[key] ?? "");
  }

  async function confirmEdit(key: keyof CoreFields) {
    setSaving(true);
    try {
      const rpcArgs: Record<string, string | null> = { p_lead_id: leadId };
      const rpcParamMap: Record<keyof CoreFields, string> = {
        nome: "p_nome",
        whatsapp_link: "p_whatsapp_link",
        email: "p_email",
        website: "p_website",
        instagram_url: "p_instagram_url",
        cidade: "p_cidade",
        endereco: "p_endereco",
        nome_responsavel: "p_nome_responsavel",
      };
      rpcArgs[rpcParamMap[key]] = editValue.trim();

      const { data, error } = await supabase.rpc("admin_update_lead_core_fields", rpcArgs);
      if (error) throw error;

      const updated = { ...fields, [key]: editValue.trim() };
      setFields(updated);
      onSave?.(updated);
      toast.success("Campo corrigido.");
      setEditingKey(null);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Dados do lead (editar se estiver errado)
      </p>
      {FIELD_LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2 group">
          <span className="text-xs text-muted-foreground min-w-[110px] shrink-0">{label}</span>
          {editingKey === key ? (
            <>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmEdit(key);
                  if (e.key === "Escape") setEditingKey(null);
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => confirmEdit(key)} disabled={saving}>
                <Check className="w-3 h-3 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingKey(null)}>
                <X className="w-3 h-3" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs flex-1 text-foreground truncate">
                {fields[key] || <span className="italic text-muted-foreground">vazio</span>}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => startEdit(key)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
