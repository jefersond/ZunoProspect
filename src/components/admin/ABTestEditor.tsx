import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, Code, Wand2 } from "lucide-react";

interface ABTest {
  id: string;
  email_type: string;
  variant: string;
  name: string;
  subject: string;
  template_html: string;
  is_active: boolean;
  weight: number;
}

interface ABTestEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTest: ABTest | null;
  onSave: () => void;
}

const EMAIL_TYPES = [
  { value: "first_24h", label: "Primeiro Email (24h)" },
  { value: "used_not_saved", label: "Usou mas não salvou" },
  { value: "saved_no_ai", label: "Salvou sem IA" },
  { value: "inactive_7d", label: "Inativo 7 dias" },
  { value: "never_upgraded", label: "Nunca fez upgrade" },
];

// Generate HTML template from natural language inputs
const generateHtmlFromNaturalLanguage = (
  subject: string,
  body: string,
  ctaText: string,
  ctaUrl: string
): string => {
  const bodyHtml = body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">${line}</p>`)
    .join('\n              ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                🚀 Zuno Prospect
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                {{nome}}, temos algo para você!
              </h2>
              ${bodyHtml}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="color: #ffffff; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
                  🎁 Cupom exclusivo
                </p>
                <p style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px; font-family: monospace; letter-spacing: 3px;">
                  ZUNO10
                </p>
                <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">
                  <strong>10% de desconto</strong> em qualquer plano!
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const ABTestEditor = ({ open, onOpenChange, editingTest, onSave }: ABTestEditorProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"natural" | "html">("natural");
  
  const [form, setForm] = useState({
    email_type: "first_24h",
    variant: "A",
    name: "",
    subject: "",
    template_html: "",
    weight: 50,
    is_active: true,
  });
  
  // Natural language fields
  const [nlForm, setNlForm] = useState({
    body: "",
    ctaText: "🔍 Encontrar Meus Leads Agora",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao",
  });
  
  const [previewTab, setPreviewTab] = useState<"code" | "preview">("preview");

  useEffect(() => {
    if (editingTest) {
      setForm({
        email_type: editingTest.email_type,
        variant: editingTest.variant,
        name: editingTest.name,
        subject: editingTest.subject,
        template_html: editingTest.template_html,
        weight: editingTest.weight,
        is_active: editingTest.is_active,
      });
      setEditorMode("html"); // Existing tests show HTML mode
    } else {
      setForm({
        email_type: "first_24h",
        variant: "A",
        name: "",
        subject: "",
        template_html: "",
        weight: 50,
        is_active: true,
      });
      setNlForm({
        body: "",
        ctaText: "🔍 Encontrar Meus Leads Agora",
        ctaUrl: "https://www.zunopropect.com.br/prospeccao",
      });
      setEditorMode("natural");
    }
  }, [editingTest, open]);

  const handleGenerateTemplate = () => {
    if (!form.subject || !nlForm.body) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha assunto e corpo do email.",
      });
      return;
    }
    
    const html = generateHtmlFromNaturalLanguage(
      form.subject,
      nlForm.body,
      nlForm.ctaText,
      nlForm.ctaUrl
    );
    
    setForm({ ...form, template_html: html });
    toast({
      title: "Template gerado!",
      description: "Confira o preview e ajuste se necessário.",
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.template_html) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha nome, assunto e gere o template.",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingTest) {
        const { error } = await supabase
          .from("email_ab_tests")
          .update({
            name: form.name,
            subject: form.subject,
            template_html: form.template_html,
            weight: form.weight,
            is_active: form.is_active,
          })
          .eq("id", editingTest.id);

        if (error) throw error;

        toast({
          title: "Teste atualizado!",
          description: `Variante ${form.variant} foi atualizada.`,
        });
      } else {
        const { error } = await supabase
          .from("email_ab_tests")
          .insert({
            email_type: form.email_type,
            variant: form.variant,
            name: form.name,
            subject: form.subject,
            template_html: form.template_html,
            weight: form.weight,
            is_active: form.is_active,
          });

        if (error) throw error;

        toast({
          title: "Teste criado!",
          description: `Variante ${form.variant} para ${form.email_type} foi criada.`,
        });
      }

      onSave();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const getPreviewHtml = () => {
    return form.template_html
      .replace(/\{\{nome\}\}/g, "João")
      .replace(/\{\{subject\}\}/g, form.subject)
      .replace(/\{\{leads_used\}\}/g, "15")
      .replace(/\{\{saved_count\}\}/g, "8");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editingTest ? `Editar Variante ${editingTest.variant}` : "Novo Teste A/B"}
          </DialogTitle>
          <DialogDescription>
            {editorMode === "natural" 
              ? "Escreva em linguagem natural — o template HTML será gerado automaticamente"
              : "Edite o código HTML diretamente"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-6">
            {/* Form Column */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Email</Label>
                  <Select
                    value={form.email_type}
                    onValueChange={(value) => setForm({ ...form, email_type: value })}
                    disabled={!!editingTest}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Variante</Label>
                  <Select
                    value={form.variant}
                    onValueChange={(value) => setForm({ ...form, variant: value })}
                    disabled={!!editingTest}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Variante A</SelectItem>
                      <SelectItem value="B">Variante B</SelectItem>
                      <SelectItem value="C">Variante C</SelectItem>
                      <SelectItem value="D">Variante D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome do Teste</Label>
                <Input
                  placeholder="Ex: Copy com urgência"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Assunto do Email</Label>
                <Input
                  placeholder="Ex: Seus concorrentes já estão prospectando..."
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Peso (% de distribuição)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 50 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.is_active ? "active" : "paused"}
                    onValueChange={(value) => setForm({ ...form, is_active: value === "active" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as "natural" | "html")}>
                  <TabsList>
                    <TabsTrigger value="natural" className="gap-1">
                      <Wand2 className="h-3 w-3" />
                      Natural
                    </TabsTrigger>
                    <TabsTrigger value="html" className="gap-1">
                      <Code className="h-3 w-3" />
                      HTML
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {editorMode === "natural" ? (
                <>
                  <div className="space-y-2">
                    <Label>Corpo do Email</Label>
                    <Textarea
                      className="min-h-[120px]"
                      placeholder="Escreva o texto do email aqui...&#10;&#10;Ex: Você criou sua conta mas ainda não prospectou nenhum lead.&#10;&#10;Seus 10 leads gratuitos estão esperando por você!"
                      value={nlForm.body}
                      onChange={(e) => setNlForm({ ...nlForm, body: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use parágrafos separados por linha em branco
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Texto do Botão (CTA)</Label>
                      <Input
                        placeholder="🔍 Encontrar Leads"
                        value={nlForm.ctaText}
                        onChange={(e) => setNlForm({ ...nlForm, ctaText: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL do Botão</Label>
                      <Input
                        placeholder="https://..."
                        value={nlForm.ctaUrl}
                        onChange={(e) => setNlForm({ ...nlForm, ctaUrl: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button onClick={handleGenerateTemplate} className="w-full gap-2">
                    <Wand2 className="h-4 w-4" />
                    Gerar Template
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Template HTML</Label>
                  <Textarea
                    className="font-mono text-xs min-h-[200px]"
                    placeholder="Código HTML do email..."
                    value={form.template_html}
                    onChange={(e) => setForm({ ...form, template_html: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {"{{nome}}"}, {"{{leads_used}}"}, {"{{saved_count}}"}
                  </p>
                </div>
              )}
            </div>

            {/* Preview Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
                <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "code" | "preview")}>
                  <TabsList className="h-8">
                    <TabsTrigger value="preview" className="text-xs gap-1 px-2 h-6">
                      <Eye className="h-3 w-3" />
                      Visual
                    </TabsTrigger>
                    <TabsTrigger value="code" className="text-xs gap-1 px-2 h-6">
                      <Code className="h-3 w-3" />
                      Código
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="border rounded-lg overflow-hidden h-[500px]">
                {form.template_html ? (
                  previewTab === "preview" ? (
                    <iframe
                      srcDoc={getPreviewHtml()}
                      className="w-full h-full border-0 bg-white"
                      title="Email Preview"
                    />
                  ) : (
                    <pre className="p-4 text-xs overflow-auto h-full bg-muted">
                      <code>{form.template_html}</code>
                    </pre>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {editorMode === "natural" 
                      ? "Preencha os campos e clique em 'Gerar Template'"
                      : "Digite o HTML do email"
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingTest ? "Salvar Alterações" : "Criar Teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
