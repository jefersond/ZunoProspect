import { Star } from "lucide-react";

const DEPOIMENTOS = [
  {
    nome: "Kiéffer",
    cargo: "Comercial · Prospecção ativa",
    avatar: "KF",
    cor: "#6366F1",
    texto:
      "Achei muito bacana mesmo o jeito como prospecta. A gente não usa as mensagens que gera — temos nosso próprio processo de cold call — mas o exemplo de cadência é muito legal. E já trazer o Instagram e o WhatsApp da empresa pronto é um facilitador enorme, muito top.",
    resultado: "Usa na cadência de cold call",
  },
  {
    nome: "Rafael · Gestor de Vendas",
    cargo: "Time comercial · 4 pessoas",
    avatar: "RM",
    cor: "#10B981",
    texto:
      "O que me prendeu foi não precisar pesquisar Instagram e WhatsApp de cada empresa manualmente. Isso já saía pronto. Passei a usar a lista todo dia antes de ligar — a conversa já começa com contexto.",
    resultado: "Lista diária antes de ligar",
  },
  {
    nome: "Ana · Freelancer B2B",
    cargo: "Prospecção · Agências e serviços",
    avatar: "AB",
    cor: "#F59E0B",
    texto:
      "Antes eu ficava uma hora no Google Maps pra montar uma lista que às vezes não tinha nem número certo. Com a Zuno eu faço isso em 5 minutos e ainda sai com o contexto da empresa pra saber o que falar.",
    resultado: "De 1h pra 5 min por lista",
  },
];

export function TestimonialsSection() {
  return (
    <section className="relative bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      <div className="absolute left-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#10d98a]/3 blur-[100px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 flex justify-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-[#F59E0B] text-[#F59E0B]" />
            ))}
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-4xl">
            Quem já usa não volta pra planilha
          </h2>
          <p className="mt-3 text-[#9ca3af]">
            Resultados reais de profissionais que trocaram o improviso por um sistema.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {DEPOIMENTOS.map((d) => (
            <div
              key={d.nome}
              className="flex flex-col rounded-xl border border-[#1f2d29] bg-[#111816]/80 p-6 backdrop-blur transition-all hover:border-[#10d98a]/20"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
              </div>

              {/* Depoimento */}
              <p className="flex-1 text-sm leading-relaxed text-[#9ca3af]">
                "{d.texto}"
              </p>

              {/* Resultado destaque */}
              <div className="mt-5 mb-5 rounded-lg bg-[#10d98a]/5 border border-[#10d98a]/15 px-4 py-2 text-center">
                <span className="text-sm font-bold text-[#10d98a]">
                  ✓ {d.resultado}
                </span>
              </div>

              {/* Autor */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: d.cor }}
                >
                  {d.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f4f4f5]">{d.nome}</p>
                  <p className="text-xs text-[#71717A]">{d.cargo}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
