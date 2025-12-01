import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import Auth from "./pages/Auth";
import Prospeccao from "./pages/Prospeccao";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Historico from "./pages/Historico";
import LeadsSalvos from "./pages/LeadsSalvos";
import LandingProspeccaoIA from "./pages/LandingProspeccaoIA";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="prospeccao-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingProspeccaoIA />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lp-prospeccao-ia" element={<Navigate to="/" replace />} />
            <Route path="/prospeccao" element={<Prospeccao />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/leads-salvos" element={<LeadsSalvos />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
