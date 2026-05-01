import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Loader2, 
  AlertTriangle,
  ExternalLink,
  Clock,
  Shield,
  BookOpen
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export const ApiKeysSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyDialog, setNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        method: 'GET',
      });

      if (error) throw error;
      if (data?.success) {
        setApiKeys(data.data || []);
      }
    } catch (error: any) {
      console.error('Error loading API keys:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar API Keys",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Digite um nome para identificar a API Key.",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        method: 'POST',
        body: { name: newKeyName.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCreatedKey(data.data.api_key);
      setApiKeys(prev => [data.data, ...prev]);
      setNewKeyName("");
      
      toast({
        title: "API Key criada!",
        description: "Copie e guarde em local seguro.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar API Key",
        description: error.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    setRevoking(keyId);
    try {
      const { data, error } = await supabase.functions.invoke('api-keys-manage', {
        method: 'DELETE',
        body: { key_id: keyId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      setRevokeDialog(null);
      
      toast({
        title: "API Key revogada",
        description: "A key foi desativada permanentemente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao revogar API Key",
        description: error.message,
      });
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeKeys = apiKeys.filter(k => !k.revoked_at);

  if (loading) {
    return (
      <Card className="shadow-lg mt-6">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-lg mt-6 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            API de Integração
            <Badge variant="secondary" className="ml-2">Agência</Badge>
          </CardTitle>
          <CardDescription>
            Conecte o Zuno Prospect com seu CRM, Zapier ou outras ferramentas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new key button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {activeKeys.length}/5 API Keys ativas
            </p>
            <Button 
              size="sm" 
              onClick={() => setNewKeyDialog(true)}
              disabled={activeKeys.length >= 5}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova API Key
            </Button>
          </div>

          {/* API Keys list */}
          {activeKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma API Key criada ainda.</p>
              <p className="text-sm">Crie uma para integrar com outros sistemas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((key) => (
                <div 
                  key={key.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{key.name}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {key.key_preview}
                      </code>
                      {key.last_used_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Último uso: {new Date(key.last_used_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRevokeDialog(key.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Documentation link */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Como usar:</strong> Adicione o header <code className="bg-muted px-1 rounded">x-api-key</code> nas suas requisições.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
              <p className="text-muted-foreground"># Exemplo de requisição</p>
              <p>curl -H "x-api-key: zuno_xxxxx..." \</p>
              <p className="pl-4">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-leads</p>
            </div>
            <div className="mt-3 text-sm">
              <p className="font-medium mb-1">Endpoints disponíveis:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li><code className="bg-muted px-1 rounded">GET /api-leads</code> - Listar leads</li>
                <li><code className="bg-muted px-1 rounded">GET /api-leads?id=uuid</code> - Detalhes do lead</li>
                <li><code className="bg-muted px-1 rounded">PATCH /api-leads</code> - Atualizar lead</li>
                <li><code className="bg-muted px-1 rounded">GET /api-leads?action=analytics</code> - Métricas</li>
              </ul>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/api-docs')}
              className="mt-4 gap-2 w-full"
            >
              <BookOpen className="h-4 w-4" />
              Ver Documentação Completa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={newKeyDialog} onOpenChange={(open) => {
        if (!open) {
          setNewKeyDialog(false);
          setNewKeyName("");
          setCreatedKey(null);
        } else {
          setNewKeyDialog(true);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {createdKey ? "API Key Criada!" : "Nova API Key"}
            </DialogTitle>
            <DialogDescription>
              {createdKey 
                ? "Copie a key abaixo. Ela não será mostrada novamente!"
                : "Dê um nome para identificar esta API Key."
              }
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-500">
                  Guarde esta key em local seguro!
                </p>
              </div>
              <div className="relative">
                <Input
                  value={createdKey}
                  readOnly
                  className="pr-12 font-mono text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  setNewKeyDialog(false);
                  setCreatedKey(null);
                  setNewKeyName("");
                }}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="key-name">Nome da API Key</Label>
                <Input
                  id="key-name"
                  placeholder="Ex: Integração CRM, Zapier..."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewKeyDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateKey} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar API Key"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeDialog} onOpenChange={() => setRevokeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Revogar API Key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A API Key será desativada imediatamente
              e todas as integrações que a utilizam deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeDialog && handleRevokeKey(revokeDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revogando...
                </>
              ) : (
                "Revogar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
