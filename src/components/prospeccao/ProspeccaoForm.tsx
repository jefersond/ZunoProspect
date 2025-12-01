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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2, Search, Mail, MessageCircle, Instagram, AlertTriangle } from "lucide-react";
import { SearchProgress } from "./SearchProgress";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";

const formSchema = z.object({
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().min(2, "Estado é obrigatório"),
  nicho: z.string().min(1, "Nicho é obrigatório"),
  quantidade: z.number().min(1).max(100),
  foco: z.string().min(1, "Foco é obrigatório"),
  proximidadeAtiva: z.boolean(),
  raioKm: z.number().min(1).max(10),
  canaisProspeccao: z.array(z.enum(["email", "whatsapp", "instagram"])).min(1, "Selecione pelo menos um canal"),
});

type FormData = z.infer<typeof formSchema>;

export const ProspeccaoForm = () => {
  const { toast } = useToast();
  const { subscription, canUseLeads, incrementLeadsUsed, refetch } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [proximidadeAtiva, setProximidadeAtiva] = useState(false);
  const [raioKm, setRaioKm] = useState([5]);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [lastSearchParams, setLastSearchParams] = useState<FormData | null>(null);
  const [showRepeatButton, setShowRepeatButton] = useState(false);

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
      canaisProspeccao: ["email", "whatsapp"],
    },
  });

  const foco = watch("foco");
  const canaisProspeccao = watch("canaisProspeccao");
  const quantidade = watch("quantidade");

  // Verifica se pode buscar leads
  const canSearch = canUseLeads(quantidade || 0);
  const isAtLimit = subscription && subscription.leads_limit !== -1 && subscription.leads_remaining <= 0;

  const onSubmit = async (data: FormData) => {
    // Verifica limite antes de buscar
    if (!canUseLeads(data.quantidade)) {
      toast({
        variant: "destructive",
        title: "Limite de leads atingido",
        description: `Você só pode buscar mais ${subscription?.leads_remaining || 0} leads este mês. Faça upgrade do seu plano para continuar.`,
      });
      return;
    }

    // Salva os parâmetros da pesquisa
    setLastSearchParams(data);
    setShowRepeatButton(false);
    
    setLoading(true);
    setCurrentStep(1);
    setProgressMessage("Iniciando busca...");

    try {
      // Limpa leads anteriores da interface
      window.dispatchEvent(new CustomEvent("clearLeads"));
      
      // Deleta apenas os leads NÃO salvos do banco de dados
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("leads").delete().eq("user_id", user.id).eq("salvo", false);
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
          estado: data.estado,
          nicho: data.nicho,
          quantidade: data.quantidade,
          foco: data.foco,
          proximidadeAtiva: data.proximidadeAtiva,
          raioKm: data.raioKm,
          canaisProspeccao: data.canaisProspeccao,
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;

      setCurrentStep(7);
      setProgressMessage("Busca concluída!");

      const leadsCount = responseData?.leadsCount || 0;

      // Incrementa o contador de leads usados
      if (leadsCount > 0) {
        await incrementLeadsUsed(leadsCount);
        refetch(); // Atualiza os dados da assinatura
      }

      toast({
        title: "Busca concluída!",
        description: `${leadsCount} leads encontrados`,
      });

      // Salva a busca no histórico (apenas se houver leads com ID válido)
      try {
        const firstLeadId = responseData?.leads?.[0]?.id;
        if (user && firstLeadId) {
          await supabase.from("interacoes").insert({
            user_id: user.id,
            lead_id: firstLeadId,
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
        setShowRepeatButton(true);
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

  const handleRepeatSearch = () => {
    if (lastSearchParams) {
      onSubmit(lastSearchParams);
    }
  };

  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Buscar Leads
            </CardTitle>
            <CardDescription>
              Encontre empresas potenciais para sua prospecção
            </CardDescription>
          </div>
          <UsageIndicator compact />
        </div>
      </CardHeader>
      <CardContent>
        {/* Aviso de limite */}
        {isAtLimit && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Limite de leads atingido</p>
              <p className="text-sm text-muted-foreground">
                Você usou todos os seus {subscription?.leads_limit} leads este mês. Faça upgrade do seu plano para continuar prospectando.
              </p>
            </div>
          </div>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label htmlFor="estado">Estado</Label>
              <Select onValueChange={(value) => setValue("estado", value)} value={watch("estado")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AC">Acre (AC)</SelectItem>
                  <SelectItem value="AL">Alagoas (AL)</SelectItem>
                  <SelectItem value="AP">Amapá (AP)</SelectItem>
                  <SelectItem value="AM">Amazonas (AM)</SelectItem>
                  <SelectItem value="BA">Bahia (BA)</SelectItem>
                  <SelectItem value="CE">Ceará (CE)</SelectItem>
                  <SelectItem value="DF">Distrito Federal (DF)</SelectItem>
                  <SelectItem value="ES">Espírito Santo (ES)</SelectItem>
                  <SelectItem value="GO">Goiás (GO)</SelectItem>
                  <SelectItem value="MA">Maranhão (MA)</SelectItem>
                  <SelectItem value="MT">Mato Grosso (MT)</SelectItem>
                  <SelectItem value="MS">Mato Grosso do Sul (MS)</SelectItem>
                  <SelectItem value="MG">Minas Gerais (MG)</SelectItem>
                  <SelectItem value="PA">Pará (PA)</SelectItem>
                  <SelectItem value="PB">Paraíba (PB)</SelectItem>
                  <SelectItem value="PR">Paraná (PR)</SelectItem>
                  <SelectItem value="PE">Pernambuco (PE)</SelectItem>
                  <SelectItem value="PI">Piauí (PI)</SelectItem>
                  <SelectItem value="RJ">Rio de Janeiro (RJ)</SelectItem>
                  <SelectItem value="RN">Rio Grande do Norte (RN)</SelectItem>
                  <SelectItem value="RS">Rio Grande do Sul (RS)</SelectItem>
                  <SelectItem value="RO">Rondônia (RO)</SelectItem>
                  <SelectItem value="RR">Roraima (RR)</SelectItem>
                  <SelectItem value="SC">Santa Catarina (SC)</SelectItem>
                  <SelectItem value="SP">São Paulo (SP)</SelectItem>
                  <SelectItem value="SE">Sergipe (SE)</SelectItem>
                  <SelectItem value="TO">Tocantins (TO)</SelectItem>
                </SelectContent>
              </Select>
              {errors.estado && (
                <p className="text-sm text-destructive">{errors.estado.message}</p>
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

          <div className="space-y-4 p-4 bg-secondary/20 rounded-lg border border-border">
            <div className="space-y-2">
              <Label className="text-base">Canais de comunicação</Label>
              <p className="text-sm text-muted-foreground">
                Escolha quais canais usar no plano de prospecção (selecione um ou mais)
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="email"
                  checked={canaisProspeccao?.includes("email")}
                  onCheckedChange={(checked) => {
                    const current = canaisProspeccao || [];
                    if (checked) {
                      setValue("canaisProspeccao", [...current, "email"]);
                    } else {
                      setValue("canaisProspeccao", current.filter(c => c !== "email"));
                    }
                  }}
                />
                <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>Email</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="whatsapp"
                  checked={canaisProspeccao?.includes("whatsapp")}
                  onCheckedChange={(checked) => {
                    const current = canaisProspeccao || [];
                    if (checked) {
                      setValue("canaisProspeccao", [...current, "whatsapp"]);
                    } else {
                      setValue("canaisProspeccao", current.filter(c => c !== "whatsapp"));
                    }
                  }}
                />
                <Label htmlFor="whatsapp" className="flex items-center gap-2 cursor-pointer flex-1">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span>WhatsApp</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="instagram"
                  checked={canaisProspeccao?.includes("instagram")}
                  onCheckedChange={(checked) => {
                    const current = canaisProspeccao || [];
                    if (checked) {
                      setValue("canaisProspeccao", [...current, "instagram"]);
                    } else {
                      setValue("canaisProspeccao", current.filter(c => c !== "instagram"));
                    }
                  }}
                />
                <Label htmlFor="instagram" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Instagram className="h-4 w-4 text-primary" />
                  <span>Instagram</span>
                </Label>
              </div>
            </div>
            {errors.canaisProspeccao && (
              <p className="text-sm text-destructive">{errors.canaisProspeccao.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1 shadow-primary" disabled={loading}>
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
            
            {showRepeatButton && lastSearchParams && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleRepeatSearch}
                disabled={loading}
                className="flex-1"
              >
                <Search className="mr-2 h-4 w-4" />
                Buscar novamente
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
