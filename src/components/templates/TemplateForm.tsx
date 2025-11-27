import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TemplateFormProps {
  template?: any;
  onClose: () => void;
}

export const TemplateForm = ({ template, onClose }: TemplateFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(template?.nome || "");
  const [tipo, setTipo] = useState(template?.tipo || "whatsapp");
  const [conteudo, setConteudo] = useState(template?.conteudo || "");
  const [assunto, setAssunto] = useState(template?.assunto || "");
  const [tagsInput, setTagsInput] = useState(
    template?.tags ? template.tags.join(", ") : ""
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("Usuário não autenticado");

      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const templateData = {
        nome,
        tipo,
        conteudo,
        assunto: tipo === "email" ? assunto : null,
        tags: tags.length > 0 ? tags : null,
        user_id: user.data.user.id,
      };

      if (template) {
        const { error } = await supabase
          .from("templates_mensagens")
          .update(templateData)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("templates_mensagens")
          .insert([templateData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: template ? "Template atualizado" : "Template criado",
        description: "Template salvo com sucesso",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome do Template *</Label>
        <Input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Primeira abordagem"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipo">Tipo de Mensagem *</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tipo === "email" && (
        <div className="space-y-2">
          <Label htmlFor="assunto">Assunto do Email *</Label>
          <Input
            id="assunto"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex: Oportunidade de crescimento para sua empresa"
            required={tipo === "email"}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="conteudo">Conteúdo da Mensagem *</Label>
        <Textarea
          id="conteudo"
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder={
            tipo === "whatsapp"
              ? "Ex: Olá {nome}! Vi que sua empresa {empresa} está em {cidade}..."
              : tipo === "instagram"
              ? "Ex: Oi! 👋 Vi seu perfil e curti muito o trabalho de vocês..."
              : "Ex: Olá!\n\nNotei que sua empresa..."
          }
          rows={8}
          required
        />
        <p className="text-xs text-muted-foreground">
          Use variáveis: {"{nome}"}, {"{empresa}"}, {"{cidade}"}, {"{nicho}"}, {"{foco}"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Ex: inicial, follow-up, fechamento"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : template ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
};
