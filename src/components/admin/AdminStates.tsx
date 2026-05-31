import React, { useState } from "react";
import { Loader2, AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// 1. AdminLoadingState - Spinner discreto com texto contextualizado
interface AdminLoadingStateProps {
  message?: string;
}

export const AdminLoadingState: React.FC<AdminLoadingStateProps> = ({
  message = "Carregando dados do painel administrativo..."
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] p-8 rounded-lg border border-[#1f2d29] bg-[#111816] text-[#f4f4f5]">
      <Loader2 className="h-10 w-10 animate-spin text-[#10d98a] mb-4" />
      <p className="text-sm font-medium text-[#9ca3af] animate-pulse">{message}</p>
    </div>
  );
};

// 2. AdminErrorState - Card de erro elegante com detalhes recolhíveis e ação de retry
interface AdminErrorStateProps {
  title?: string;
  description?: string;
  error?: any;
  onRetry?: () => void;
}

export const AdminErrorState: React.FC<AdminErrorStateProps> = ({
  title = "Não foi possível carregar os dados",
  description = "Verifique as permissões de acesso, chaves de configuração ou a conexão com o Supabase.",
  error,
  onRetry
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const errorMessage = error?.message || (typeof error === "string" ? error : JSON.stringify(error));

  return (
    <Card className="bg-[#111816] border-red-500/20 text-[#f4f4f5] max-w-2xl mx-auto my-6 overflow-hidden shadow-xl">
      <CardHeader className="border-b border-[#1f2d29] pb-4 flex flex-row items-start gap-4 space-y-0">
        <div className="p-2.5 rounded-full bg-red-500/10 text-red-400 shrink-0 mt-0.5">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-slate-100">{title}</CardTitle>
          <CardDescription className="text-xs text-[#9ca3af]">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <div className="space-y-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-[#10d98a] hover:underline focus:outline-none"
            >
              {showDetails ? "Ocultar detalhes técnicos" : "Exibir detalhes técnicos"}
            </button>
            {showDetails && (
              <pre className="text-[11px] font-mono bg-[#0b0f0e] border border-[#1f2d29] rounded p-3 text-red-400/90 max-h-[160px] overflow-auto whitespace-pre-wrap">
                {errorMessage}
              </pre>
            )}
          </div>
        )}
        {onRetry && (
          <Button
            onClick={onRetry}
            className="w-full sm:w-auto bg-[#111816] border border-[#1f2d29] text-[#f4f4f5] hover:bg-[#1f2d29] hover:text-[#10d98a] gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// 3. AdminEmptyState - Estado para visualizações sem registros
interface AdminEmptyStateProps {
  title?: string;
  description?: string;
  actionButton?: React.ReactNode;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  title = "Nenhum registro encontrado",
  description = "Não há dados cadastrados nesta área do painel para o período selecionado.",
  actionButton
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[280px] p-8 rounded-lg border border-[#1f2d29] bg-[#111816] text-[#f4f4f5]">
      <div className="p-3 rounded-full bg-[#0b0f0e] text-[#9ca3af] mb-4 border border-[#1f2d29]">
        <Inbox className="h-8 w-8 opacity-75" />
      </div>
      <h3 className="text-base font-bold text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-[#9ca3af] max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionButton}
    </div>
  );
};

// 4. AdminSectionCard - Card padrão es escuro do painel Zuno
interface AdminSectionCardProps {
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const AdminSectionCard: React.FC<AdminSectionCardProps> = ({
  title,
  description,
  headerActions,
  children,
  className = ""
}) => {
  return (
    <Card className={`bg-[#111816] border-[#1f2d29] text-[#f4f4f5] shadow-md ${className}`}>
      <CardHeader className="border-b border-[#1f2d29] pb-4 flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-slate-100">{title}</CardTitle>
          {description && <CardDescription className="text-xs text-[#9ca3af]">{description}</CardDescription>}
        </div>
        {headerActions && <div className="shrink-0">{headerActions}</div>}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
};

// 5. AdminRetryButton - Botão simples de retentativa de ações
interface AdminRetryButtonProps {
  onClick: () => void;
  loading?: boolean;
  className?: string;
}

export const AdminRetryButton: React.FC<AdminRetryButtonProps> = ({
  onClick,
  loading = false,
  className = ""
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={`border-[#1f2d29] bg-[#111816] text-[#f4f4f5] hover:bg-[#1f2d29] hover:text-[#10d98a] gap-2 ${className}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#10d98a]" : ""}`} />
      Atualizar dados
    </Button>
  );
};
