import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Suspense, lazy } from "react";
import { ExitIntentTracker } from "@/components/ExitIntentTracker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";
import LandingProspeccaoIA from "./pages/LandingProspeccaoIA";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { initTracking } from "@/lib/tracking";

initTracking();

// Lazy load all pages except landing page for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
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
const AdminRealtime = lazy(() => import("./pages/AdminRealtime"));
const AdminAbandonedCheckouts = lazy(() => import("./pages/AdminAbandonedCheckouts"));
const Precos = lazy(() => import("./pages/Precos"));
const DesignTokens = lazy(() => import("./pages/DesignTokens"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
);

const AppContent = () => {
  // Handle OAuth callback tokens in URL hash (clean URL + redirect)
  const { isProcessing } = useOAuthCallback();

  // Show loader while processing OAuth callback
  if (isProcessing) {
    return <PageLoader />;
  }

  return (
    <>
      <ExitIntentTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingProspeccaoIA />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/lp-prospeccao-ia" element={<Navigate to="/" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Protected Routes */}
          <Route path="/prospeccao" element={<ProtectedRoute><Prospeccao /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
          <Route path="/historico" element={<ProtectedRoute><Historico /></ProtectedRoute>} />
          <Route path="/leads-salvos" element={<ProtectedRoute><LeadsSalvos /></ProtectedRoute>} />
          <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
          <Route path="/admin" element={<Navigate to="/admin/email" replace />} />
          <Route path="/admin/email" element={<ProtectedRoute><AdminEmail /></ProtectedRoute>} />
          <Route path="/admin/realtime" element={<ProtectedRoute><AdminRealtime /></ProtectedRoute>} />
          <Route path="/admin/checkouts-abandonados" element={<ProtectedRoute><AdminAbandonedCheckouts /></ProtectedRoute>} />
          <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          
          {/* Public or informational */}
          <Route path="/precos" element={<Precos />} />
          <Route path="/preco" element={<Navigate to="/precos" replace />} />
          <Route path="/design-tokens" element={<DesignTokens />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="prospeccao-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
