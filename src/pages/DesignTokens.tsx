import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, Download, Palette } from "lucide-react";

// Tokens espelham src/index.css. Mantenha em sincronia se editar o CSS.
const LIGHT_TOKENS: Record<string, string> = {
  background: "oklch(0.9551 0 0)",
  foreground: "oklch(0.3211 0 0)",
  card: "oklch(0.9702 0 0)",
  "card-foreground": "oklch(0.3211 0 0)",
  popover: "oklch(0.9702 0 0)",
  "popover-foreground": "oklch(0.3211 0 0)",
  primary: "oklch(0.4891 0 0)",
  "primary-foreground": "oklch(1.0000 0 0)",
  secondary: "oklch(0.9067 0 0)",
  "secondary-foreground": "oklch(0.3211 0 0)",
  muted: "oklch(0.8853 0 0)",
  "muted-foreground": "oklch(0.5103 0 0)",
  accent: "oklch(0.8078 0 0)",
  "accent-foreground": "oklch(0.3211 0 0)",
  destructive: "oklch(0.5594 0.1900 25.8625)",
  "destructive-foreground": "oklch(1.0000 0 0)",
  success: "oklch(0.5594 0.1900 140)",
  "success-foreground": "oklch(1.0000 0 0)",
  border: "oklch(0.8576 0 0)",
  input: "oklch(0.9067 0 0)",
  ring: "oklch(0.4891 0 0)",
  "chart-1": "oklch(0.4891 0 0)",
  "chart-2": "oklch(0.4863 0.0361 196.0278)",
  "chart-3": "oklch(0.6534 0 0)",
  "chart-4": "oklch(0.7316 0 0)",
  "chart-5": "oklch(0.8078 0 0)",
  sidebar: "oklch(0.9370 0 0)",
  "sidebar-foreground": "oklch(0.3211 0 0)",
  "sidebar-primary": "oklch(0.4891 0 0)",
  "sidebar-primary-foreground": "oklch(1.0000 0 0)",
  "sidebar-accent": "oklch(0.8078 0 0)",
  "sidebar-accent-foreground": "oklch(0.3211 0 0)",
  "sidebar-border": "oklch(0.8576 0 0)",
  "sidebar-ring": "oklch(0.4891 0 0)",
};

const DARK_TOKENS: Record<string, string> = {
  background: "oklch(0.2178 0 0)",
  foreground: "oklch(0.8853 0 0)",
  card: "oklch(0.2435 0 0)",
  "card-foreground": "oklch(0.8853 0 0)",
  popover: "oklch(0.2435 0 0)",
  "popover-foreground": "oklch(0.8853 0 0)",
  primary: "oklch(0.7058 0 0)",
  "primary-foreground": "oklch(0.2178 0 0)",
  secondary: "oklch(0.3092 0 0)",
  "secondary-foreground": "oklch(0.8853 0 0)",
  muted: "oklch(0.2850 0 0)",
  "muted-foreground": "oklch(0.5999 0 0)",
  accent: "oklch(0.3715 0 0)",
  "accent-foreground": "oklch(0.8853 0 0)",
  destructive: "oklch(0.6591 0.1530 22.1703)",
  "destructive-foreground": "oklch(1.0000 0 0)",
  success: "oklch(0.6591 0.1530 140)",
  "success-foreground": "oklch(1.0000 0 0)",
  border: "oklch(0.3290 0 0)",
  input: "oklch(0.3092 0 0)",
  ring: "oklch(0.7058 0 0)",
  "chart-1": "oklch(0.7058 0 0)",
  "chart-2": "oklch(0.6714 0.0339 206.3482)",
  "chart-3": "oklch(0.5452 0 0)",
  "chart-4": "oklch(0.4604 0 0)",
  "chart-5": "oklch(0.3715 0 0)",
  sidebar: "oklch(0.2393 0 0)",
  "sidebar-foreground": "oklch(0.8853 0 0)",
  "sidebar-primary": "oklch(0.7058 0 0)",
  "sidebar-primary-foreground": "oklch(0.2178 0 0)",
  "sidebar-accent": "oklch(0.3715 0 0)",
  "sidebar-accent-foreground": "oklch(0.8853 0 0)",
  "sidebar-border": "oklch(0.3290 0 0)",
  "sidebar-ring": "oklch(0.7058 0 0)",
};

const GRADIENTS = {
  light: {
    "gradient-primary":
      "linear-gradient(135deg, oklch(0.4891 0 0), oklch(0.8078 0 0))",
    "gradient-subtle":
      "linear-gradient(180deg, oklch(0.9551 0 0), oklch(0.9702 0 0))",
  },
  dark: {
    "gradient-primary":
      "linear-gradient(135deg, oklch(0.7058 0 0), oklch(0.3715 0 0))",
    "gradient-subtle":
      "linear-gradient(180deg, oklch(0.2178 0 0), oklch(0.2435 0 0))",
  },
};

const FONTS = {
  light: { sans: "Montserrat, sans-serif", serif: "Georgia, serif", mono: "Fira Code, monospace" },
  dark: { sans: "Inter, sans-serif", serif: "Georgia, serif", mono: "Fira Code, monospace" },
};

function buildJSON() {
  return JSON.stringify(
    {
      light: { colors: LIGHT_TOKENS, gradients: GRADIENTS.light, fonts: FONTS.light },
      dark: { colors: DARK_TOKENS, gradients: GRADIENTS.dark, fonts: FONTS.dark },
      radius: "0.35rem",
    },
    null,
    2
  );
}

function buildCSS() {
  const toBlock = (
    selector: string,
    colors: Record<string, string>,
    gradients: Record<string, string>,
    fonts: Record<string, string>
  ) => {
    const lines = [
      ...Object.entries(colors).map(([k, v]) => `  --${k}: ${v};`),
      ...Object.entries(gradients).map(([k, v]) => `  --${k}: ${v};`),
      ...Object.entries(fonts).map(([k, v]) => `  --font-${k}: ${v};`),
      `  --radius: 0.35rem;`,
    ];
    return `${selector} {\n${lines.join("\n")}\n}`;
  };
  return [
    toBlock(":root", LIGHT_TOKENS, GRADIENTS.light, FONTS.light),
    toBlock(".dark", DARK_TOKENS, GRADIENTS.dark, FONTS.dark),
  ].join("\n\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md border border-border bg-card">
      <div
        className="w-10 h-10 rounded-md border border-border flex-shrink-0"
        style={{ background: value }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">--{name}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">{value}</div>
      </div>
    </div>
  );
}

export default function DesignTokens() {
  const [tab, setTab] = useState<"preview" | "json" | "css">("preview");
  const json = useMemo(() => buildJSON(), []);
  const css = useMemo(() => buildCSS(), []);

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: `${label} copiado para a área de transferência.` });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Design Tokens</h1>
              <p className="text-sm text-muted-foreground">
                Exporte todas as cores, gradientes e fontes (claro + escuro).
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => download("design-tokens.json", json, "application/json")}>
              <Download className="w-4 h-4 mr-2" /> JSON
            </Button>
            <Button variant="outline" onClick={() => download("design-tokens.css", css, "text/css")}>
              <Download className="w-4 h-4 mr-2" /> CSS
            </Button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="css">CSS</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-6">
            {(["light", "dark"] as const).map((mode) => {
              const tokens = mode === "light" ? LIGHT_TOKENS : DARK_TOKENS;
              return (
                <Card key={mode} className="p-5">
                  <h2 className="text-lg font-semibold mb-4 capitalize">
                    Tema {mode === "light" ? "Claro" : "Escuro"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(tokens).map(([k, v]) => (
                      <ColorSwatch key={k} name={k} value={v} />
                    ))}
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="json">
            <Card className="p-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => copy(json, "JSON")}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
              </div>
              <pre className="text-xs bg-muted text-foreground p-4 rounded-md overflow-auto max-h-[60vh] font-mono">
                {json}
              </pre>
            </Card>
          </TabsContent>

          <TabsContent value="css">
            <Card className="p-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => copy(css, "CSS")}>
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
              </div>
              <pre className="text-xs bg-muted text-foreground p-4 rounded-md overflow-auto max-h-[60vh] font-mono">
                {css}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
