import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Key, 
  Code, 
  Zap as ZapIcon, 
  Copy, 
  Check,
  FileJson,
  Server,
  Shield,
  BookOpen
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-leads`;

const ApiDocs = () => {
  const navigate = useNavigate();
  const { subscription, isAdmin, loading } = useSubscription();
  const [copied, setCopied] = useState<string | null>(null);

  // Redirect if not agency plan
  useEffect(() => {
    if (!loading && !isAdmin && subscription?.plan_name !== 'agencia') {
      navigate('/profile');
    }
  }, [loading, isAdmin, subscription, navigate]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ code, language, id }: { code: string; language: string; id: string }) => (
    <div className="relative group">
      <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copied === id ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  const nodeJsExamples = {
    listLeads: `const axios = require('axios');

const API_KEY = 'zuno_sua_api_key_aqui';
const API_URL = '${API_BASE_URL}';

async function listLeads(page = 1, limit = 50) {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      params: { page, limit }
    });
    
    console.log('Leads:', response.data.data);
    console.log('Pagination:', response.data.pagination);
    return response.data;
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

// Uso
listLeads(1, 20);`,

    getLead: `async function getLeadById(leadId) {
  try {
    const response = await axios.get(API_URL, {
      headers: { 'x-api-key': API_KEY },
      params: { id: leadId }
    });
    
    console.log('Lead:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

// Uso
getLeadById('uuid-do-lead');`,

    updateLead: `async function updateLead(leadId, updates) {
  try {
    const response = await axios.patch(API_URL, {
      id: leadId,
      ...updates
    }, {
      headers: { 
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Lead atualizado:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

// Uso
updateLead('uuid-do-lead', {
  status: 'em_negociacao',
  notas: 'Cliente interessado em tráfego pago'
});`,

    analytics: `async function getAnalytics() {
  try {
    const response = await axios.get(API_URL, {
      headers: { 'x-api-key': API_KEY },
      params: { action: 'analytics' }
    });
    
    console.log('Analytics:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

// Uso
getAnalytics();`
  };

  const pythonExamples = {
    listLeads: `import requests

API_KEY = 'zuno_sua_api_key_aqui'
API_URL = '${API_BASE_URL}'

def list_leads(page=1, limit=50):
    headers = {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    }
    params = {'page': page, 'limit': limit}
    
    response = requests.get(API_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Total de leads: {data['pagination']['total']}")
        return data['data']
    else:
        print(f"Erro: {response.json()}")
        return None

# Uso
leads = list_leads(page=1, limit=20)
for lead in leads:
    print(f"- {lead['nome']} ({lead['cidade']})")`,

    getLead: `def get_lead(lead_id):
    headers = {'x-api-key': API_KEY}
    params = {'id': lead_id}
    
    response = requests.get(API_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        return response.json()['data']
    else:
        print(f"Erro: {response.json()}")
        return None

# Uso
lead = get_lead('uuid-do-lead')
if lead:
    print(f"Nome: {lead['nome']}")
    print(f"Telefone: {lead['telefone']}")
    print(f"Email: {lead['email']}")`,

    updateLead: `def update_lead(lead_id, **updates):
    headers = {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    }
    data = {'id': lead_id, **updates}
    
    response = requests.patch(API_URL, headers=headers, json=data)
    
    if response.status_code == 200:
        print("Lead atualizado com sucesso!")
        return response.json()['data']
    else:
        print(f"Erro: {response.json()}")
        return None

# Uso
update_lead(
    'uuid-do-lead',
    status='em_negociacao',
    notas='Cliente interessado em SEO'
)`,

    analytics: `def get_analytics():
    headers = {'x-api-key': API_KEY}
    params = {'action': 'analytics'}
    
    response = requests.get(API_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()['data']
        print(f"Total de leads: {data['total_leads']}")
        print(f"Leads salvos: {data['saved_leads']}")
        print("Por status:", data['by_status'])
        print("Por foco:", data['by_foco'])
        return data
    else:
        print(f"Erro: {response.json()}")
        return None

# Uso
analytics = get_analytics()`
  };

  const zapierSetup = `## Configuração no Zapier

### 1. Criar um Zap com Webhook
1. Acesse zapier.com e crie um novo Zap
2. Escolha "Webhooks by Zapier" como trigger ou action
3. Selecione "Custom Request" para requisições personalizadas

### 2. Configurar a Requisição

**Para listar leads:**
- Method: GET
- URL: ${API_BASE_URL}
- Headers:
  - x-api-key: zuno_sua_api_key_aqui
  - Content-Type: application/json

**Para atualizar lead:**
- Method: PATCH  
- URL: ${API_BASE_URL}
- Headers:
  - x-api-key: zuno_sua_api_key_aqui
  - Content-Type: application/json
- Data (JSON):
  {
    "id": "{{lead_id}}",
    "status": "{{novo_status}}",
    "notas": "{{notas}}"
  }

### 3. Exemplo de Fluxo: CRM → Zuno
1. Trigger: Novo lead no seu CRM
2. Action: Webhook para atualizar status no Zuno

### 4. Exemplo de Fluxo: Zuno → Planilha
1. Trigger: Schedule (diário)
2. Action 1: Webhook GET para buscar leads
3. Action 2: Adicionar linha no Google Sheets`;

  const makeSetup = `## Configuração no Make (Integromat)

### 1. Criar Cenário com HTTP
1. Acesse make.com e crie um novo cenário
2. Adicione o módulo "HTTP" → "Make a request"

### 2. Configurar Requisição

**Headers (para todos os requests):**
- x-api-key: zuno_sua_api_key_aqui

**GET - Listar Leads:**
- URL: ${API_BASE_URL}?page=1&limit=50
- Method: GET

**GET - Buscar Lead:**
- URL: ${API_BASE_URL}?id={{leadId}}
- Method: GET

**PATCH - Atualizar Lead:**
- URL: ${API_BASE_URL}
- Method: PATCH
- Body type: JSON
- Request content:
  {
    "id": "{{leadId}}",
    "status": "{{status}}"
  }

### 3. Parsear Resposta
Use o módulo "JSON" → "Parse JSON" para extrair os dados da resposta.`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Logo />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Perfil
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Documentação da API</h1>
            <Badge variant="secondary">Agência</Badge>
          </div>
          <p className="text-muted-foreground">
            Integre o Zuno Prospect com seu CRM, automações e outras ferramentas
          </p>
        </div>

        {/* Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Visão Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold mb-2">Base URL</h3>
                <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                  {API_BASE_URL}
                </code>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold mb-2">Autenticação</h3>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  Header: x-api-key
                </code>
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/20">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-500">Segurança</h3>
                  <p className="text-sm text-muted-foreground">
                    Nunca exponha sua API Key em código frontend. Use variáveis de ambiente e 
                    faça requisições apenas do lado do servidor.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Endpoints Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">GET</Badge>
                  <code className="text-sm">/api-leads</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Lista todos os leads com paginação</p>
                <div className="text-xs text-muted-foreground">
                  <strong>Query Params:</strong> page, limit, status, foco, salvo
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">GET</Badge>
                  <code className="text-sm">/api-leads?id=uuid</code>
                </div>
                <p className="text-sm text-muted-foreground">Retorna detalhes de um lead específico</p>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">PATCH</Badge>
                  <code className="text-sm">/api-leads</code>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Atualiza um lead existente</p>
                <div className="text-xs text-muted-foreground">
                  <strong>Body:</strong> id (obrigatório), status, notas, salvo
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">GET</Badge>
                  <code className="text-sm">/api-leads?action=analytics</code>
                </div>
                <p className="text-sm text-muted-foreground">Retorna métricas resumidas dos leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Format */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Formato de Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              id="response-format"
              language="json"
              code={`{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "total_pages": 3
  }
}`}
            />
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Exemplos de Código
            </CardTitle>
            <CardDescription>
              Copie e adapte os exemplos para sua linguagem preferida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="nodejs" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="nodejs" className="gap-2">
                  <Code className="h-4 w-4" />
                  Node.js
                </TabsTrigger>
                <TabsTrigger value="python" className="gap-2">
                  <Code className="h-4 w-4" />
                  Python
                </TabsTrigger>
                <TabsTrigger value="zapier" className="gap-2">
                  <ZapIcon className="h-4 w-4" />
                  Zapier
                </TabsTrigger>
                <TabsTrigger value="make" className="gap-2">
                  <ZapIcon className="h-4 w-4" />
                  Make
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nodejs" className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">1. Listar Leads</h3>
                  <CodeBlock id="nodejs-list" language="javascript" code={nodeJsExamples.listLeads} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. Buscar Lead por ID</h3>
                  <CodeBlock id="nodejs-get" language="javascript" code={nodeJsExamples.getLead} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. Atualizar Lead</h3>
                  <CodeBlock id="nodejs-update" language="javascript" code={nodeJsExamples.updateLead} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">4. Obter Analytics</h3>
                  <CodeBlock id="nodejs-analytics" language="javascript" code={nodeJsExamples.analytics} />
                </div>
              </TabsContent>

              <TabsContent value="python" className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">1. Listar Leads</h3>
                  <CodeBlock id="python-list" language="python" code={pythonExamples.listLeads} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. Buscar Lead por ID</h3>
                  <CodeBlock id="python-get" language="python" code={pythonExamples.getLead} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. Atualizar Lead</h3>
                  <CodeBlock id="python-update" language="python" code={pythonExamples.updateLead} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">4. Obter Analytics</h3>
                  <CodeBlock id="python-analytics" language="python" code={pythonExamples.analytics} />
                </div>
              </TabsContent>

              <TabsContent value="zapier">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm whitespace-pre-wrap">
                    {zapierSetup}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="make">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm whitespace-pre-wrap">
                    {makeSetup}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Status Values */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Valores de Status</CardTitle>
            <CardDescription>Valores aceitos para o campo "status" ao atualizar leads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {['novo', 'em_contato', 'em_negociacao', 'convertido', 'perdido', 'arquivado'].map((status) => (
                <Badge key={status} variant="outline" className="font-mono">
                  {status}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Códigos de Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4 p-2 rounded border">
                <Badge variant="destructive">401</Badge>
                <span>API Key não fornecida ou inválida</span>
              </div>
              <div className="flex items-center gap-4 p-2 rounded border">
                <Badge variant="destructive">403</Badge>
                <span>Plano não autorizado (requer Agência)</span>
              </div>
              <div className="flex items-center gap-4 p-2 rounded border">
                <Badge variant="destructive">404</Badge>
                <span>Lead não encontrado</span>
              </div>
              <div className="flex items-center gap-4 p-2 rounded border">
                <Badge variant="destructive">500</Badge>
                <span>Erro interno do servidor</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <FloatingWhatsAppButton />
    </div>
  );
};

export default ApiDocs;
