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
    <header className="sticky top-0 z-50 border-b border-[#20312A]/40 bg-[#07100D]/95 backdrop-blur-md text-[#F3F7F5]">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <Logo className="[&_svg]:h-6 [&_svg]:w-6 sm:[&_svg]:h-8 sm:[&_svg]:w-8 [&_span:first-of-type]:text-base sm:[&_span:first-of-type]:text-xl [&_span:last-of-type]:text-base sm:[&_span:last-of-type]:text-xl [&_span]:text-[#F3F7F5]" />

          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm text-[#A9B8B1] transition-colors hover:text-[#F3F7F5]"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <Button variant="ghost" className="text-sm font-medium text-[#A9B8B1] transition-colors hover:bg-[#12D98B]/5 hover:text-[#21E6A0]" asChild>
              <Link to={appendReferralToPath("/auth")}>Entrar</Link>
            </Button>
            <Button 
              className="bg-[#12D98B] px-6 text-[#07100D] font-bold shadow-lg shadow-[#12D98B]/20 hover:bg-[#21E6A0] hover:scale-[1.02] transition-transform" 
              onClick={() => {
                trackEvent("cta_clicked", { cta: "comecar_gratis", location: "header" });
                scrollToSection("precos");
              }}
            >
              Começar teste grátis
            </Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2 text-[#A9B8B1] hover:text-[#F3F7F5]">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] bg-[#07100D] border-l border-[#20312A] text-[#F3F7F5]">
                <nav className="mt-8 flex flex-col gap-4">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="rounded-lg px-4 py-3 text-left transition-colors text-[#A9B8B1] hover:bg-[#0D1713] hover:text-[#F3F7F5]"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mt-2 space-y-3 border-t border-[#20312A] pt-4">
                    <Button 
                      className="w-full bg-[#12D98B] text-[#07100D] font-bold hover:bg-[#21E6A0]" 
                      onClick={() => {
                        trackEvent("cta_clicked", { cta: "comecar_gratis", location: "mobile_header" });
                        scrollToSection("precos");
                      }}
                    >
                      Começar teste grátis
                    </Button>
                    <Button variant="outline" className="w-full border-[#20312A] text-[#F3F7F5] hover:bg-[#12D98B]/5" asChild>
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
