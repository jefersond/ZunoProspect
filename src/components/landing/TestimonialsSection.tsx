import { Quote, Star } from "lucide-react";

const DEPOIMENTOS = [
  {
    nome: "Ana Lima",
    cargo: "Gestora de Tráfego · Agência Digital",
    resultado: "+40 leads/semana",
    foto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
    texto:
      "Antes ficava uma hora no Google Maps pra montar uma lista que nem sempre tinha número certo. Agora faço isso em minutos e ainda sai com contexto da empresa pra saber o que falar.",
  },
  {
    nome: "Kiéffer Moura",
    cargo: "Social Media · Studio KM",
    resultado: "2x mais respostas",
    foto: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
    texto:
      "Achei muito bacana o jeito como prospecta. A gente usa a lista gerada pro cold call. Já vem com Instagram, WhatsApp, tudo pronto. O exemplo de cadência também é muito legal. É um facilitador enorme mesmo.",
  },
  {
    nome: "Rafael Santos",
    cargo: "Head Comercial · Consultoria RS",
    resultado: "Pipeline cheio todo mês",
    foto: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
    texto:
      "O que me prendeu foi não precisar ficar pesquisando Instagram e WhatsApp de cada empresa na mão. Isso já sai pronto. Uso a lista todo dia antes de ligar e a conversa já começa com contexto.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="relative bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      <div className="absolute left-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#10d98a]/3 blur-[100px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-4xl">
            O que dizem quem usa
          </h2>
          <p className="mt-3 text-[#9ca3af]">
            Feedback de profissionais que usam a Zuno no dia a dia de prospecção.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {DEPOIMENTOS.map((d) => (
            <div
              key={d.nome}
              className="flex flex-col rounded-xl border border-[#1f2d29] bg-[#111816]/80 p-6 backdrop-blur"
            >
              {/* Aspas decorativas */}
              <Quote className="mb-3 h-5 w-5 text-[#10d98a]/40" />

              {/* Texto */}
              <p className="flex-1 text-sm leading-relaxed text-[#9ca3af]">
                {d.texto}
              </p>

              {/* Badge resultado */}
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10d98a]/25 bg-[#10d98a]/8 px-3 py-1 text-xs font-bold text-[#10d98a]">
                  {d.resultado}
                </span>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-[#1f2d29]" />

              {/* Autor */}
              <div className="flex items-center gap-3">
                <img
                  src={d.foto}
                  alt={d.nome}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <p className="text-sm font-semibold text-[#f4f4f5]">{d.nome}</p>
                  <p className="text-xs text-[#71717A]">{d.cargo}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
