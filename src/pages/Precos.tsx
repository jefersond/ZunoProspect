import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrecosSection } from "@/components/landing/PrecosSection";
import { Logo } from "@/components/Logo";

export default function Precos() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header simples */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/?no_redirect=true" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao site
            </Link>
          </Button>
        </div>
      </header>

      {/* Seção de preços */}
      <main>
        <PrecosSection />
      </main>

      {/* Footer simples */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Zuno. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Dúvidas? Entre em contato pelo WhatsApp ou email.
          </p>
        </div>
      </footer>
    </div>
  );
}
