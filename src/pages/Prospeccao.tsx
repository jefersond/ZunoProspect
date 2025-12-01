import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProspeccaoForm } from "@/components/prospeccao/ProspeccaoForm";
import { LeadsList } from "@/components/prospeccao/LeadsList";
import { LogOut, Search, User, BarChart3, FileText, History, Bookmark } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
const Prospeccao = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
      }
    });
  }, [navigate]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  if (!user) return null;
  return <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo e Título */}
            <div className="flex items-center gap-2 group cursor-pointer">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 rotate-180">
                <defs>
                  <linearGradient id="zGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <path d="M 8 6 L 24 6 L 24 10 L 16 10 L 24 22 L 24 26 L 8 26 L 8 22 L 16 22 L 8 10 L 8 6 Z" fill="url(#zGradient)" className="transition-all duration-500" />
              </svg>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent bg-[length:200%_100%] bg-[position:0%_50%] transition-all duration-500 group-hover:bg-[position:100%_50%]">
                Zuno
              </span>
              <span className="text-xl font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                Prospect
              </span>
            </div>

            {/* Navegação e Ações */}
            <div className="flex items-center gap-1">
              {/* Navegação Principal */}
              <nav className="flex items-center gap-1 mr-2 pr-2 border-r border-border">
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/leads-salvos")} className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Salvos</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/templates")} className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Templates</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/historico")} className="gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </Button>
              </nav>

              {/* Ações do Usuário */}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Perfil</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 ml-1">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <ProspeccaoForm />
        <LeadsList />
      </main>
    </div>;
};
export default Prospeccao;