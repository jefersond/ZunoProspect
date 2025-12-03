import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

export function LPHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Logo className="[&_svg]:w-6 [&_svg]:h-6 sm:[&_svg]:w-8 sm:[&_svg]:h-8 [&_span:first-of-type]:text-base sm:[&_span:first-of-type]:text-xl [&_span:last-of-type]:text-base sm:[&_span:last-of-type]:text-xl" />

          <nav className="hidden lg:flex items-center gap-6">
            {[
              { id: "como-funciona", label: "Como funciona" },
              { id: "depoimentos", label: "Depoimentos" },
              { id: "para-quem", label: "Para quem é" },
              { id: "precos", label: "Preços" },
              { id: "faq", label: "FAQ" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <a href="/auth?tab=login">Entrar</a>
            </Button>
            <Button size="sm" onClick={() => scrollToSection("precos")}>
              Começar
            </Button>
          </div>

          <div className="flex lg:hidden items-center gap-2">
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <nav className="flex flex-col gap-4 mt-8">
                  {[
                    { id: "como-funciona", label: "Como funciona" },
                    { id: "depoimentos", label: "Depoimentos" },
                    { id: "para-quem", label: "Para quem é" },
                    { id: "precos", label: "Preços" },
                    { id: "faq", label: "FAQ" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="text-left py-3 px-4 rounded-lg hover:bg-secondary transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t pt-4 mt-2 space-y-3">
                    <Button variant="outline" className="w-full" asChild>
                      <a href="/auth?tab=login">Entrar</a>
                    </Button>
                    <Button className="w-full" onClick={() => scrollToSection("precos")}>
                      Começar agora
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
