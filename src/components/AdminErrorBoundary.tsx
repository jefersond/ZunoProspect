import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AdminErrorBoundary] Erro crítico capturado:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const isDev = process.env.NODE_ENV === "development";
      const errorMessage = this.state.error.message || String(this.state.error);

      return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#0b0f0e] p-6 text-[#f4f4f5]">
          <Card className="bg-[#111816] border-red-500/20 text-[#f4f4f5] max-w-2xl w-full shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-[#1f2d29] pb-5 flex flex-row items-start gap-4 space-y-0">
              <div className="p-3 rounded-full bg-red-500/10 text-red-400 shrink-0 mt-0.5 border border-red-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-black text-slate-100">
                  Não foi possível carregar esta área do admin
                </CardTitle>
                <CardDescription className="text-xs text-[#9ca3af]">
                  Ocorreu uma exceção crítica ao renderizar esta aba. Você pode tentar novamente ou retornar ao painel principal.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {/* Informações detalhadas do erro (apenas em desenvolvimento ou com detalhes técnicos) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Detalhes técnicos:</div>
                <div className="text-[11px] font-mono bg-[#0b0f0e] border border-[#1f2d29] rounded-md p-3 text-red-400/90 max-h-[180px] overflow-auto whitespace-pre-wrap leading-relaxed">
                  <strong>{this.state.error.name || "Error"}:</strong> {errorMessage}
                  {isDev && this.state.error.stack && (
                    <div className="mt-2 pt-2 border-t border-[#1f2d29] text-[#9ca3af]/80">
                      {this.state.error.stack}
                    </div>
                  )}
                  {isDev && this.state.errorInfo?.componentStack && (
                    <div className="mt-2 pt-2 border-t border-[#1f2d29] text-[#9ca3af]/80">
                      <strong>Component stack:</strong>
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={this.handleRetry}
                  className="flex-1 bg-[#10d98a] hover:bg-[#10d98a]/90 text-[#0b0f0e] font-bold gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1 border-[#1f2d29] bg-[#111816] hover:bg-[#1f2d29] hover:text-[#10d98a] gap-2 text-[#f4f4f5]"
                >
                  <Home className="h-4 w-4" />
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
