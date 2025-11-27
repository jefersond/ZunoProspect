import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, MessageCircle, Mail, Instagram, FileText } from "lucide-react";
import { fillTemplate, extractVariables, copyToClipboard } from "@/utils/templateUtils";
import type { LeadProspeccao } from "@/types/lead";

interface TemplateSelectorProps {
  lead: LeadProspeccao;
  filterByChannel?: "whatsapp" | "email" | "instagram";
}

interface Template {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
  assunto?: string | null;
  tags?: string[] | null;
}

export const TemplateSelector = ({ lead, filterByChannel }: TemplateSelectorProps) => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(filterByChannel || "todos");

  const variables = extractVariables(lead);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates-for-lead"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("templates_mensagens")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Template[];
    },
  });

  const filteredTemplates = templates?.filter((t) => {
    if (activeTab === "todos") return true;
    return t.tipo === activeTab;
  });

  const handleCopy = async (template: Template) => {
    const filledContent = fillTemplate(template.conteudo, variables);
    const success = await copyToClipboard(filledContent);
    
    if (success) {
      setCopiedId(template.id);
      toast({
        title: "Copiado!",
        description: "Mensagem copiada para a área de transferência",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a mensagem",
        variant: "destructive",
      });
    }
  };

  const getChannelIcon = (tipo: string) => {
    switch (tipo) {
      case "whatsapp":
        return <MessageCircle className="h-4 w-4 text-green-600" />;
      case "email":
        return <Mail className="h-4 w-4 text-blue-600" />;
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Carregando templates...</div>;
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum template criado ainda</p>
        <p className="text-xs mt-1">Crie templates em "Templates de Mensagens"</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1">
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1">
            <Mail className="h-3 w-3" />
            Email
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-1">
            <Instagram className="h-3 w-3" />
            Instagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredTemplates?.map((template) => {
                const filledContent = fillTemplate(template.conteudo, variables);
                const filledSubject = template.assunto 
                  ? fillTemplate(template.assunto, variables) 
                  : null;

                return (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(template.tipo)}
                          <CardTitle className="text-sm font-medium">
                            {template.nome}
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(template);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          {copiedId === template.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      {template.tipo === "email" && filledSubject && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <strong>Assunto:</strong> {filledSubject}
                        </p>
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                        {filledContent}
                      </p>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Preview do template selecionado */}
      {selectedTemplate && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {getChannelIcon(selectedTemplate.tipo)}
                Pré-visualização: {selectedTemplate.nome}
              </CardTitle>
              <Button
                size="sm"
                onClick={() => handleCopy(selectedTemplate)}
                className="gap-2"
              >
                {copiedId === selectedTemplate.id ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar Mensagem
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4">
            {selectedTemplate.tipo === "email" && selectedTemplate.assunto && (
              <div className="mb-3 p-2 bg-background rounded border">
                <p className="text-xs text-muted-foreground">Assunto:</p>
                <p className="text-sm font-medium">
                  {fillTemplate(selectedTemplate.assunto, variables)}
                </p>
              </div>
            )}
            <div className="p-3 bg-background rounded border">
              <p className="text-sm whitespace-pre-wrap">
                {fillTemplate(selectedTemplate.conteudo, variables)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legenda das variáveis */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
        <p className="font-medium mb-1">Variáveis substituídas:</p>
        <div className="grid grid-cols-2 gap-1">
          <span><code className="text-primary">{"{nome}"}</code> → {variables.nome}</span>
          <span><code className="text-primary">{"{empresa}"}</code> → {variables.empresa}</span>
          <span><code className="text-primary">{"{cidade}"}</code> → {variables.cidade}</span>
          <span><code className="text-primary">{"{nicho}"}</code> → {variables.nicho}</span>
          <span><code className="text-primary">{"{foco}"}</code> → {variables.foco}</span>
        </div>
      </div>
    </div>
  );
};
