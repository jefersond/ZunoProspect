import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { SearchProgress } from "./SearchProgress";

const formSchema = z.object({
  cidade: z.string().min(1, "Cidade é obrigatória"),
  nicho: z.string().min(1, "Nicho é obrigatório"),
  quantidade: z.number().min(1).max(100),
  foco: z.string().min(1, "Foco é obrigatório"),
  proximidadeAtiva: z.boolean(),
  raioKm: z.number().min(1).max(10),
});

type FormData = z.infer<typeof formSchema>;

export const ProspeccaoForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [proximidadeAtiva, setProximidadeAtiva] = useState(false);
  const [raioKm, setRaioKm] = useState([5]);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantidade: 20,
      proximidadeAtiva: false,
      raioKm: 5,
    },
  });

  const foco = watch("foco");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setCurrentStep(1);
    setProgressMessage("Iniciando busca...");

    try {
      // Limpa leads anteriores da interface
      window.dispatchEvent(new CustomEvent("clearLeads"));
      
      // Deleta todos os leads antigos do banco de dados
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("leads").delete().eq("user_id", user.id);
      }
      
      // Simula progresso durante a busca
      const progressInterval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < 7) {
            const messages = [
              "Iniciando busca...",
              "Buscando empresas no Google Maps...",
              "Coletando informações de contato...",
              "Analisando presença digital...",
              "Processando com IA...",
              "Gerando planos de prospecção...",
              "Finalizando...",
            ];
            setProgressMessage(messages[prev]);
            return prev + 1;
          }
          return prev;
        });
      }, 2000);

      const { data: responseData, error } = await supabase.functions.invoke("buscar-leads", {
        body: {
          cidade: data.cidade,
          nicho: data.nicho,
          quantidade: data.quantidade,
          foco: data.foco,
          proximidadeAtiva: data.proximidadeAtiva,
          raioKm: data.raioKm,
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;

      setCurrentStep(7);
      setProgressMessage("Busca concluída!");

      const leadsCount = responseData?.leadsCount || 0;

      toast({
        title: "Busca concluída!",
        description: `${leadsCount} leads encontrados`,
      });

      // Salva a busca no histórico
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("interacoes").insert({
            user_id: user.id,
            lead_id: responseData?.leads?.[0]?.id || "00000000-0000-0000-0000-000000000000", // Lead genérico para buscas
            tipo: "busca",
            conteudo: `Busca em ${data.cidade} - ${data.nicho} (${data.foco}) - ${leadsCount} leads encontrados`,
            data_interacao: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Erro ao salvar no histórico:", error);
      }

      // Recarrega a lista de leads
      window.dispatchEvent(new CustomEvent("reloadLeads"));
      
      // Aguarda um pouco antes de resetar o progresso
      setTimeout(() => {
        setLoading(false);
        setCurrentStep(0);
      }, 1500);
    } catch (error: any) {
      console.error("Erro ao buscar leads:", error);
      
      // Extrai a mensagem de erro mais específica
      let errorMessage = "Não foi possível buscar os leads";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.context?.body) {
        try {
          const errorBody = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          errorMessage = errorBody.error || errorMessage;
        } catch (e) {
          console.error("Erro ao parsear body do erro:", e);
        }
      }
      
      toast({
        variant: "destructive",
        title: "Erro na busca",
        description: errorMessage,
      });
      setLoading(false);
      setCurrentStep(0);
    }
  };

  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Buscar Leads
        </CardTitle>
        <CardDescription>
          Encontre empresas potenciais para sua prospecção
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && currentStep > 0 && (
          <div className="mb-6">
            <SearchProgress
              currentStep={currentStep}
              totalSteps={7}
              message={progressMessage}
            />
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                placeholder="Ex: São Paulo"
                {...register("cidade")}
              />
              {errors.cidade && (
                <p className="text-sm text-destructive">{errors.cidade.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nicho">Nicho</Label>
              <Input
                id="nicho"
                placeholder="Ex: restaurante, clínica, academia"
                {...register("nicho")}
              />
              {errors.nicho && (
                <p className="text-sm text-destructive">{errors.nicho.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade de leads</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                max="100"
                {...register("quantidade", { valueAsNumber: true })}
              />
              {errors.quantidade && (
                <p className="text-sm text-destructive">{errors.quantidade.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="foco">Foco</Label>
              <Select onValueChange={(value) => setValue("foco", value)} value={foco}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o foco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full Service">Full Service</SelectItem>
                  <SelectItem value="Tráfego">Tráfego</SelectItem>
                  <SelectItem value="Automação">Automação</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                  <SelectItem value="SEO">SEO</SelectItem>
                  <SelectItem value="Sites/Landing">Sites/Landing</SelectItem>
                  <SelectItem value="CRM">CRM</SelectItem>
                </SelectContent>
              </Select>
              {errors.foco && (
                <p className="text-sm text-destructive">{errors.foco.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 p-4 bg-secondary/20 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="proximidade" className="text-base">
                  Busca por proximidade
                </Label>
                <p className="text-sm text-muted-foreground">
                  Encontrar empresas próximas ao centro da cidade
                </p>
              </div>
              <Switch
                id="proximidade"
                checked={proximidadeAtiva}
                onCheckedChange={(checked) => {
                  setProximidadeAtiva(checked);
                  setValue("proximidadeAtiva", checked);
                }}
              />
            </div>

            {proximidadeAtiva && (
              <div className="space-y-2">
                <Label>Raio de busca: {raioKm[0]} km</Label>
                <Slider
                  value={raioKm}
                  onValueChange={(value) => {
                    setRaioKm(value);
                    setValue("raioKm", value[0]);
                  }}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full shadow-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando leads...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar leads
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
