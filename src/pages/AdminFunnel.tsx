import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Instagram,
  MessageCircle,
  PackagePlus,
  Repeat2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
  Workflow,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const stages = [
  {
    number: "01",
    name: "Descoberta",
    level: "Topo",
    icon: Instagram,
    objective: "Fazer o público certo reconhecer o problema da prospecção inconsistente.",
    channels: "Instagram: carrosséis, posts únicos, Reels e Stories.",
    content: "Educação, erros comuns, bastidores e identificação com a rotina comercial.",
    conversion: "Visita ao perfil, salvamento, compartilhamento ou resposta ao Story.",
    metric: "Alcance qualificado, visitas ao perfil, salvamentos e respostas.",
  },
  {
    number: "02",
    name: "Interesse",
    level: "Topo → Meio",
    icon: Target,
    objective: "Transformar atenção em uma ação voluntária e mensurável.",
    channels: "DM iniciada pela pessoa, resposta ao Story ou link da bio.",
    content: "Checklist, demonstração curta e diagnóstico simples da rotina atual.",
    conversion: "Pessoa pede para entender melhor ou toca no link para conhecer a Zuno.",
    metric: "DMs recebidas, cliques na bio e conversas iniciadas.",
  },
  {
    number: "03",
    name: "Qualificação",
    level: "Meio",
    icon: MessageCircle,
    objective: "Entender se a Zuno resolve uma dor real antes de oferecer um plano.",
    channels: "WhatsApp oficial, com consentimento e histórico da conversa.",
    content: "Perguntas sobre nicho, cidade, volume de prospecção e processo atual.",
    conversion: "Lead confirma dor, necessidade e intenção de testar uma solução.",
    metric: "Conversas qualificadas e avanço para apresentação da solução.",
  },
  {
    number: "04",
    name: "Decisão",
    level: "Fundo",
    icon: CircleDollarSign,
    objective: "Apresentar a Zuno como próximo passo natural, sem reunião obrigatória.",
    channels: "WhatsApp para objeções; site para oferta, planos e checkout.",
    content: "Demonstração assíncrona, benefícios, comparação do processo e FAQ.",
    conversion: "Escolha do plano e início do teste de 7 dias com cartão.",
    metric: "Visitas à página de preços, início e conclusão do checkout.",
  },
  {
    number: "05",
    name: "Ativação",
    level: "Teste",
    icon: Rocket,
    objective: "Levar o novo usuário ao primeiro valor real ainda no começo do teste.",
    channels: "Produto, WhatsApp e e-mail transacional.",
    content: "Primeira busca, primeiros leads salvos e primeira abordagem criada.",
    conversion: "Usuário encontra leads úteis e prepara uma ação comercial real.",
    metric: "Primeira busca, lead salvo, análise concluída e abordagem copiada.",
  },
  {
    number: "06",
    name: "Assinatura",
    level: "Conversão",
    icon: CheckCircle2,
    objective: "Converter o teste em pagamento porque o usuário percebeu valor.",
    channels: "Produto, e-mail e WhatsApp para dúvidas e objeções.",
    content: "Resumo do uso, próximos ganhos operacionais e recomendação do plano correto.",
    conversion: "Teste permanece ativo e se transforma em assinatura.",
    metric: "Conversão por plano, cancelamentos no teste e motivo de desistência.",
  },
  {
    number: "07",
    name: "Retenção",
    level: "Pós-venda",
    icon: Repeat2,
    objective: "Fazer a Zuno entrar na rotina semanal de prospecção.",
    channels: "Produto, relatórios, e-mail e WhatsApp de suporte.",
    content: "Resumo de valor, dicas de uso, recuperação de inatividade e novidades úteis.",
    conversion: "Uso recorrente e renovação da assinatura.",
    metric: "Usuários ativos, pesquisas, leads trabalhados, renovação e cancelamento.",
  },
  {
    number: "08",
    name: "Expansão e indicação",
    level: "Pós-venda",
    icon: Users,
    objective: "Aumentar receita somente depois de comprovar valor no produto principal.",
    channels: "Dentro da Zuno, e-mail e conversa de suporte.",
    content: "Upgrade por uso, complementos relevantes e pedido de indicação no momento certo.",
    conversion: "Upgrade, complemento validado ou indicação de um novo cliente.",
    metric: "Expansão por cliente, adesão a complementos e indicações.",
  },
];

const postSale = [
  { day: "Dia 0", title: "Boas-vindas", action: "Confirmar acesso e orientar a primeira busca." },
  { day: "Dia 1", title: "Primeiro valor", action: "Ajudar a salvar leads e gerar a primeira abordagem." },
  { day: "Dia 3", title: "Remover bloqueio", action: "Identificar onde o usuário travou e dar uma ação simples." },
  { day: "Dia 5", title: "Resumo do teste", action: "Mostrar o que já foi feito sem inventar resultado." },
  { day: "Dia 7", title: "Continuidade", action: "Explicar cobrança, plano e próximos passos com transparência." },
  { day: "Dia 14", title: "Adoção", action: "Ensinar uma rotina semanal curta de prospecção." },
  { day: "Dia 30", title: "Retenção", action: "Revisar valor percebido, suporte e oportunidade de indicação." },
];

const productIdeas = [
  {
    title: "Pacote de créditos extras",
    buyer: "Cliente que atingiu o limite do plano antes do fim do ciclo.",
    test: "Medir quantos clientes chegam ao limite e pedem mais volume.",
    effort: "Mais próximo",
  },
  {
    title: "Análises de IA adicionais",
    buyer: "Usuário que possui leads, mas precisa priorizar e personalizar mais abordagens.",
    test: "Oferecer uma lista de espera dentro do limite de uso.",
    effort: "Mais próximo",
  },
  {
    title: "Enriquecimento de contatos",
    buyer: "Cliente que quer completar telefone, Instagram e decisor.",
    test: "Medir correções manuais e pedidos por dados mais completos.",
    effort: "Validar fornecedor",
  },
  {
    title: "Assistente oficial de WhatsApp",
    buyer: "Cliente que quer acompanhar conversas consentidas dentro do mesmo fluxo.",
    test: "Validar demanda, custo oficial e regras da Meta antes de construir.",
    effort: "Futuro",
  },
  {
    title: "Configuração acompanhada",
    buyer: "Agência ou profissional que quer a Zuno pronta para o próprio nicho.",
    test: "Vender manualmente para poucos clientes e documentar as etapas.",
    effort: "Serviço piloto",
  },
  {
    title: "Equipe e permissões",
    buyer: "Agências com SDRs ou mais de uma pessoa usando a operação.",
    test: "Registrar pedidos por usuários adicionais e divisão de carteira.",
    effort: "Futuro",
  },
];

export default function AdminFunnel() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={isAdmin} />
      <main className="container mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-4 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/10 text-primary">
                <Workflow className="mr-1 h-3.5 w-3.5" /> Funil mestre da Zuno
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Do primeiro post à assinatura — e depois da venda
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Cada etapa tem um objetivo, uma transição e uma métrica. Instagram cria a descoberta,
                WhatsApp conduz a venda assíncrona e a Zuno entrega o valor que sustenta a assinatura.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="gap-2" onClick={() => navigate("/admin/instagram")}>
                <CalendarDays className="h-4 w-4" /> Criar calendário
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/marketing")}>
                <Sparkles className="h-4 w-4" /> Acionar equipe
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Jornada completa</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O avanço depende de uma ação real do cliente; nenhuma etapa presume interesse.
            </p>
          </div>
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <div key={stage.number}>
                  <Card className="overflow-hidden">
                    <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[220px_1fr_1fr]">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-primary">{stage.number} • {stage.level}</p>
                          <h3 className="mt-1 font-semibold">{stage.name}</h3>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivo e ação</p>
                        <p className="mt-2 text-sm leading-6">{stage.objective}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{stage.channels}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.content}</p>
                      </div>
                      <div className="rounded-xl border bg-muted/25 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saída da etapa</p>
                        <p className="mt-2 text-sm leading-6">{stage.conversion}</p>
                        <div className="mt-3 flex gap-2 text-xs text-primary">
                          <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{stage.metric}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {index < stages.length - 1 && (
                    <ArrowDown className="mx-auto my-1 h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-400" /> Pós-venda programado
              </CardTitle>
              <CardDescription>
                O cliente não pode ficar sozinho depois de colocar o cartão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {postSale.map((item) => (
                <div key={item.day} className="flex gap-3 rounded-xl border p-3">
                  <Badge variant="secondary" className="h-fit shrink-0">{item.day}</Badge>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.action}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-violet-400" /> Produtos complementares
              </CardTitle>
              <CardDescription>
                Hipóteses para validar com clientes antes de gastar tempo construindo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {productIdeas.map((idea) => (
                <div key={idea.title} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{idea.title}</p>
                    <Badge variant="outline">{idea.effort}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{idea.buyer}</p>
                  <div className="mt-2 flex gap-2 text-xs text-primary">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{idea.test}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex gap-3 p-4 text-sm leading-6">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p>
              Regra da operação: primeiro validar o funil principal e gerar assinaturas.
              Produtos complementares entram somente quando o comportamento dos clientes mostrar demanda real.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
