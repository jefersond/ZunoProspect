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

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-leads`;

const ApiDocs = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useSubscription();
  const [copied, setCopied] = useState<string | null>(null);

  // Redireciona se não for administrador
  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/profile');
    }
  }, [loading, isAdmin, navigate]);

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

  const curlExamples = {
    listPending: `curl -X GET "${API_BASE_URL}/pending" \\
  -H "Authorization: Bearer zuno_live_sua_api_key_aqui"`,
  
    claimLead: `curl -X POST "${API_BASE_URL}/uuid-do-lead/claim" \\
  -H "Authorization: Bearer zuno_live_sua_api_key_aqui" \\
  -H "Idempotency-Key: unique-uuid-value"`,
  
    submitAnalysis: `curl -X POST "${API_BASE_URL}/uuid-do-lead/analysis" \\
  -H "Authorization: Bearer zuno_live_sua_api_key_aqui" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: unique-uuid-value" \\
  -d '{
    "lock_token": "token-recebido-no-claim",
    "agent_name": "agente_claude_prospect",
    "model_used": "claude-3-5-sonnet",
    "priority": "high",
    "opportunity_summary": "Lead não possui pixel instalado e site não é responsivo.",
    "possible_pain": "Perda de conversão em anúncios móveis.",
    "approach_angle": "Abordagem focada em redesenhar a landing page.",
    "whatsapp_message": "Olá! Notei que seu site...",
    "instagram_message": "Oi! Vi seu perfil...",
    "email_subject": "Oportunidade de otimização",
    "email_body": "Prezada equipe...",
    "follow_up_message": "Olá, apenas reforçando...",
    "metadata": {}
  }'`,

    updateStatus: `curl -X PATCH "${API_BASE_URL}/uuid-do-lead/status" \\
  -H "Authorization: Bearer zuno_live_sua_api_key_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "failed",
    "error_message": "Website offline ou inacessível."
  }'`
  };

  const nodeJsExamples = `const axios = require('axios');

const API_KEY = 'zuno_live_sua_api_key_aqui';
const API_URL = '${API_BASE_URL}';

// 1. Buscar Leads Pendentes
async function getPendingLeads() {
  try {
    const response = await axios.get(\`\${API_URL}/pending\`, {
      headers: { 'Authorization': \`Bearer \${API_KEY}\` }
    });
    return response.data.data; // Retorna lista de leads pendentes
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

// 2. Reservar Lead com Lock Atômico
async function claimLead(leadId) {
  try {
    const response = await axios.post(\`\${API_URL}/\${leadId}/claim\`, {}, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Idempotency-Key': crypto.randomUUID()
      }
    });
    return response.data.processing_lock_token; // Retorna o lock token
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('Lead já sendo processado por outro agente.');
    } else {
      console.error('Erro:', error.response?.data || error.message);
    }
  }
}

// 3. Submeter Análise da IA
async function submitAnalysis(leadId, lockToken, analysisData) {
  try {
    const response = await axios.post(\`\${API_URL}/\${leadId}/analysis\`, {
      lock_token: lockToken,
      agent_name: 'node_prospector',
      model_used: 'gpt-4o',
      ...analysisData
    }, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}`;

  const pythonExamples = `import requests
import uuid

API_KEY = 'zuno_live_sua_api_key_aqui'
API_URL = '${API_BASE_URL}'

# 1. Buscar Leads Pendentes
def get_pending_leads():
    headers = {'Authorization': f'Bearer {API_KEY}'}
    response = requests.get(f"{API_URL}/pending", headers=headers)
    if response.status_code == 200:
        return response.json()['data']
    return []

# 2. Reservar Lead
def claim_lead(lead_id):
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Idempotency-Key': str(uuid.uuid4())
    }
    response = requests.post(f"{API_URL}/{lead_id}/claim", headers=headers)
    if response.status_code == 200:
        return response.json()['processing_lock_token']
    elif response.status_code == 409:
        print("Lead em processamento concorrente.")
    return None

# 3. Submeter Análise
def submit_analysis(lead_id, lock_token, analysis):
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
        'Idempotency-Key': str(uuid.uuid4())
    }
    payload = {
        'lock_token': lock_token,
        'agent_name': 'python_bot',
        'model_used': 'claude-3-5-sonnet',
        **analysis
    }
    response = requests.post(f"{API_URL}/{lead_id}/analysis", headers=headers, json=payload)
    return response.json()`;

  const n8nSetup = `## Configuração no n8n

### Passo 1: Listar leads
1. Adicione um nó **HTTP Request**.
2. URL: \`${API_BASE_URL}/pending\`
3. Method: **GET**
4. Headers:
   - \`Authorization\`: \`Bearer zuno_live_sua_api_key_aqui\`

### Passo 2: Loop & Claim (Reserva)
1. Para cada lead, adicione um nó **HTTP Request** para fazer o claim.
2. URL: \`${API_BASE_URL}/{{$json.id}}/claim\`
3. Method: **POST**
4. Headers:
   - \`Authorization\`: \`Bearer zuno_live_sua_api_key_aqui\`
   - \`Idempotency-Key\`: \`{{$json.id}}\` (ou uuid único)
5. Extraia o valor \`processing_lock_token\` retornado.

### Passo 3: Chamada ao Modelo de IA (Claude/GPT)
1. Conecte o nó do Claude/OpenAI passando o contexto do lead recebido no Passo 1.
2. Formate as saídas contendo oportunidade, dores e copies estruturadas.

### Passo 4: Submeter Análise
1. Adicione outro nó **HTTP Request**.
2. URL: \`${API_BASE_URL}/{{$json.id}}/analysis\`
3. Method: **POST**
4. JSON Body:
   {
     "lock_token": "{{$json.processing_lock_token}}",
     "agent_name": "n8n_agent",
     "model_used": "claude-3-5-sonnet",
     "priority": "high",
     "opportunity_summary": "...",
     "whatsapp_message": "..."
   }`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f0e]">
        <div className="animate-spin h-8 w-8 border-4 border-[#10d98a] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f0e] text-[#f4f4f5]">
      <header className="border-b border-[#1f2d29] bg-[#111816]/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Logo />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="gap-2 text-[#9ca3af] hover:text-[#f4f4f5]">
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
            <BookOpen className="h-8 w-8 text-[#10d98a]" />
            <h1 className="text-3xl font-bold">Documentação da API do Agente Externo</h1>
            <Badge className="bg-[#10d98a] text-[#0b0f0e] border-none font-bold">Admin Only</Badge>
          </div>
          <p className="text-[#9ca3af]">
            Integre agentes de IA externos (como Claude, GPT ou Make/n8n) de forma segura para analisar e prospectar leads.
          </p>
        </div>

        {/* Overview */}
        <Card className="mb-6 bg-[#111816] border-[#1f2d29]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#f4f4f5]">
              <Server className="h-5 w-5 text-[#10d98a]" />
              Configurações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]">
                <h3 className="font-semibold mb-2 text-[#9ca3af]">Base URL</h3>
                <code className="text-sm text-[#10d98a] bg-black/40 px-2 py-1 rounded break-all">
                  {API_BASE_URL}
                </code>
              </div>
              <div className="p-4 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]">
                <h3 className="font-semibold mb-2 text-[#9ca3af]">Autenticação</h3>
                <code className="text-sm text-[#10d98a] bg-black/40 px-2 py-1 rounded">
                  Header: Authorization: Bearer zuno_live_xxx
                </code>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/10">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-500">Controle de Permissão ADM</h3>
                  <p className="text-sm text-[#9ca3af]">
                    Esta API opera sob escopos estritos de permissão. Toda chave de API deve ser gerada por administradores. Chaves geradas por usuários sem perfil Admin falharão com erro HTTP 403.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card className="mb-6 bg-[#111816] border-[#1f2d29]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#f4f4f5]">
              <FileJson className="h-5 w-5 text-[#10d98a]" />
              Endpoints Operacionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">GET</Badge>
                  <code className="text-sm text-[#f4f4f5]">/api-leads/pending</code>
                </div>
                <p className="text-sm text-[#9ca3af]">Lista leads aguardando processamento operacional do agente (com dados de contato descriptografados).</p>
              </div>

              <div className="p-4 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">POST</Badge>
                  <code className="text-sm text-[#f4f4f5]">/api-leads/&#123;id&#125;/claim</code>
                </div>
                <p className="text-sm text-[#9ca3af] mb-1">
                  Reserva o lead de forma atômica para processamento por 15 minutos (evita concorrência).
                </p>
                <div className="text-xs text-[#10d98a]">
                  <strong>Retorno:</strong> processing_lock_token (UUID necessário para submeter a análise)
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">POST</Badge>
                  <code className="text-sm text-[#f4f4f5]">/api-leads/&#123;id&#125;/analysis</code>
                </div>
                <p className="text-sm text-[#9ca3af] mb-1">Submete os textos e a análise gerada pelo agente de IA de forma transacional.</p>
                <div className="text-xs text-[#9ca3af]">
                  Requer o header <code className="text-[#10d98a] bg-black/40 px-1 py-0.5 rounded">Idempotency-Key</code> e o token recebido no claim.
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">PATCH</Badge>
                  <code className="text-sm text-[#f4f4f5]">/api-leads/&#123;id&#125;/status</code>
                </div>
                <p className="text-sm text-[#9ca3af]">Atualiza manualmente o status operacional do lead (ex: `failed`, `completed`).</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card className="mb-6 bg-[#111816] border-[#1f2d29]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#f4f4f5]">
              <Code className="h-5 w-5 text-[#10d98a]" />
              Exemplos de Código
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4 bg-[#0b0f0e] border border-[#1f2d29]">
                <TabsTrigger value="curl" className="data-[state=active]:bg-[#10d98a] data-[state=active]:text-[#0b0f0e] text-[#9ca3af]">cURL</TabsTrigger>
                <TabsTrigger value="nodejs" className="data-[state=active]:bg-[#10d98a] data-[state=active]:text-[#0b0f0e] text-[#9ca3af]">Node.js</TabsTrigger>
                <TabsTrigger value="python" className="data-[state=active]:bg-[#10d98a] data-[state=active]:text-[#0b0f0e] text-[#9ca3af]">Python</TabsTrigger>
                <TabsTrigger value="n8n" className="data-[state=active]:bg-[#10d98a] data-[state=active]:text-[#0b0f0e] text-[#9ca3af]">n8n / Make</TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 text-[#9ca3af]">1. Listar Leads Pendentes</h3>
                  <CodeBlock id="curl-list" language="bash" code={curlExamples.listPending} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-[#9ca3af]">2. Reservar Lead (Claim)</h3>
                  <CodeBlock id="curl-claim" language="bash" code={curlExamples.claimLead} />
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-[#9ca3af]">3. Enviar Análise</h3>
                  <CodeBlock id="curl-analysis" language="bash" code={curlExamples.submitAnalysis} />
                </div>
              </TabsContent>

              <TabsContent value="nodejs">
                <CodeBlock id="nodejs-code" language="javascript" code={nodeJsExamples} />
              </TabsContent>

              <TabsContent value="python">
                <CodeBlock id="python-code" language="python" code={pythonExamples} />
              </TabsContent>

              <TabsContent value="n8n">
                <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm text-[#9ca3af] whitespace-pre-wrap leading-6">
                  {n8nSetup}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card className="bg-[#111816] border-[#1f2d29]">
          <CardHeader>
            <CardTitle className="text-[#f4f4f5]">Códigos de Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4 p-2 rounded border border-[#1f2d29] bg-[#0b0f0e]">
                <Badge variant="destructive">401</Badge>
                <span className="font-mono text-[#10d98a]">INVALID_API_KEY / EXPIRED_API_KEY</span>
                <span className="text-[#9ca3af] ml-auto">API Key inválida, revogada ou expirada.</span>
              </div>
              <div className="flex items-center gap-4 p-2 rounded border border-[#1f2d29] bg-[#0b0f0e]">
                <Badge variant="destructive">403</Badge>
                <span className="font-mono text-[#10d98a]">ADMIN_ACCESS_REQUIRED</span>
                <span className="text-[#9ca3af] ml-auto">Disponível apenas para contas de administrador.</span>
              </div>
              <div className="flex items-center gap-4 p-2 rounded border border-[#1f2d29] bg-[#0b0f0e]">
                <Badge variant="destructive">409</Badge>
                <span className="font-mono text-[#10d98a]">PROCESSING_CONFLICT</span>
                <span className="text-[#9ca3af] ml-auto">Lead já em processamento ou colisão de Idempotency-Key.</span>
              </div>
              <div className="flex items-center gap-4 p-2 rounded border border-[#1f2d29] bg-[#0b0f0e]">
                <Badge variant="destructive">422</Badge>
                <span className="font-mono text-[#10d98a]">INVALID_LOCK_TOKEN / EXPIRED_LOCK</span>
                <span className="text-[#9ca3af] ml-auto">Token de reserva do lead incorreto ou tempo expirado (15m).</span>
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
