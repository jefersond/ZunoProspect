import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
}

const CHUNK_RELOAD_KEY = "zuno_chunk_reload_attempted";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return String(error);
}

function isChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);

  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError")
  );
}

async function clearRelevantCaches() {
  if (!("caches" in window)) {
    return;
  }

  try {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  } catch (error) {
    console.warn("[ErrorBoundary] Nao foi possivel limpar CacheStorage:", error);
  }
}

/**
 * ErrorBoundary global: captura erros de runtime do React e evita tela branca.
 *
 * Tambem registra erros globais (window.onerror / unhandledrejection)
 * para capturar falhas fora da arvore React, como chunks dinamicos antigos.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isChunkError: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado:", error, errorInfo);

    if (this.handleChunkError(error)) {
      return;
    }

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

  handleChunkError = (error: unknown) => {
    if (!isChunkLoadError(error)) {
      return false;
    }

    const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);

    if (!alreadyReloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");

      void clearRelevantCaches().finally(() => {
        window.location.reload();
      });

      return true;
    }

    const message = getErrorMessage(error);
    this.setState({
      hasError: true,
      error: new Error(message || "Falha ao carregar modulo dinamico"),
      isChunkError: true,
    });

    return true;
  };

  handleWindowError = (event: ErrorEvent) => {
    const error = event.error ?? event.message;

    if (this.handleChunkError(error)) {
      event.preventDefault();
    }
  };

  handleRejection = (event: PromiseRejectionEvent) => {
    if (this.handleChunkError(event.reason)) {
      event.preventDefault();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClear = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
    });
  };

  renderChunkError() {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1
            style={{
              color: "#0f172a",
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.3,
              margin: "0 0 8px",
            }}
          >
            Atualizamos o sistema.
          </h1>
          <p
            style={{
              color: "#475569",
              fontSize: 15,
              lineHeight: 1.6,
              margin: "0 0 20px",
            }}
          >
            Recarregue a página para continuar.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "10px 16px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  renderRuntimeError() {
    const { error, errorInfo } = this.state;

    if (!error) {
      return null;
    }

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
              <span style={{ fontSize: 28 }}>!</span>
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
            produção, este painel só aparece quando há erro real e não afeta o
            funcionamento normal.
          </p>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.state.isChunkError ? this.renderChunkError() : this.renderRuntimeError();
    }

    return this.props.children;
  }
}
