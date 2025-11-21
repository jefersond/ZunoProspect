import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Mail, MessageCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TemplateCardProps {
  template: {
    id: string;
    nome: string;
    tipo: string;
    conteudo: string;
    assunto?: string | null;
    tags?: string[] | null;
  };
  onEdit: (template: any) => void;
  onDelete: (id: string) => void;
}

export const TemplateCard = ({ template, onEdit, onDelete }: TemplateCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {template.tipo === "whatsapp" ? (
                <MessageCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Mail className="h-4 w-4 text-blue-600" />
              )}
              <Badge variant={template.tipo === "whatsapp" ? "default" : "secondary"}>
                {template.tipo}
              </Badge>
            </div>
            <CardTitle className="text-lg">{template.nome}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {template.tipo === "email" && template.assunto && (
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Assunto:</strong> {template.assunto}
          </p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {template.conteudo}
        </p>
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {template.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(template)}
            className="flex-1"
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja deletar o template "{template.nome}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(template.id)}>
                  Deletar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
