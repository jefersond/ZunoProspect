import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TemplateCard } from "./TemplateCard";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TemplatesListProps {
  onEdit: (template: any) => void;
}

export const TemplatesList = ({ onEdit }: TemplatesListProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates_mensagens")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("templates_mensagens")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: "Template deletado",
        description: "Template removido com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao deletar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const whatsappTemplates = templates?.filter((t) => t.tipo === "whatsapp") || [];
  const emailTemplates = templates?.filter((t) => t.tipo === "email") || [];

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="all">Todos ({templates?.length || 0})</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp ({whatsappTemplates.length})</TabsTrigger>
        <TabsTrigger value="email">Email ({emailTemplates.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-6">
        {templates?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum template criado ainda
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={onEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="whatsapp" className="mt-6">
        {whatsappTemplates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum template de WhatsApp criado ainda
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {whatsappTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={onEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="email" className="mt-6">
        {emailTemplates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum template de Email criado ainda
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {emailTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={onEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
