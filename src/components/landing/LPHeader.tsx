import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { appendReferralToPath } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";

const navItems = [
  { id: "como-funciona", label: "Como funciona" },
  { id: "para-quem", label: "Para quem é" },
  { id: "funcionalidades", label: "Funcionalidades" },
  { id: "precos", label: "Preços" },
  { id: "faq", label: "FAQ" },
];

export function LPHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    if (id === "precos") {
      trackEvent("cta_clicked", { cta: "ver_planos", location: "header" });
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <Logo className="[&_svg]:h-6 [&_svg]:w-6 sm:[&_svg]:h-8 sm:[&_svg]:w-8 [&_span:first-of-type]:text-base sm:[&_span:first-of-type]:text-xl [&_span:last-of-type]:text-base sm:[&_span:last-of-type]:text-xl" />

          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <Button variant="ghost" className="text-sm font-medium transition-colors hover:bg-primary/5 hover:text-primary" asChild>
              <Link to={appendReferralToPath("/auth")}>Entrar</Link>
            </Button>
            <Button className="bg-primary px-6 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90" onClick={() => trackEvent("cta_clicked", { cta: "comecar_gratis", location: "header" })} asChild>
              <Link to={appendReferralToPath("/auth?tab=signup")}>Começar grátis</Link>
            </Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <nav className="mt-8 flex flex-col gap-4">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="rounded-lg px-4 py-3 text-left transition-colors hover:bg-secondary"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mt-2 space-y-3 border-t pt-4">
                    <Button className="w-full" onClick={() => trackEvent("cta_clicked", { cta: "comecar_gratis", location: "mobile_header" })} asChild>
                      <Link to={appendReferralToPath("/auth?tab=signup")}>Começar grátis</Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to={appendReferralToPath("/auth?tab=login")}>Entrar</Link>
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
