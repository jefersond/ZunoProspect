import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Copy, MessageCircle, Mail, Instagram, Sparkles, Loader2 } from "lucide-react";

interface TemplateGlobal {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  conteudo: string;
  assunto?: string | null;
  tags?: string[] | null;
  ordem: number;
}

const categoriaLabels: Record<string, string> = {
  primeiro_contato: "Primeiro Contato",
  follow_up: "Follow-up",
  fechamento: "Fechamento",
  consultivo: "Consultivo",
};

export const TemplatesGlobais = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates-globais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates_globais")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as TemplateGlobal[];
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (template: TemplateGlobal) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("templates_mensagens").insert({
        user_id: user.id,
        nome: `${template.nome} (Cópia)`,
        tipo: template.tipo,
        conteudo: template.conteudo,
        assunto: template.assunto,
        tags: template.tags,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: "Template copiado!",
        description: "O modelo foi adicionado aos seus templates. Você pode editá-lo conforme necessário.",
      });
      setCopyingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao copiar",
        description: error.message || "Não foi possível copiar o template",
        variant: "destructive",
      });
      setCopyingId(null);
    },
  });

  const handleCopyTemplate = (template: TemplateGlobal) => {
    setCopyingId(template.id);
    copyMutation.mutate(template);
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
        return null;
    }
  };

  const filteredTemplates = templates?.filter((t) => t.tipo === activeTab) || [];

  const groupedByCategoria = filteredTemplates.reduce((acc, template) => {
    const cat = template.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, TemplateGlobal[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Modelos Base de Prospecção</h2>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Templates prontos para usar como base. Clique em "Usar como base" para copiar e personalizar.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-2">
            <Instagram className="h-4 w-4" />
            Instagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-6">
          {Object.entries(groupedByCategoria).map(([categoria, templates]) => (
            <div key={categoria} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                {categoriaLabels[categoria] || categoria}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <Card key={template.id} className="relative group hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(template.tipo)}
                          <CardTitle className="text-sm font-medium">
                            {template.nome}
                          </CardTitle>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyTemplate(template)}
                          disabled={copyingId === template.id}
                          className="gap-1"
                        >
                          {copyingId === template.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Usar como base
                        </Button>
                      </div>
                      {template.assunto && (
                        <CardDescription className="text-xs mt-1">
                          Assunto: {template.assunto}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-5">
                        {template.conteudo}
                      </p>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {template.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum modelo disponível para este canal.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
