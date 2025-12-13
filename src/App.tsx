import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, Suspense, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExitIntentTracker } from "@/components/ExitIntentTracker";
import LandingProspeccaoIA from "./pages/LandingProspeccaoIA";

// Lazy load all pages except landing page for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Prospeccao = lazy(() => import("./pages/Prospeccao"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Templates = lazy(() => import("./pages/Templates"));
const Historico = lazy(() => import("./pages/Historico"));
const LeadsSalvos = lazy(() => import("./pages/LeadsSalvos"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const AdminEmail = lazy(() => import("./pages/AdminEmail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
);

const AppContent = () => {
  // Removed the beforeunload logout mechanism that was causing unexpected
  // page reloads and session loss. The "remember me" preference is now handled
  // by Supabase's native session persistence (localStorage vs sessionStorage).

  return (
    <>
      <ExitIntentTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingProspeccaoIA />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/lp-prospeccao-ia" element={<Navigate to="/" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/prospeccao" element={<Prospeccao />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/leads-salvos" element={<LeadsSalvos />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/admin/email" element={<AdminEmail />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/checkout" element={<Checkout />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="prospeccao-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
