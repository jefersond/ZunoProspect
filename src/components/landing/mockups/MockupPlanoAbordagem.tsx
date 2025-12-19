import { Calendar, MessageCircle, Mail, Instagram, Check } from "lucide-react";

const dias = [
  { dia: 1, canal: "WhatsApp", icone: MessageCircle, titulo: "Apresentação", mensagem: "Olá! Vi que a Pizzaria Bella Italia tem uma presença incrível no Instagram...", ativo: true, completo: true },
  { dia: 2, canal: "Email", icone: Mail, titulo: "Follow-up", mensagem: "Complementando meu contato de ontem, gostaria de compartilhar...", ativo: false, completo: false },
  { dia: 3, canal: "Instagram", icone: Instagram, titulo: "Interação", mensagem: "Curtir e comentar posts recentes, criar conexão...", ativo: false, completo: false },
  { dia: 4, canal: "WhatsApp", icone: MessageCircle, titulo: "Proposta", mensagem: "Preparei uma proposta personalizada para vocês...", ativo: false, completo: false },
  { dia: 5, canal: "Email", icone: Mail, titulo: "Case de Sucesso", mensagem: "Veja como ajudamos a Pizzaria do Mario a aumentar...", ativo: false, completo: false },
  { dia: 6, canal: "Instagram", icone: Instagram, titulo: "Story", mensagem: "Interagir com stories, mostrar presença...", ativo: false, completo: false },
  { dia: 7, canal: "WhatsApp", icone: MessageCircle, titulo: "Última Chance", mensagem: "Última mensagem antes de arquivar o contato...", ativo: false, completo: false },
];

export function MockupPlanoAbordagem() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Plano de Prospecção - 7 dias</h3>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {dias.map((item, index) => {
          const Icon = item.icone;
          return (
            <div key={item.dia} className="relative">
              {/* Linha conectora */}
              {index < dias.length - 1 && (
                <div className={`absolute left-[19px] top-10 w-0.5 h-8 ${item.completo ? 'bg-success' : 'bg-border'}`} />
              )}
              
              <div className={`flex items-start gap-4 p-3 rounded-lg transition-colors ${item.ativo ? 'bg-primary/5 border border-primary/20' : ''}`}>
                {/* Indicador */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.completo ? 'bg-success text-success-foreground' : 
                  item.ativo ? 'bg-primary text-primary-foreground' : 
                  'bg-muted text-muted-foreground'
                }`}>
                  {item.completo ? <Check className="h-5 w-5" /> : <span className="text-sm font-medium">{item.dia}</span>}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${item.ativo ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${item.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.canal} - {item.titulo}
                    </span>
                  </div>
                  {item.ativo && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      "{item.mensagem}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
