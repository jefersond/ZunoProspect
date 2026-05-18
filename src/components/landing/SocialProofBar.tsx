import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";
import avatar5 from "@/assets/avatars/avatar-5.jpg";

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5];

export function SocialProofBar() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex -space-x-3">
        {avatars.map((src, i) => (
          <Avatar key={src} className="h-8 w-8 border-2 border-background">
            <AvatarImage src={src} alt={`Usuário ${i + 1}`} />
            <AvatarFallback>U{i + 1}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        Para profissionais que vendem serviços B2B e precisam abordar melhor.
      </span>
    </div>
  );
}
