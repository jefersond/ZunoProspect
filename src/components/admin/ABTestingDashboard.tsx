import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  FlaskConical, 
  Plus, 
  Eye, 
  Pause, 
  Play, 
  Trophy, 
  BarChart3,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ABTestEditor } from "./ABTestEditor";

interface ABTest {
  id: string;
  email_type: string;
  variant: string;
  name: string;
  subject: string;
  template_html: string;
  is_active: boolean;
  weight: number;
  created_at: string;
  updated_at: string;
}

interface ABResult {
  test_id: string;
  variant_sent: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  converted_count: number;
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  first_24h: { label: "Primeiro Email (24h)", color: "bg-purple-500" },
  used_not_saved: { label: "Usou mas não salvou", color: "bg-green-500" },
  saved_no_ai: { label: "Salvou sem IA", color: "bg-amber-500" },
  inactive_7d: { label: "Inativo 7 dias", color: "bg-red-500" },
  never_upgraded: { label: "Nunca fez upgrade", color: "bg-blue-500" },
};

export const ABTestingDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<ABTest[]>([]);
  const [results, setResults] = useState<Record<string, ABResult[]>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [editingTest, setEditingTest] = useState<ABTest | null>(null);
  const [previewTest, setPreviewTest] = useState<ABTest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load all tests
      const { data: testsData, error: testsError } = await supabase
        .from("email_ab_tests")
        .select("*")
        .order("email_type", { ascending: true })
        .order("variant", { ascending: true });

      if (testsError) throw testsError;
      setTests(testsData || []);

      // Load results for each test
      const { data: resultsData, error: resultsError } = await supabase
        .from("email_ab_results")
        .select("test_id, variant_sent, sent_at, opened_at, clicked_at, converted_at");

      if (resultsError) throw resultsError;

      // Aggregate results by test_id
      const aggregated: Record<string, ABResult[]> = {};
      
      if (resultsData) {
        const grouped = resultsData.reduce((acc, row) => {
          const key = `${row.test_id}_${row.variant_sent}`;
          if (!acc[key]) {
            acc[key] = {
              test_id: row.test_id,
              variant_sent: row.variant_sent,
              sent_count: 0,
              opened_count: 0,
              clicked_count: 0,
              converted_count: 0,
            };
          }
          acc[key].sent_count++;
          if (row.opened_at) acc[key].opened_count++;
          if (row.clicked_at) acc[key].clicked_count++;
          if (row.converted_at) acc[key].converted_count++;
          return acc;
        }, {} as Record<string, ABResult>);

        // Group by test_id
        Object.values(grouped).forEach((result) => {
          if (!aggregated[result.test_id]) {
            aggregated[result.test_id] = [];
          }
          aggregated[result.test_id].push(result);
        });
      }

      setResults(aggregated);
    } catch (error: any) {
      console.error("Error loading A/B tests:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar testes",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggleActive = async (test: ABTest) => {
    try {
      const { error } = await supabase
        .from("email_ab_tests")
        .update({ is_active: !test.is_active })
        .eq("id", test.id);

      if (error) throw error;

      toast({
        title: test.is_active ? "Teste pausado" : "Teste ativado",
        description: `Variante ${test.variant} foi ${test.is_active ? "pausada" : "ativada"}.`,
      });

      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const handleDeleteTest = async (test: ABTest) => {
    if (!confirm(`Tem certeza que deseja excluir a variante ${test.variant} do teste "${test.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("email_ab_tests")
        .delete()
        .eq("id", test.id);

      if (error) throw error;

      toast({
        title: "Teste excluído",
        description: `Variante ${test.variant} foi removida.`,
      });

      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    }
  };

  const handlePromoteWinner = async (test: ABTest) => {
    // This would promote the winning variant as the default template
    // For now, we just deactivate other variants
    try {
      // Deactivate all other variants for this email type
      const { error } = await supabase
        .from("email_ab_tests")
        .update({ is_active: false })
        .eq("email_type", test.email_type)
        .neq("id", test.id);

      if (error) throw error;

      toast({
        title: "Variante promovida!",
        description: `${test.variant} agora é a única variante ativa para ${EMAIL_TYPE_LABELS[test.email_type]?.label || test.email_type}.`,
      });

      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  // Group tests by email_type
  const testsByType = tests.reduce((acc, test) => {
    if (!acc[test.email_type]) {
      acc[test.email_type] = [];
    }
    acc[test.email_type].push(test);
    return acc;
  }, {} as Record<string, ABTest[]>);

  const getTestResults = (testId: string): ABResult | null => {
    const testResults = results[testId];
    if (!testResults || testResults.length === 0) return null;
    return testResults[0];
  };

  const calculateOpenRate = (result: ABResult | null): number => {
    if (!result || result.sent_count === 0) return 0;
    return Math.round((result.opened_count / result.sent_count) * 100);
  };

  const calculateClickRate = (result: ABResult | null): number => {
    if (!result || result.sent_count === 0) return 0;
    return Math.round((result.clicked_count / result.sent_count) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FlaskConical className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">A/B Testing</h2>
            <p className="text-sm text-muted-foreground">
              Teste diferentes versões de emails para otimizar conversões
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => { setEditingTest(null); setShowEditor(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Teste
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Testes Ativos</p>
                <p className="text-2xl font-bold">{tests.filter(t => t.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <BarChart3 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Variantes</p>
                <p className="text-2xl font-bold">{tests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Trophy className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipos de Email</p>
                <p className="text-2xl font-bold">{Object.keys(testsByType).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Eye className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enviados</p>
                <p className="text-2xl font-bold">
                  {Object.values(results).flat().reduce((sum, r) => sum + r.sent_count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tests by Type */}
      {Object.keys(testsByType).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">Nenhum teste A/B criado ainda.</p>
            <Button onClick={() => setShowEditor(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeiro teste
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(testsByType).map(([emailType, typeTests]) => (
          <Card key={emailType}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={EMAIL_TYPE_LABELS[emailType]?.color || "bg-gray-500"}>
                    {EMAIL_TYPE_LABELS[emailType]?.label || emailType}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {typeTests.filter(t => t.is_active).length} variantes ativas
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variante</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Enviados</TableHead>
                    <TableHead className="text-center">Taxa Abertura</TableHead>
                    <TableHead className="text-center">Taxa Clique</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeTests.map((test) => {
                    const result = getTestResults(test.id);
                    const openRate = calculateOpenRate(result);
                    const clickRate = calculateClickRate(result);
                    
                    // Find best performer
                    const allResults = typeTests.map(t => ({
                      test: t,
                      result: getTestResults(t.id),
                    }));
                    const bestOpenRate = Math.max(...allResults.map(r => calculateOpenRate(r.result)));
                    const isBest = openRate === bestOpenRate && openRate > 0;

                    return (
                      <TableRow key={test.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-lg">{test.variant}</span>
                            {isBest && (
                              <Trophy className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{test.name}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {test.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{test.weight}%</Badge>
                        </TableCell>
                        <TableCell>
                          {test.is_active ? (
                            <Badge className="bg-green-500">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Pausado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {result?.sent_count || 0}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-medium">{openRate}%</span>
                            <Progress value={openRate} className="w-16 h-1" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-medium">{clickRate}%</span>
                            <Progress value={clickRate} className="w-16 h-1" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewTest(test)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(test)}
                              title={test.is_active ? "Pausar" : "Ativar"}
                            >
                              {test.is_active ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            {isBest && typeTests.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePromoteWinner(test)}
                                title="Promover como vencedor"
                                className="text-amber-500 hover:text-amber-600"
                              >
                                <Trophy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingTest(test); setShowEditor(true); }}
                              title="Editar"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTest(test)}
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Editor Dialog */}
      <ABTestEditor
        open={showEditor}
        onOpenChange={setShowEditor}
        editingTest={editingTest}
        onSave={() => {
          setShowEditor(false);
          setEditingTest(null);
          loadData();
        }}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewTest} onOpenChange={() => setPreviewTest(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Preview: Variante {previewTest?.variant} - {previewTest?.name}
            </DialogTitle>
            <DialogDescription>
              Assunto: {previewTest?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] border rounded-lg">
            {previewTest && (
              <iframe
                srcDoc={previewTest.template_html}
                className="w-full h-[600px] border-0"
                title="Email Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
