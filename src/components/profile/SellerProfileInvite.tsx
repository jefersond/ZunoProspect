import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isSellerProfileComplete, openSellerProfileDialog, useSellerProfileState } from "@/lib/sellerProfile";

const dismissKey = (userId: string) => `zuno_seller_profile_invite_dismissed:${userId}`;
const wasDismissed = (userId: string) => {
  try {
    return sessionStorage.getItem(dismissKey(userId)) === "1";
  } catch {
    return false;
  }
};

/**
 * Convite discreto para completar o perfil comercial. Não bloqueia nada: pode ser dispensado nesta visita e volta na
 * próxima. A exigência real só existe antes de uma nova análise personalizada com IA.
 */
export const SellerProfileInvite = () => {
  const { userId, profile, loaded } = useSellerProfileState();
  const [, force] = useState(0);
  if (!userId || !loaded || isSellerProfileComplete(profile) || wasDismissed(userId)) return null;

  return (
    <div
      className="mb-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      data-testid="seller-profile-invite"
    >
      <p className="text-muted-foreground">
        Conte ao Zuno o que você vende. Com isso as mensagens saem em seu nome e com a sua oferta. Leva 1 minuto e você pode editar depois.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={openSellerProfileDialog}>Completar perfil</Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try { sessionStorage.setItem(dismissKey(userId), "1"); } catch { /* sem armazenamento: some só nesta tela */ }
            force((n) => n + 1);
          }}
        >
          Agora não
        </Button>
      </div>
    </div>
  );
};
