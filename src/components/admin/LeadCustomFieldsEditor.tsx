import { useState } from "react";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId: string;
  initialFields: Record<string, string>;
  onSave?: (fields: Record<string, string>) => void;
}

interface EditingField {
  key: string;
  value: string;
}

export function LeadCustomFieldsEditor({ leadId, initialFields, onSave }: Props) {
  const [fields, setFields] = useState<Record<string, string>>(initialFields ?? {});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  async function persist(updated: Record<string, string>) {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_update_lead_custom_fields", {
        p_lead_id: leadId,
        p_custom_fields: updated,
      });
      if (error) throw error;
      setFields(updated);
      onSave?.(updated);
      toast.success("Campo salvo.");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(fields[key]);
  }

  async function confirmEdit(key: string) {
    if (!editValue.trim()) return;
    const updated = { ...fields, [key]: editValue.trim() };
    await persist(updated);
    setEditingKey(null);
  }

  async function deleteField(key: string) {
    const updated = { ...fields };
    delete updated[key];
    await persist(updated);
  }

  async function addField() {
    const k = newKey.trim();
    const v = newValue.trim();
    if (!k || !v) {
      toast.error("Preencha o nome e o valor do campo.");
      return;
    }
    if (fields[k] !== undefined) {
      toast.error("Este campo já existe. Edite-o na lista.");
      return;
    }
    const updated = { ...fields, [k]: v };
    await persist(updated);
    setNewKey("");
    setNewValue("");
    setShowAdd(false);
  }

  const fieldEntries = Object.entries(fields);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Campos customizados
        </p>
        {!showAdd && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        )}
      </div>

      {fieldEntries.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground italic">
          Nenhum campo extra adicionado ainda.
        </p>
      )}

      <div className="space-y-2">
        {fieldEntries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 group">
            <Badge variant="outline" className="text-xs shrink-0 max-w-[120px] truncate">
              {key}
            </Badge>

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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => confirmEdit(key)}
                  disabled={saving}
                >
                  <Check className="w-3 h-3 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingKey(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs flex-1 text-foreground truncate">{value}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startEdit(key)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteField(key)}
                  disabled={saving}
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium">Novo campo</p>
          <Input
            placeholder="Nome do campo (ex: Cargo)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="h-7 text-xs"
          />
          <Input
            placeholder="Valor (ex: CEO)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && addField()}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={addField} disabled={saving}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setShowAdd(false); setNewKey(""); setNewValue(""); }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
