import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Logo } from "@/components/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LogOut,
  User,
  Search,
  BarChart3,
  History,
  FileText,
  Bookmark,
  Kanban,
  Mail,
  Menu,
  TrendingUp,
  Zap,
  Crown,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

export interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  isAdmin?: boolean;
}

interface AppHeaderProps {
  isAdmin?: boolean;
  showUpgradeButton?: boolean;
  onUpgradeClick?: () => void;
  showRefreshButton?: boolean;
  onRefreshClick?: () => void;
  subscription?: { plan_name: string } | null;
}

const defaultNavItems: NavItem[] = [
  { to: "/prospeccao", icon: Search, label: "Prospecção" },
  { to: "/leads-salvos", icon: Bookmark, label: "Salvos" },
  { to: "/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { to: "/templates", icon: FileText, label: "Templates" },
  { to: "/historico", icon: History, label: "Histórico" },
  { to: "/relatorios", icon: TrendingUp, label: "Relatórios" },
];

export function AppHeader({
  isAdmin = false,
  showUpgradeButton = false,
  onUpgradeClick,
  showRefreshButton = false,
  onRefreshClick,
  subscription,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNavClick = (to: string) => {
    navigate(to);
    setSheetOpen(false);
  };

  const navItems = [
    ...defaultNavItems,
    ...(isAdmin
      ? [{ to: "/admin/email", icon: Mail, label: "Email", isAdmin: true }]
      : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
      <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Logo */}
          <Logo />

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 mr-2 pr-2 border-r border-white/10">
            {navItems.map((item) => (
              <Button
                key={item.to}
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.to)}
                className={`gap-2 text-zinc-300 hover:text-white hover:bg-white/10 ${
                  item.isAdmin
                    ? "text-amber-400 hover:text-amber-300"
                    : isActive(item.to)
                    ? "bg-white/10 text-white"
                    : ""
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden xl:inline">{item.label}</span>
              </Button>
            ))}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Upgrade Button */}
            {showUpgradeButton &&
              subscription?.plan_name !== "agencia" &&
              !isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onUpgradeClick}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/20 mr-2"
                >
                  <Zap className="h-4 w-4" />
                  <span>Upgrade</span>
                </Button>
              )}

            {/* Refresh Button */}
            {showRefreshButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefreshClick}
                className="text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className="gap-2 text-zinc-300 hover:text-white hover:bg-white/10"
            >
              <User className="h-4 w-4" />
              <span className="hidden xl:inline">Perfil</span>
            </Button>
            <Button
              size="sm"
              onClick={handleLogout}
              className="gap-2 ml-1 bg-white/5 hover:bg-red-500/20 text-zinc-300 hover:text-red-300 border border-white/10 hover:border-red-500/30"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Sair</span>
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex lg:hidden items-center gap-1">
            {/* Upgrade Button Mobile */}
            {showUpgradeButton &&
              subscription?.plan_name !== "agencia" &&
              !isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onUpgradeClick}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              )}

            {/* Refresh Button Mobile */}
            {showRefreshButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefreshClick}
                className="text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-white/10">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-zinc-950/95 backdrop-blur-xl border-l border-white/10">
                <SheetHeader>
                  <SheetTitle className="text-white">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 mt-6">
                  {/* Navigation Links */}
                  {navItems.map((item) => (
                    <Button
                      key={item.to}
                      variant="ghost"
                      className={`w-full justify-start gap-3 text-zinc-300 hover:text-white hover:bg-white/10 ${
                        item.isAdmin ? "text-amber-400 hover:text-amber-300" : ""
                      } ${
                        isActive(item.to) ? "bg-white/10 text-white" : ""
                      }`}
                      onClick={() => handleNavClick(item.to)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}

                  {/* Divider */}
                  <div className="border-t border-white/10 my-3" />

                  {/* Profile */}
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 text-zinc-300 hover:text-white hover:bg-white/10 ${ isActive("/profile") ? "bg-white/10 text-white" : "" }`}
                    onClick={() => handleNavClick("/profile")}
                  >
                    <User className="h-4 w-4" />
                    Perfil
                  </Button>

                  {/* Divider */}
                  <div className="border-t border-white/10 my-3" />

                  {/* Logout */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      handleLogout();
                      setSheetOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
