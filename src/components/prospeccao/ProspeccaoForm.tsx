import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useUsage } from "@/hooks/useUsage";
import { canUsePaidFeatures } from "@/utils/subscriptionHelpers";
import { Loader2, Search, Mail, MessageCircle, Instagram, Globe, Sparkles } from "lucide-react";
import { SearchProgress } from "./SearchProgress";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { UpgradeIncentive } from "@/components/subscription/UpgradeIncentive";
import { UsaAddonUpsell } from "./UsaAddonUpsell";
import { COUNTRIES, getStatesByCountry, getCityPlaceholder, type Country } from "@/data/locations";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { isAdminUser } from "@/config/admin";

const ZUNO_INTERNAL_PROSPECTING_FOCUS = "zuno_internal_prospecting";
const SEARCH_TIMEOUT_MS = 60_000;

const focusOptions = [
  { label: "Full Service", value: "Full Service" },
  { label: "Tráfego", value: "Tráfego" },
  { label: "Automação", value: "Automação" },
  { label: "Design", value: "Design" },
  { label: "Social", value: "Social" },
  { label: "SEO", value: "SEO" },
  { label: "Sites/Landing", value: "Sites/Landing" },
  { label: "CRM", value: "CRM" },
  { label: "Serviços Profissionais", value: "servicos_profissionais", adminOnly: true },
  { label: "Oportunidade comercial", value: ZUNO_INTERNAL_PROSPECTING_FOCUS, adminOnly: true },
];

const withSearchTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Essa busca demorou mais que o esperado. Tente novamente com menos leads ou filtros mais específicos."));
    }, SEARCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const safeTrackEvent = (eventName: string, eventData: Record<string, unknown>) => {
  try {
    trackEvent(eventName, eventData);
  } catch (trackingError) {
    console.warn("[Tracking] Falhou, mas não bloqueia UI", trackingError);
  }
};

const safeTrackMetaCustomEvent = (eventName: string, eventData: Record<string, unknown>) => {
  try {
    trackMetaCustomEvent(eventName, eventData);
  } catch (trackingError) {
    console.warn("[Tracking] Falhou, mas não bloqueia UI", trackingError);
  }
};

const formSchema = z.object({
  pais: z.enum(["BR", "US"]).default("BR"),
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const {
    subscription,
    loading: subscriptionLoading,
    error: subscriptionError,
    isAdmin: subscriptionIsAdmin,
    refetch: refetchSubscription,
    canUseUsaProspecting,
  } = useSubscription();
  const {
    usage,
    loading: usageLoading,
    error: usageError,
    canSearchLeads,
    leadsAvailableTotal,
    isAdmin: usageIsAdmin,
    refetch: refetchUsage,
  } = useUsage();
  const isAdmin = isAdminUser(
    { email: userEmail },
    { is_admin: subscriptionIsAdmin || usageIsAdmin, role: subscriptionIsAdmin || usageIsAdmin ? "admin" : null },
  );
  const normalizedPlanName = String(subscription?.plan_name || "free").toLowerCase();
  const hasPaidPlan = isAdmin || ["starter", "iniciante", "pro", "agency", "agencia"].includes(normalizedPlanName);
  const [loading, setLoading] = useState(false);
  const [proximidadeAtiva, setProximidadeAtiva] = useState(false);
  const [raioKm, setRaioKm] = useState([5]);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [lastSearchParams, setLastSearchParams] = useState<FormData | null>(null);
  const [showRepeatButton, setShowRepeatButton] = useState(false);
  const [isIncremental, setIsIncremental] = useState(false);
  
  // Novos estados para progresso real
  const [leadsFound, setLeadsFound] = useState(0);
  const [leadsAnalyzed, setLeadsAnalyzed] = useState(0);
  const [targetQuantity, setTargetQuantity] = useState(0);
  const [estimatedTimeSeconds, setEstimatedTimeSeconds] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStartTime, setSearchStartTime] = useState<Date | null>(null);
  
  // Estado para incentivo de upgrade
  const [upgradeIncentive, setUpgradeIncentive] = useState<{
    additionalLeads: number;
    totalAvailable: number;
  } | null>(null);

  // Estado para upsell do add-on EUA
  const [showUsaUpsell, setShowUsaUpsell] = useState(false);
  const [showUsaInlinePromo, setShowUsaInlinePromo] = useState(false);

  // Selected country
  const [selectedCountry, setSelectedCountry] = useState<Country>("BR");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pais: "BR",
      quantidade: 10, // Começa com 10 (limite do plano starter)
      proximidadeAtiva: false,
      raioKm: 5,
      canaisProspeccao: ["email", "whatsapp", "instagram"],
    },
  });

  // Ref para cleanup do poll de progresso ao desmontar
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Get user info for upsell
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        setUserEmail(user.email || undefined);
        setUserName(user.user_metadata?.full_name || undefined);
      }
    };
    fetchUser();
  }, []);

  // Carrega a busca salva no localStorage para pré-preencher o formulário
  useEffect(() => {
    const savedFormData = localStorage.getItem("zuno_last_search_form_data");
    if (savedFormData) {
      try {
        const parsed = JSON.parse(savedFormData);
        // Preenche o react-hook-form
        reset(parsed);
        
        // Sincroniza estados auxiliares que controlam a UI no formulário
        if (parsed.pais) {
          setSelectedCountry(parsed.pais);
        }
        if (parsed.proximidadeAtiva !== undefined) {
          setProximidadeAtiva(parsed.proximidadeAtiva);
        }
        if (parsed.raioKm !== undefined) {
          setRaioKm([parsed.raioKm]);
        }
        
        // Define os parâmetros da última busca para habilitar os botões de repetição
        setLastSearchParams(parsed);
        setShowRepeatButton(true);
      } catch (error) {
        console.error("Erro ao carregar busca salva do localStorage:", error);
      }
    }
  }, [reset]);

  // Escuta o evento customizado para acionar a busca incremental
  useEffect(() => {
    const handleTriggerIncrementalSearch = () => {
      if (loading) return;
      
      const savedFormData = localStorage.getItem("zuno_last_search_form_data");
      if (savedFormData) {
        try {
          const parsed = JSON.parse(savedFormData);
          runSearch(parsed, true);
        } catch (error) {
          console.error("Erro ao ler busca incremental do localStorage:", error);
        }
      } else if (lastSearchParams) {
        runSearch(lastSearchParams, true);
      } else {
        toast({
          variant: "destructive",
          title: "Nenhuma busca anterior",
          description: "Não foi possível encontrar as diretrizes da busca anterior.",
        });
      }
    };

    window.addEventListener("triggerIncrementalSearch", handleTriggerIncrementalSearch);
    return () => {
      window.removeEventListener("triggerIncrementalSearch", handleTriggerIncrementalSearch);
    };
  }, [lastSearchParams, loading]);

  const refreshUsage = async () => {
    await Promise.all([refetchUsage(), refetchSubscription()]);
  };

  // Ajusta quantidade padrão baseado no plano do usuário
  useEffect(() => {
    if (usage) {
      const maxAllowed = isAdmin ? 100 : leadsAvailableTotal;
      const currentQuantidade = getValues("quantidade");
      // Se quantidade atual é maior que o permitido, ajusta
      if (currentQuantidade > maxAllowed && maxAllowed > 0) {
        setValue("quantidade", Math.min(20, maxAllowed));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage?.plan_name, isAdmin, leadsAvailableTotal, setValue]);

  const foco = watch("foco");
  const canaisProspeccao = watch("canaisProspeccao");
  const quantidade = watch("quantidade");
  const visibleFocusOptions = focusOptions.filter((option) => !option.adminOnly || isAdmin);

  useEffect(() => {
    if (!isAdmin && (foco === ZUNO_INTERNAL_PROSPECTING_FOCUS || foco === "servicos_profissionais")) {
      setValue("foco", "Full Service");
    }
  }, [foco, isAdmin, setValue]);

  const isAtLimit = !usageLoading && !subscriptionLoading && !isAdmin && !canSearchLeads;
  const availableLeads = isAdmin
    ? 100
    : Math.max(1, Math.min(100, (usageLoading || subscriptionLoading) ? 100 : (leadsAvailableTotal || 0)));
  const quantityAvailabilityText = (usageLoading || subscriptionLoading)
    ? "carregando..."
    : (usage
        ? (isAdmin
            ? "Leads ilimitados"
            : (Math.max(0, leadsAvailableTotal) === 0
                ? "nenhum disponível"
                : `${Math.max(0, leadsAvailableTotal)} ${Math.max(0, leadsAvailableTotal) === 1 ? "disponível" : "disponíveis"}`))
        : null);

  // Calcula tempo estimado baseado na quantidade de leads
  const calculateEstimatedTime = (qty: number): number => {
    // Base: ~3 segundos por lead (busca + enriquecimento)
    return Math.ceil(qty * 3);
  };

  // Função de polling para verificar progresso real
  const startProgressPolling = async (userId: string, startTime: Date, targetQty: number) => {
    const pollInterval = setInterval(async () => {
      try {
        // Conta leads criados após o início da busca
        const { count: foundCount } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startTime.toISOString());

        const found = foundCount || 0;

        setLeadsFound(found);
        setLeadsAnalyzed(0);

        // Atualiza tempo estimado restante
        const elapsed = (Date.now() - startTime.getTime()) / 1000;
        const avgTimePerLead = found > 0 ? elapsed / found : 3;
        const remaining = Math.max(0, Math.ceil((targetQty - found) * avgTimePerLead));
        setEstimatedTimeSeconds(remaining);

        // Atualiza step baseado no progresso real
        if (found === 0) {
          setCurrentStep(2);
          setProgressMessage("Buscando empresas no Google Maps...");
        } else if (found > 0 && found < targetQty) {
          setCurrentStep(4);
          setProgressMessage(`Enriquecendo contatos... (${found} encontradas)`);
        } else if (found >= targetQty) {
          setCurrentStep(5);
          setProgressMessage("Finalizando busca...");
        }

        console.log(`[Progresso] Encontrados: ${found}/${targetQty}, Tempo restante: ~${remaining}s`);

      } catch (error) {
        console.error("[Polling] Erro ao verificar progresso:", error);
      }
    }, 2000); // Poll a cada 2 segundos

    return pollInterval;
  };

  const handleUpdatePayment = async () => {
    trackEvent("Payment_Update_Clicked", {
      plan_name: subscription?.plan_name,
      subscription_status: subscription?.status || subscription?.subscription_status,
      hosted_invoice_url_exists: !!subscription?.hosted_invoice_url,
      source: "form_block_toast",
    });

    if (subscription?.hosted_invoice_url) {
      window.open(subscription.hosted_invoice_url, "_blank");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-customer-portal-session");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não encontrada.");
      }
    } catch (err: any) {
      console.error("Erro ao abrir portal do Stripe:", err);
      toast({
        title: "Erro ao abrir o portal",
        description: err.message || "Tente novamente ou contate o suporte.",
        variant: "destructive",
      });
    }
  };

  const runSearch = async (data: FormData, isIncrementalSearch: boolean) => {
    if (subscriptionLoading || usageLoading) {
      toast({
        title: "Carregando informações do plano...",
        description: "Aguarde alguns instantes enquanto preparamos sua conta.",
      });
      return;
    }

    if (!subscription) {
      toast({
        title: "Preparando sua conta...",
        description: "Estamos criando seu perfil e saldo inicial. Tente novamente em instantes.",
      });
      await refreshUsage();
      return;
    }

    if (!canUsePaidFeatures(null, subscription)) {
      toast({
        variant: "destructive",
        title: "Pagamento pendente",
        description: "Não conseguimos concluir o pagamento da sua assinatura. Atualize o pagamento para continuar gerando novas buscas.",
        action: (
          <button 
            onClick={handleUpdatePayment}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-3 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700 focus:outline-none"
          >
            Atualizar
          </button>
        )
      });
      return;
    }

    if (data.pais === "US" && !canUseUsaProspecting()) {
      toast({
        variant: "destructive",
        title: "Prospecção nos EUA é um complemento opcional.",
        description: hasPaidPlan
          ? "Ative o complemento para buscar leads nos Estados Unidos."
          : "Escolha um plano ativo para liberar a compra do complemento.",
      });
      setShowUsaInlinePromo(true);
      return;
    }

    if ((data.foco === ZUNO_INTERNAL_PROSPECTING_FOCUS || data.foco === "servicos_profissionais") && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Foco exclusivo para administradores",
        description: "Este foco está disponível apenas para administradores.",
      });
      return;
    }

    // Verifica se tem pelo menos 1 lead disponível
    if (!canSearchLeads) {
      toast({
        variant: "destructive",
        title: "Limite de leads atingido",
        description: "Você atingiu seu limite de leads este mês. Faça upgrade do seu plano para continuar prospectando.",
      });
      return;
    }

    const effectiveQuantidade = isAdmin
      ? data.quantidade
      : Math.max(1, Math.min(data.quantidade, leadsAvailableTotal));

    // Salva os parâmetros da pesquisa
    setLastSearchParams(data);
    localStorage.setItem("zuno_last_search_context", JSON.stringify({
      city: data.cidade,
      state: data.estado,
      country: data.pais,
      niche: data.nicho,
      focus: data.foco
    }));
    localStorage.setItem("zuno_last_search_form_data", JSON.stringify(data));
    setShowRepeatButton(false);
    setUpgradeIncentive(null); // Limpa incentivo anterior
    
    // Reseta estados de progresso
    window.dispatchEvent(new CustomEvent("searchStarted"));
    setLoading(true);
    setCurrentStep(1);
    setProgressMessage("Iniciando busca...");
    setLeadsFound(0);
    setLeadsAnalyzed(0);
    setTargetQuantity(effectiveQuantidade);
    setEstimatedTimeSeconds(calculateEstimatedTime(effectiveQuantidade));
    setSearchError(null);
    
    const startTime = new Date();
    setSearchStartTime(startTime);
    
    console.log(`[Busca] Iniciando busca de ${effectiveQuantidade} leads em ${data.cidade}/${data.estado} - ${data.nicho}`);

    // pollIntervalRef.current será limpo pelo useEffect de cleanup ao desmontar

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Sessão expirada / usuário deslogado → manda para login
        const msg = "Você precisa entrar para buscar leads.";
        setSearchError(msg);
        toast({
          variant: "destructive",
          title: "Usuário não autenticado",
          description: msg,
        });
        setLoading(false);
        setCurrentStep(0);
        navigate("/auth");
        return;
      }

      const searchEventData = {
        country: data.pais || "BR",
        state: data.estado,
        city: data.cidade,
        niche: data.nicho,
        requested_quantity: effectiveQuantidade,
        focus: data.foco,
        incremental: isIncrementalSearch,
        ...(data.foco === ZUNO_INTERNAL_PROSPECTING_FOCUS && isAdmin
          ? {
              internal_zuno_prospecting: true,
              admin_only: true,
              is_internal_event: true,
              event_source_type: "admin",
            }
          : {}),
      };

      safeTrackMetaCustomEvent("Search_Started", {
        country: searchEventData.country,
        state: searchEventData.state,
        city: searchEventData.city,
        niche: searchEventData.niche,
        requested_quantity: searchEventData.requested_quantity,
      });
      safeTrackEvent("search_started", searchEventData);

      // Inicia polling de progresso
      pollIntervalRef.current = await startProgressPolling(user.id, startTime, effectiveQuantidade);
      
      // Buscar google_place_ids já existentes para evitar duplicatas
      let existingPlaceIds: string[] = [];
      // Em busca incremental, evita todos os leads existentes
      // Em busca normal, evita apenas os leads SALVOS (permite re-análise com novo foco)
      const query = supabase
        .from("leads")
        .select("google_place_id")
        .eq("user_id", user.id)
        .not("google_place_id", "is", null);
      
      if (isIncrementalSearch) {
        // Incremental: exclui todos os place_ids
        const { data: existingLeads } = await query;
        existingPlaceIds = existingLeads?.map(lead => lead.google_place_id).filter(Boolean) || [];
      } else {
        // Normal: exclui apenas leads salvos (permite re-buscar leads não salvos com novo foco)
        const { data: existingLeads } = await query.eq("salvo", true);
        existingPlaceIds = existingLeads?.map(lead => lead.google_place_id).filter(Boolean) || [];
      }
      
      // Se não for incremental, limpa leads NÃO salvos
      if (!isIncrementalSearch) {
        window.dispatchEvent(new CustomEvent("clearLeads"));
        // Deleta apenas leads não salvos (salvo=false)
        await supabase.from("leads").delete().eq("user_id", user.id).eq("salvo", false);
      }

      console.log(`[Busca] Chamando edge function buscar-leads...`);

      const { data: responseData, error } = await withSearchTimeout(
        supabase.functions.invoke("buscar-leads", {
          body: {
            cidade: data.cidade,
            estado: data.estado,
            nicho: data.nicho,
            quantidade: effectiveQuantidade,
            foco: data.foco,
            proximidadeAtiva: data.proximidadeAtiva,
            raioKm: data.raioKm,
            canaisProspeccao: data.canaisProspeccao,
            excludePlaceIds: existingPlaceIds,
            pais: data.pais || "BR",
          },
        })
      );

      // Para o polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      if (error) {
        let edgeErrorPayload: any = null;
        const contextResponse = (error as any)?.context;

        if (contextResponse instanceof Response) {
          try {
            const text = await contextResponse.clone().text();
            edgeErrorPayload = text ? JSON.parse(text) : null;
          } catch (parseError) {
            console.error("Erro ao ler resposta de erro da Edge Function:", parseError);
          }
        }

        console.error("Erro da Edge Function:", {
          message: error.message,
          name: error.name,
          context: error.context,
          payload: edgeErrorPayload,
        });

        throw new Error(
          edgeErrorPayload?.details ||
          edgeErrorPayload?.error ||
          error.message ||
          "Não foi possível buscar leads agora."
        );

      }

      setCurrentStep(7);
      setProgressMessage("Busca concluída!");

      const leadsCount = responseData?.leadsCount || 0;
      const newLeadsCount = responseData?.newLeadsCount ?? leadsCount;
      const updatedLeadsCount = responseData?.updatedLeadsCount || 0;
      const durationMs = Date.now() - startTime.getTime();
      setLeadsFound(leadsCount);
      setLeadsAnalyzed(0);
      setEstimatedTimeSeconds(0);

      const searchRunIdFromResponse = responseData?.searchRunId;
      window.dispatchEvent(new CustomEvent("searchFinished", {
        detail: { searchRunId: searchRunIdFromResponse, response: responseData, incremental: isIncrementalSearch }
      }));
      setLoading(false);
      setCurrentStep(0);
      setShowRepeatButton(true);

      console.log(`[Busca] Concluída! ${leadsCount} leads processados (${newLeadsCount} novos, ${updatedLeadsCount} atualizados)`);

      safeTrackEvent("search_completed", {
        ...searchEventData,
        returned_quantity: leadsCount,
        new_leads_count: newLeadsCount,
        updated_leads_count: updatedLeadsCount,
        duration_ms: durationMs,
      });
      safeTrackMetaCustomEvent("Search_Completed", {
        country: searchEventData.country,
        state: searchEventData.state,
        city: searchEventData.city,
        niche: searchEventData.niche,
        requested_quantity: searchEventData.requested_quantity,
        leads_count: leadsCount,
      });

      const firstSearchKey = `zuno_first_search_completed_${user.id}`;
      if (!localStorage.getItem(firstSearchKey)) {
        localStorage.setItem(firstSearchKey, new Date().toISOString());
        safeTrackMetaCustomEvent("First_Search_Completed", {
          city: searchEventData.city,
          niche: searchEventData.niche,
          leads_count: leadsCount,
        });
        safeTrackEvent("first_search_completed", {
          ...searchEventData,
          returned_quantity: leadsCount,
          new_leads_count: newLeadsCount,
          updated_leads_count: updatedLeadsCount,
          duration_ms: durationMs,
        });
      }

      await refreshUsage();

      // Toast com informação clara sobre leads novos vs atualizados
      let toastDescription = '';
      const exhaustedSource = responseData?.exhaustedSource || false;
      const suggestion = responseData?.suggestion;
      const searchMeta = responseData?.searchMetadata;
      const noLeadsReason = responseData?.noLeadsReason;
      const noLeadsMessages: Record<string, { title: string; description: string }> = {
        google_zero: {
          title: "Nenhuma empresa encontrada",
          description: "Nao encontramos empresas com esse termo. Tente uma variacao como concessionaria, revenda de veiculos ou carros usados.",
        },
        all_duplicates: {
          title: "Nenhum lead novo",
          description: "Encontramos empresas, mas nenhuma nova para sua conta. Tente outro nicho ou remova filtros.",
        },
        filtered_out: {
          title: "Resultados ocultados",
          description: "Encontramos empresas, mas os filtros atuais ocultaram os resultados.",
        },
      };
      
      if (newLeadsCount > 0) {
        toastDescription = `${newLeadsCount} leads novos${updatedLeadsCount > 0 ? ` + ${updatedLeadsCount} atualizados` : ""}`;
        // Informa sobre expansao de raio se usou multi-rodada
        if (searchMeta?.roundsUsed > 1) {
          toastDescription += ` (raio expandido para ${searchMeta.finalRadiusKm?.toFixed(1)}km)`;
        }
        // Se nao atingiu a meta, adiciona sugestao
        if (exhaustedSource && newLeadsCount < effectiveQuantidade) {
          toastDescription += `. ${suggestion || "Tente multiplos nichos ou outra cidade."}`;
        }
      } else if (updatedLeadsCount > 0) {
        toastDescription = `${updatedLeadsCount} leads atualizados (nenhum novo encontrado)`;
      } else if (noLeadsReason && noLeadsMessages[noLeadsReason]) {
        toastDescription = responseData?.error || suggestion || noLeadsMessages[noLeadsReason].description;
      } else {
        toastDescription = responseData?.error || suggestion || "Nenhum lead novo encontrado nesta regiao. Tente aumentar o raio de busca ou usar multiplos nichos.";
      }
      
      toast({
        title: newLeadsCount > 0 
          ? (exhaustedSource && newLeadsCount < effectiveQuantidade ? `${newLeadsCount} leads encontrados` : "Busca concluída!") 
          : (updatedLeadsCount > 0 ? "Leads atualizados" : (noLeadsReason && noLeadsMessages[noLeadsReason] ? noLeadsMessages[noLeadsReason].title : "Nenhum lead novo")),
        description: toastDescription,
        variant: newLeadsCount > 0 ? "default" : (updatedLeadsCount > 0 ? "default" : "destructive"),
        duration: exhaustedSource ? 8000 : 5000, // Mostra mais tempo se tiver sugestão
      });

      // Verifica se há leads adicionais disponíveis (incentivo de upgrade)
      const shouldPrioritizeFirstAi =
        normalizedPlanName === "free" &&
        (usage.ai_used || 0) === 0 &&
        (usage.ai_remaining || usage.ai_available_total || 0) > 0 &&
        leadsCount > 0;

      if (!shouldPrioritizeFirstAi && responseData?.limitedByQuota && responseData?.additionalLeadsAvailable > 0) {
        setUpgradeIncentive({
          additionalLeads: responseData.additionalLeadsAvailable,
          totalAvailable: responseData.totalAvailable,
        });
        
        // Envia os leads bloqueados para exibição com blur
        if (responseData?.lockedLeads && responseData.lockedLeads.length > 0) {
          window.dispatchEvent(new CustomEvent("setLockedLeads", { 
            detail: { 
              lockedLeads: responseData.lockedLeads,
              totalLocked: responseData.additionalLeadsAvailable 
            } 
          }));
        }
      } else {
        // Limpa leads bloqueados se não houver
        window.dispatchEvent(new CustomEvent("setLockedLeads", { 
          detail: { lockedLeads: [], totalLocked: 0 } 
        }));
      }

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

    } catch (error: any) {
      console.error("[Busca] Erro:", error);
      
      // Para o polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Extrai a mensagem de erro mais específica
      let errorMessage = "Não foi possível buscar os leads";
      let isTimeoutError = false;
      
      if (error.message) {
        errorMessage = error.message;
        // Detecta timeout/conexão
        if (error.message.includes('timeout') || error.message.includes('demorou mais que o esperado') || error.message.includes('504') || error.message.includes('FunctionsHttpError')) {
          isTimeoutError = true;
          errorMessage = "Essa busca demorou mais que o esperado. Tente novamente com menos leads ou filtros mais específicos.";
        }
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
      
      setSearchError(errorMessage);
      window.dispatchEvent(new CustomEvent("searchFailed", { 
        detail: { error: errorMessage } 
      }));
      safeTrackMetaCustomEvent("Search_Failed", {
        city: data.cidade,
        niche: data.nicho,
        error_message: errorMessage,
      });
      safeTrackEvent("search_failed", {
        country: data.pais || "BR",
        state: data.estado,
        city: data.cidade,
        niche: data.nicho,
        requested_quantity: effectiveQuantidade,
        focus: data.foco,
        error: errorMessage,
      });
      
      toast({
        variant: "destructive",
        title: isTimeoutError ? "Busca demorou demais" : "Erro na busca",
        description: errorMessage,
      });
      setLoading(false);
      setCurrentStep(0);
    } finally {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setLoading(false);
    }
  };

  const handleRetrySearch = () => {
    setSearchError(null);
    if (lastSearchParams) {
      runSearch(lastSearchParams, false);
    }
  };

  const onSubmit = async (data: FormData) => {
    return runSearch(data, false);
  };

  const handleRepeatSearch = () => {
    if (lastSearchParams) {
      runSearch(lastSearchParams, false);
    }
  };
  
  const handleIncrementalSearch = () => {
    if (lastSearchParams) {
      runSearch(lastSearchParams, true);
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
              <span className="ml-2 text-xs text-muted-foreground">
                (País: {selectedCountry === "US" ? "Estados Unidos" : "Brasil"})
              </span>
            </CardDescription>
          </div>
          <UsageIndicator compact />
        </div>
      </CardHeader>
      <CardContent>
        {(subscriptionLoading || usageLoading) && (
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Carregando informações do plano...</span>
          </div>
        )}

        {!subscriptionLoading && !usageLoading && !subscription && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            Preparando sua conta...
          </div>
        )}

        {!subscriptionLoading && !usageLoading && (subscriptionError && usageError) && !subscription && !usage && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            Não foi possível atualizar os dados do plano agora. Você ainda pode tentar buscar leads.
          </div>
        )}

        {isAtLimit && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Limite de leads atingido. Faça upgrade do seu plano para continuar prospectando.
          </div>
        )}

        {/* Incentivo de upgrade */}
        {upgradeIncentive && (
          <div className="mb-6">
            <UpgradeIncentive
              additionalLeads={upgradeIncentive.additionalLeads}
              totalAvailable={upgradeIncentive.totalAvailable}
              currentPlanName={subscription?.plan_name}
            />
          </div>
        )}


        {/* Estado de erro */}
        {searchError && !loading && (
          <div className="mb-6">
            <SearchProgress
              currentStep={0}
              totalSteps={7}
              message=""
              error={searchError}
              onRetry={handleRetrySearch}
            />
          </div>
        )}

        {loading && currentStep > 0 && (
          <div className="mb-6">
            <SearchProgress
              currentStep={currentStep}
              totalSteps={7}
              message={progressMessage}
              leadsFound={leadsFound}
              leadsAnalyzed={leadsAnalyzed}
              targetQuantity={targetQuantity}
              estimatedTimeSeconds={estimatedTimeSeconds}
            />
          </div>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Linha 1: País (destaque) */}
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="space-y-2">
              <Label htmlFor="pais" className="flex items-center gap-2 text-base font-semibold flex-wrap">
                <Globe className="h-5 w-5 text-primary" />
                País
                {!canUseUsaProspecting() && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500 font-normal">
                    EUA: complemento
                  </Badge>
                )}
              </Label>
              <Select 
                value={selectedCountry}
                onValueChange={(value: Country) => {
                  if (value === "US" && !canUseUsaProspecting()) {
                    setShowUsaInlinePromo(true);
                    return;
                  }
                  setShowUsaInlinePromo(false);
                  setSelectedCountry(value);
                  setValue("pais", value);
                  setValue("estado", "");
                }}
              >
                <SelectTrigger className="w-full md:w-64 bg-background">
                  <SelectValue placeholder="Selecione o país" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-popover">
                  {COUNTRIES.map((country) => (
                    <SelectItem 
                      key={country.value} 
                      value={country.value}
                    >
                      {country.label}
                      {country.value === "US" && !canUseUsaProspecting() && " 🔒"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Card de Ativação EUA - aparece quando usuário tenta selecionar US sem acesso */}
            {showUsaInlinePromo && (
              <div className="mt-4 p-4 rounded-lg border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-red-500/5">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  {/* Info lado esquerdo */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Sparkles className="h-5 w-5 text-blue-500" />
                      <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 hover:bg-amber-500/30">
                        Complemento opcional
                      </Badge>
                      <span className="text-xl">🇺🇸</span>
                    </div>
                    <h4 className="font-semibold text-lg mb-1">Prospecção nos Estados Unidos</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Prospecção nos EUA é um complemento opcional para planos ativos.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Disponível para:</strong> Starter, Pro e Agency (+ R$ 57/mês)
                    </p>
                  </div>
                  
                  {/* Botões lado direito */}
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <Button
                      type="button"
                      onClick={() => setShowUsaUpsell(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      {hasPaidPlan ? "Ativar complemento" : "Escolher plano"}
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowUsaInlinePromo(false)}
                    >
                      Continuar no Brasil
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Linha 2: Cidade, Estado, Nicho */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                placeholder={getCityPlaceholder(selectedCountry)}
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
                  {getStatesByCountry(selectedCountry).map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
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
                placeholder={selectedCountry === "US" ? "Ex: restaurant, clinic, gym" : "Ex: restaurante, clínica, academia"}
                {...register("nicho")}
              />
              <p className="text-xs text-muted-foreground">
                {selectedCountry === "US" ? "Tip: separate by comma for multiple niches" : "Dica: separe por vírgula para buscar múltiplos nichos"}
              </p>
              {errors.nicho && (
                <p className="text-sm text-destructive">{errors.nicho.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">
              <Label htmlFor="quantidade">
                Quantidade de leads
                {quantityAvailabilityText && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({quantityAvailabilityText})
                  </span>
                )}
              </Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                max={availableLeads}
                disabled={usageLoading || subscriptionLoading}
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
                  {visibleFocusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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

          <div className="rounded-xl border border-border/60 bg-card/45 p-5 shadow-sm ring-1 ring-white/5 sm:p-6">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Revise os filtros e inicie sua busca
                </p>
                <p className="text-xs text-muted-foreground">
                  Quando estiver tudo pronto, clique para encontrar os leads.
                </p>
              </div>

              <Button
                type="submit"
                className="min-h-11 w-full max-w-sm bg-emerald-600 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-500"
                disabled={loading || subscriptionLoading || usageLoading || isAtLimit}
              >
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
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRepeatSearch}
                    disabled={loading}
                    className="w-full"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Buscar novamente
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleIncrementalSearch}
                    disabled={loading}
                    className="w-full"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Buscar mais leads
                  </Button>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* USA Add-on Upsell Modal */}
        <UsaAddonUpsell
          open={showUsaUpsell}
          onOpenChange={setShowUsaUpsell}
          userEmail={userEmail}
          userName={userName}
        />
      </CardContent>
    </Card>
  );
};
