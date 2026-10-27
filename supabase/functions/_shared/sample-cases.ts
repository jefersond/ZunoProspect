// Casos de amostra: empresas e assinantes FICTÍCIOS. Usados pelo script de amostras reais e pelos testes
// determinísticos (F e G), para que os dois avaliem exatamente os mesmos dados.
import { sanitizeSellerProfile, type RawLeadForAnalysis } from "./lead-analysis";

export const sellers = {
  trafego: sanitizeSellerProfile({
    display_name: "Rafael Moura", company_name: "Moura Ads",
    service_offered: "Gestão de tráfego pago para clínicas e consultórios",
    offer_description: "Crio e gerencio campanhas no Google Ads e Meta Ads para clínicas e consultórios receberem pacientes novos em procedimentos específicos, com relatório mensal de contatos e agendamentos.",
    target_audience: "Clínicas odontológicas e consultórios da Grande Vitória",
  }),
  social: sanitizeSellerProfile({
    display_name: "Camila Duarte", company_name: "Duarte Conteúdo",
    service_offered: "Gestão de Instagram para restaurantes",
    offer_description: "Cuido do Instagram de restaurantes: organização do perfil, fotos e vídeos dos pratos, cardápio nos destaques, 12 posts por mês e resposta aos comentários.",
    target_audience: "Restaurantes e lanchonetes",
  }),
  sites: sanitizeSellerProfile({
    display_name: "Marina Costa", company_name: "Costa Digital",
    service_offered: "Criação de sites para negócios locais",
    offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
    target_audience: "Oficinas e comércio local",
  }),
  automacao: sanitizeSellerProfile({
    display_name: "Paulo Nery", company_name: "Nery Automação",
    service_offered: "Automação de atendimento no WhatsApp para lojas",
    offer_description: "Configuro WhatsApp Business com respostas rápidas, catálogo, etiquetas de clientes e lembrete de orçamentos pendentes para lojas pequenas.",
    target_audience: "Lojas e comércio local",
  }),
  agencia: sanitizeSellerProfile({
    display_name: "Bianca Ramos", company_name: "Ramos Performance",
    service_offered: "Google Ads e site para empresas de serviços",
    offer_description: "Agência que monta campanhas de busca no Google e uma página de captação de pedidos de orçamento para empresas de serviços para condomínios e empresas.",
    target_audience: "Prestadores de serviço B2B",
  }),
  semOferta: sanitizeSellerProfile({ display_name: "Ana" }),
};

export const lead = (over: Partial<RawLeadForAnalysis>): RawLeadForAnalysis => ({
  nome: "", nicho: "", cidade: "", endereco: null, website: null, instagram: null, email: null, phone: null,
  rating: null, reviews: null, status: "novo", notas: null, ...over,
});

export const cases = [
  { id: "A", label: "Tráfego pago → clínica odontológica", seller: sellers.trafego, lead: lead({ nome: "Clínica Odontológica Sorriso Vivo", nicho: "clínica odontológica", cidade: "Vitória", website: "https://sorrisovivo.example", phone: "27998765432", reviews: 87, rating: 4.8 }) },
  { id: "B", label: "Social media → restaurante", seller: sellers.social, lead: lead({ nome: "Restaurante Sabor da Ilha", nicho: "restaurante", cidade: "Vila Velha", instagram: "https://instagram.com/saborda.ilha", phone: "27997654321", reviews: 214, rating: 4.6 }) },
  { id: "C", label: "Criação de sites → oficina mecânica", seller: sellers.sites, lead: lead({ nome: "Auto Mecânica Irmãos Lima", nicho: "oficina mecânica", cidade: "Serra", phone: "27996543210", reviews: 46, rating: 4.7 }) },
  { id: "D", label: "Automação → comércio local", seller: sellers.automacao, lead: lead({ nome: "Casa & Cia Utilidades", nicho: "loja de utilidades domésticas", cidade: "Cariacica", website: "https://casaecia.example", phone: "27995432109", reviews: 29, rating: 4.5 }) },
  { id: "E", label: "Agência (serviço informado) → empresa de serviços, telefone fixo", seller: sellers.agencia, lead: lead({ nome: "Andrade Manutenção Predial", nicho: "manutenção predial", cidade: "Vitória", website: "https://andrademp.example", phone: "2733221100", reviews: 12, rating: 4.4 }) },
  { id: "F", label: "Sem descrição da oferta → deve bloquear antes de qualquer chamada", seller: sellers.semOferta, lead: lead({ nome: "Studio Bella Forma", nicho: "estética", cidade: "Guarapari", phone: "2732611234" }) },
  { id: "G", label: "Empresa já respondeu → a sequência fria deve parar", seller: sellers.trafego, lead: lead({ nome: "Clínica Dental Prime", nicho: "clínica odontológica", cidade: "Serra", phone: "27994443322", reviews: 33, rating: 4.9, status: "respondeu", notas: "Respondeu perguntando como funciona e quanto custa." }) },
];

