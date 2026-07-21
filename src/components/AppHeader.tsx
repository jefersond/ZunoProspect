import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  RefreshCw,
  MoreHorizontal,
  Megaphone,
  Activity,
  ShoppingCart,
  Shield,
  Instagram,
  BrainCircuit,
  Workflow,
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
  const { signOut } = useAuth();

  const handleLogout = async () => {
    navigate("/auth", { replace: true });
    await signOut();
  };

  const handleNavClick = (to: string) => {
    navigate(to);
    setSheetOpen(false);
  };

  const navItems = [
    ...defaultNavItems,
    ...(isAdmin
      ? [
          { to: "/admin/central", icon: BrainCircuit, label: "Central", isAdmin: true },
          { to: "/admin/realtime", icon: Activity, label: "Tempo Real", isAdmin: true },
          { to: "/admin/checkouts-abandonados", icon: ShoppingCart, label: "Checkouts", isAdmin: true },
          { to: "/admin/email", icon: Mail, label: "Email", isAdmin: true },
          { to: "/admin/instagram", icon: Instagram, label: "Instagram", isAdmin: true },
          { to: "/admin/marketing", icon: Megaphone, label: "Marketing", isAdmin: true },
          { to: "/admin/funil", icon: Workflow, label: "Funil", isAdmin: true },
          { to: "/admin/system-health", icon: Shield, label: "Saúde", isAdmin: true },
        ]
      : []),
  ];
  const primaryNavItems = navItems.slice(0, 4);
  const secondaryNavItems = navItems.slice(4);

  const isActive = (path: string) => location.pathname === path;
  const hasSecondaryActive = secondaryNavItems.some((item) => isActive(item.to));

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 shadow-sm backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center px-3 sm:px-4">
        <div className="flex w-full items-center justify-between gap-2">
          {/* Logo */}
          <Logo className="shrink-0 gap-1.5 [&_svg]:h-7 [&_svg]:w-7 [&_span:first-of-type]:text-base [&_span:last-of-type]:text-base" />

          {/* Desktop Navigation */}
          <nav className="hidden min-w-0 items-center gap-1 border-r border-border/50 pr-2 lg:flex">
            {primaryNavItems.map((item) => (
              <Button
                key={item.to}
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.to)}
                className={`h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground ${
                  item.isAdmin
                    ? "text-amber-500 hover:text-amber-400"
                    : isActive(item.to)
                    ? "bg-muted/80 text-foreground"
                    : ""
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden xl:inline">{item.label}</span>
              </Button>
            ))}

            <div className="hidden items-center gap-1 2xl:flex">
              {secondaryNavItems.map((item) => (
                <Button
                  key={item.to}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(item.to)}
                  className={`h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground ${
                    item.isAdmin
                      ? "text-amber-500 hover:text-amber-400"
                      : isActive(item.to)
                      ? "bg-muted/80 text-foreground"
                      : ""
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>

            {secondaryNavItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={hasSecondaryActive ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-sm 2xl:hidden"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="hidden xl:inline">Mais</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {secondaryNavItems.map((item) => (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => navigate(item.to)}
                      className={`gap-2 ${
                        item.isAdmin
                          ? "text-amber-500 focus:text-amber-400"
                          : isActive(item.to)
                          ? "bg-muted text-foreground"
                          : ""
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden items-center gap-1 lg:flex">
            {/* Upgrade Button */}
            {showUpgradeButton &&
              subscription?.plan_name !== "agencia" &&
              !isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onUpgradeClick}
                  className="mr-1 h-8 gap-1.5 bg-emerald-600 px-2.5 text-sm text-white shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/20 hover:bg-emerald-500"
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
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}

            <ThemeToggle triggerClassName="h-8 w-8" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className="h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <User className="h-4 w-4" />
              <span className="hidden xl:inline">Perfil</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="ml-1 h-8 gap-1.5 px-2 text-sm"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Sair</span>
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-1 lg:hidden">
            {/* Upgrade Button Mobile */}
            {showUpgradeButton &&
              subscription?.plan_name !== "agencia" &&
              !isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onUpgradeClick}
                  className="h-8 gap-1 bg-emerald-600 px-2 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-500"
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
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(18rem,calc(100vw-1rem))] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 mt-6">
                  {/* Navigation Links */}
                  {navItems.map((item) => (
                    <Button
                      key={item.to}
                      variant={isActive(item.to) ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 ${
                        item.isAdmin ? "text-amber-500 hover:text-amber-400" : ""
                      }`}
                      onClick={() => handleNavClick(item.to)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}

                  {/* Divider */}
                  <div className="border-t border-border my-3" />

                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-muted-foreground">Tema</span>
                    <ThemeToggle triggerClassName="h-8 w-8" />
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border my-3" />

                  {/* Profile */}
                  <Button
                    variant={isActive("/profile") ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => handleNavClick("/profile")}
                  >
                    <User className="h-4 w-4" />
                    Perfil
                  </Button>

                  {/* Logout */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive"
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
