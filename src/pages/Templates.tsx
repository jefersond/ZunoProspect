import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { TemplatesList } from "@/components/templates/TemplatesList";
import { TemplatesGlobais } from "@/components/templates/TemplatesGlobais";
import { TemplateForm } from "@/components/templates/TemplateForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { FileText, Sparkles } from "lucide-react";

const Templates = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("meus");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        const { data: adminData } = await supabase.rpc('is_admin', { _user_id: user.id });
        setIsAdmin(!!adminData);
      }
    };
    checkUser();
  }, [navigate]);

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <AppHeader isAdmin={isAdmin} />

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="meus" className="gap-2">
                <FileText className="h-4 w-4" />
                Meus Templates
              </TabsTrigger>
              <TabsTrigger value="modelos" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Modelos Base
              </TabsTrigger>
            </TabsList>

            {activeTab === "meus" && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            )}
          </div>

          <TabsContent value="meus">
            <TemplatesList onEdit={handleEdit} />
          </TabsContent>

          <TabsContent value="modelos">
            <TemplatesGlobais />
          </TabsContent>
        </Tabs>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Editar Template" : "Novo Template"}
              </DialogTitle>
            </DialogHeader>
            <TemplateForm
              template={editingTemplate}
              onClose={handleCloseForm}
            />
          </DialogContent>
        </Dialog>
      </main>
      <FloatingWhatsAppButton />
    </div>
  );
};

export default Templates;
