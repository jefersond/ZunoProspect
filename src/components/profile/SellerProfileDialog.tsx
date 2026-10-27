import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_SELLER_PROFILE,
  MIN_OFFER_DESCRIPTION_CHARS,
  SELLER_PROFILE_FIELD_LABELS,
  closeSellerProfileDialog,
  loadSellerProfileForUser,
  missingSellerProfileFields,
  saveSellerProfile,
  useSellerProfileState,
  type SellerProfile,
} from "@/lib/sellerProfile";

export const SellerProfileDialog = () => {
  const { dialogOpen, profile } = useSellerProfileState();
  const { toast } = useToast();
  const [draft, setDraft] = useState<SellerProfile>(EMPTY_SELLER_PROFILE);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      setDraft(profile);
      setTouched(false);
    }
  }, [dialogOpen, profile]);

  const missing = missingSellerProfileFields(draft);
  const update = (key: keyof SellerProfile) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSave = async () => {
    setTouched(true);
    if (missing.length) return;
    setSaving(true);
    try {
      await saveSellerProfile(draft);
      toast({ title: "Perfil comercial salvo", description: "As próximas análises vão usar o que você descreveu." });
      closeSellerProfileDialog();
    } catch (error) {
      toast({ variant: "destructive", title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof SellerProfile) =>
    touched && missing.includes(key) ? (
      <p className="text-xs text-destructive">
        {key === "offer_description"
          ? `Descreva com pelo menos ${MIN_OFFER_DESCRIPTION_CHARS} caracteres o que você faz de concreto.`
          : `${SELLER_PROFILE_FIELD_LABELS[key]} é obrigatório.`}
      </p>
    ) : null;

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeSellerProfileDialog()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seu perfil comercial</DialogTitle>
          <DialogDescription>
            O Zuno usa estas informações para escrever mensagens em seu nome. Sem elas, ele não gera mensagens comerciais, para não inventar o que você vende.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seller-display-name">{SELLER_PROFILE_FIELD_LABELS.display_name}</Label>
            <Input id="seller-display-name" value={draft.display_name} onChange={update("display_name")} placeholder="Como você se apresenta (ex.: Marina)" maxLength={60} />
            {fieldError("display_name")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seller-company">{SELLER_PROFILE_FIELD_LABELS.company_name} <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="seller-company" value={draft.company_name} onChange={update("company_name")} placeholder="Nome da sua empresa ou agência" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seller-service">{SELLER_PROFILE_FIELD_LABELS.service_offered}</Label>
            <Input id="seller-service" value={draft.service_offered} onChange={update("service_offered")} placeholder="Ex.: Criação de sites para negócios locais" maxLength={120} />
            {fieldError("service_offered")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seller-offer">{SELLER_PROFILE_FIELD_LABELS.offer_description}</Label>
            <Textarea id="seller-offer" value={draft.offer_description} onChange={update("offer_description")} rows={4} maxLength={600}
              placeholder="O que exatamente você entrega? Ex.: faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas." />
            <p className="text-xs text-muted-foreground">{draft.offer_description.length}/600</p>
            {fieldError("offer_description")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seller-audience">{SELLER_PROFILE_FIELD_LABELS.target_audience} <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea id="seller-audience" value={draft.target_audience} onChange={update("target_audience")} rows={2} maxLength={300} placeholder="Ex.: oficinas e comércio local da Grande Vitória" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeSellerProfileDialog} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Montado uma vez no App: carrega o perfil do usuário logado e hospeda o formulário. */
export const SellerProfileHost = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    void loadSellerProfileForUser(userId);
  }, [userId]);

  return <SellerProfileDialog />;
};
