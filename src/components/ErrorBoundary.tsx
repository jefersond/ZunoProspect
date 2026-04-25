import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary global — captura erros de runtime do React e exibe
 * um banner de debug com a causa real, evitando a "tela branca".
 *
 * Também registra erros globais (window.onerror / unhandledrejection)
 * para capturar falhas fora da árvore React (ex: chunks dinâmicos).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado:", error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleRejection);
  }

  handleWindowError = (event: ErrorEvent) => {
    const msg = event.message || "";
    // Captura especialmente falhas de carregamento de chunk (lazy import)
    if (
      msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed")
    ) {
      this.setState({
        hasError: true,
        error: new Error(`Falha ao carregar módulo: ${msg}`),
      });
    }
  };

  handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason);
    if (
      msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch dynamically imported module")
    ) {
      this.setState({
        hasError: true,
        error: new Error(`Falha ao carregar módulo: ${msg}`),
      });
    }
  };

  handleReload = () => {
    // Reload forçado para buscar versão nova (após deploy)
    window.location.reload();
  };

  handleClear = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { error, errorInfo } = this.state;
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0a0a0a",
            color: "#fff",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            padding: "24px",
            overflow: "auto",
          }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div
              style={{
                background: "#1a0000",
                border: "1px solid #ff4444",
                borderRadius: 8,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 28 }}>⚠️</span>
                <h1
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    margin: 0,
                    color: "#ff6b6b",
                  }}
                >
                  Erro na aplicação
                </h1>
              </div>
              <p style={{ color: "#ccc", fontSize: 14, marginBottom: 8 }}>
                A aplicação encontrou um erro de runtime. Detalhes abaixo:
              </p>
              <div
                style={{
                  background: "#000",
                  border: "1px solid #333",
                  borderRadius: 4,
                  padding: 12,
                  fontSize: 13,
                  color: "#ff8a8a",
                  wordBreak: "break-word",
                }}
              >
                <strong>{error.name}:</strong> {error.message}
              </div>
            </div>

            {error.stack && (
              <details
                open
                style={{
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "#88ff88",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Stack trace
                </summary>
                <pre
                  style={{
                    fontSize: 12,
                    color: "#ddd",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    marginTop: 8,
                  }}
                >
                  {error.stack}
                </pre>
              </details>
            )}

            {errorInfo?.componentStack && (
              <details
                style={{
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "#88aaff",
                    fontWeight: 600,
                  }}
                >
                  Componente onde ocorreu
                </summary>
                <pre
                  style={{
                    fontSize: 12,
                    color: "#ddd",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    marginTop: 8,
                  }}
                >
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={this.handleReload}
                style={{
                  background: "#22c55e",
                  color: "#000",
                  border: "none",
                  borderRadius: 6,
                  padding: "10px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Recarregar página
              </button>
              <button
                onClick={this.handleClear}
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: 6,
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Tentar continuar
              </button>
            </div>

            <p style={{ color: "#666", fontSize: 12, marginTop: 16 }}>
              Dica: abra o Console do navegador (F12) para mais detalhes. Em
              produção, este painel só aparece quando há erro real — não afeta
              o funcionamento normal.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
