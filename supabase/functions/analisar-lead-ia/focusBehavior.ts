export interface FocusBehavior {
  label: string;
  commercial_goal: string;
  diagnosis_lens: string;
  likely_pains: string[];
  approach_angles: string[];
  recommended_terms: string[];
  avoid_terms: string[];
  cta_examples: string[];
  likely_objections: string[];
  objection_responses: string[];
  cadence_strategy: {
    day_1: string;
    day_2: string;
    day_3: string;
    day_4: string;
    day_5: string;
    day_6: string;
    day_7: string;
  };
  fallback_messages: {
    day_1: string;
    day_2: string;
    day_3: string;
    day_4: string;
    day_5: string;
    day_6: string;
    day_7: string;
  };
}

export const FOCUS_BEHAVIOR_MAP: Record<string, FocusBehavior> = {
  trafego: {
    label: "Tráfego",
    commercial_goal: "Gerar conversa sobre aquisição de clientes, campanhas e previsibilidade de demanda.",
    diagnosis_lens: "presença digital, possibilidade de captar clientes locais, sinais de demanda, site/Instagram/canais de contato, clareza da oferta, potencial para campanhas",
    likely_pains: [
      "depende de indicação",
      "posta, mas não gera conversa",
      "tem presença digital, mas sem previsibilidade",
      "anúncios podem não estar bem estruturados",
      "dificuldade em transformar visualização em contato"
    ],
    approach_angles: [
      "gerar demanda local",
      "transformar atenção em conversa",
      "campanhas com objetivo comercial",
      "captação mais previsível",
      "WhatsApp como ponto de conversão"
    ],
    recommended_terms: ["demanda", "campanhas", "conversas qualificadas", "captação local", "previsibilidade", "WhatsApp comercial", "intenção de compra"],
    avoid_terms: ["viralizar", "bombar", "resultado garantido", "dobrar faturamento"],
    cta_examples: [
      "Posso te mostrar uma ideia de campanha aplicada ao seu nicho?",
      "Faz sentido eu te mandar um exemplo de como atrair mais conversas qualificadas?"
    ],
    likely_objections: [
      "Não temos orçamento para anúncios agora.",
      "Já tentamos tráfego pago e não funcionou antes."
    ],
    objection_responses: [
      "Entendo, a ideia não é começar com verba alta. Sugiro começar estruturando o fluxo de atendimento para não perder os contatos que chegam.",
      "Justo. Muitas vezes a falha não é no anúncio, mas no destino (ex: site confuso). Posso te mostrar como testar isso sem desperdiçar verba?"
    ],
    cadence_strategy: {
      day_1: "Abertura sobre fluxo ativo de novas conversas de tráfego pago.",
      day_2: "Retomar abordando a dor de depender apenas de indicações locais.",
      day_3: "Enviar um exemplo prático de funil rápido aplicado a ${lead.nicho}.",
      day_4: "Explicar a lógica de ter canais de contato e pixel prontos antes de anunciar.",
      day_5: "Quebrar a objeção clássica de orçamento de anúncios.",
      day_6: "Oferecer simulação curta de anúncio sem compromisso de reunião.",
      day_7: "Encerramento elegante de prospecção deixando canais abertos."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}. Me chamou atenção a estrutura digital de vocês.\n\nHoje o processo de vocês para atrair novos contatos é mais ativo ou vocês dependem mais de indicação e busca passiva?\n\nFaz sentido eu te mandar uma ideia de campanha para ${lead.nicho}?",
      day_2: "Oi, ${lead.nome}. Passando para complementar: muitas empresas em ${lead.cidade} têm presença online mas sofrem com a falta de constância de clientes novos.\n\nO tráfego pago ajuda a gerar essa demanda previsível sem esforço manual diário.\n\nQuer que eu te mande um exemplo de abordagem para o nicho de vocês?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um exemplo prático para ${lead.nicho}: um anúncio local focado na principal dor do cliente, direcionando para o WhatsApp comercial.\n\nIsso evita perder dinheiro com cliques curiosos.\n\nQuer que eu te mostre como esse exemplo funcionaria?",
      day_4: "Oi, ${lead.nome}. Para deixar bem leve: não precisa de reunião longa agora.\n\nPosso te mandar uma simulação de como preparar o site e Instagram para anúncios sem vazamentos comerciais. Se fizer sentido, ótimo; senão, você descarta rápido.\n\nPosso enviar?",
      day_5: "Olá, ${lead.nome}. Talvez você pense que tráfego exige verba alta.\n\nNa verdade, o segredo para ${lead.nicho} é testar com pouco orçamento local e focar na qualidade de quem chama.\n\nQuer que eu te mande um exemplo para comparar com o que fazem hoje?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mandar uma simulação de campanha desenhada para o seu nicho, você consegue dar uma olhada em poucos minutos?\n\nSe não fizer sentido, tudo bem.\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos por aqui para não insistir demais.\n\nSe em outro momento quiser olhar essa frente de tráfego local em ${lead.cidade}, posso deixar uma ideia simples registrada.\n\nPosso enviar e ficamos em contato?"
    }
  },
  design: {
    label: "Design",
    commercial_goal: "Gerar conversa sobre percepção visual, marca, site e clareza da comunicação.",
    diagnosis_lens: "identidade visual, site, Instagram, clareza da oferta, confiança, aparência profissional, coerência visual",
    likely_pains: [
      "visual não transmite confiança",
      "site/perfil não deixa claro o diferencial",
      "marca parece pouco profissional",
      "comunicação visual não ajuda na conversão",
      "presença digital não acompanha a qualidade do serviço"
    ],
    approach_angles: [
      "melhorar percepção de valor",
      "transmitir mais confiança",
      "deixar a oferta mais clara",
      "transformar presença visual in conversão",
      "destacar diferencial"
    ],
    recommended_terms: ["percepção profissional", "clareza visual", "confiança", "identidade", "posicionamento", "site", "marca", "conversão visual"],
    avoid_terms: ["logo bonito", "arte bonitinha", "julgamento ofensivo da marca", "crítica pesada"],
    cta_examples: [
      "Posso te mandar uma observação simples sobre como melhorar a primeira impressão digital?",
      "Quer que eu te mostre um ponto visual que pode influenciar conversão?"
    ],
    likely_objections: [
      "Design não é nossa prioridade agora.",
      "Acho que nosso visual atual atende bem."
    ],
    objection_responses: [
      "Entendo, vendas são sempre prioridade. O ponto é que um visual amador afasta clientes premium antes mesmo de eles conversarem com você.",
      "Justo. A ideia é apenas destacar um ponto específico de design no site que pode estar diminuindo as conversas. Posso mandar?"
    ],
    cadence_strategy: {
      day_1: "Abertura sobre a primeira impressão digital e a percepção de valor visual.",
      day_2: "Retomar apontando a dor de perder contatos por falta de coerência visual.",
      day_3: "Enviar um exemplo prático de antes/depois ou ajuste visual no nicho.",
      day_4: "Explicar o impacto lógico de uma comunicação clara na conversão do site.",
      day_5: "Quebrar a objeção de que design é apenas estética secundária.",
      day_6: "Oferecer uma pequena análise de design da página atual sem compromisso.",
      day_7: "Despedida mantendo a porta aberta de forma amigável."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nOlhando a identidade digital de vocês, fiquei com a dúvida se ela transmite a real qualidade do trabalho de vocês de forma imediata online.\n\nPosso te mandar uma observação simples sobre como melhorar essa primeira impressão digital?",
      day_2: "Oi, ${lead.nome}. Para empresas de ${lead.nicho}, um visual inconsistente ou desatualizado no site/perfil pode fazer clientes de maior valor escolherem a concorrência por se sentirem mais confiantes lá.\n\nA clareza visual ajuda muito a justificar um preço melhor.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto prático: a coerência entre o que vocês publicam e a estrutura do site comercial.\n\nÀs vezes, uma pequena mudança na organização das informações visuais aumenta muito a conversão.\n\nQuer que eu te mostre esse ponto visual?",
      day_4: "Oi, ${lead.nome}. Sem complicação ou reuniões formais agora.\n\nQueria te mandar uma observação simples baseada no layout da página inicial de vocês. Se fizer sentido, ótimo; senão, fica de dica para sua equipe.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. Talvez pareça que design é preciosismo.\n\nMas o segredo comercial para ${lead.nicho} é a percepção de confiança. Se a página não parece profissional, a conversão cai pela metade.\n\nQuer que eu te mande um ponto que reparei?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mandar um ajuste simples de estrutura visual que vocês podem aplicar no site hoje, você daria uma olhada rápida?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos por aqui para não incomodar.\n\nSe em outro momento quiser revisar a percepção visual da sua marca em ${lead.cidade}, fico à disposição.\n\nPosso deixar meu contato registrado?"
    }
  },
  social: {
    label: "Social Media",
    commercial_goal: "Gerar conversa sobre conteúdo, presença digital e transformação de seguidores/visitas em conversas.",
    diagnosis_lens: "Instagram, frequência aparente, bio, chamada para contato, tipo de conteúdo, clareza do posicionamento, conversão via DM/WhatsApp",
    likely_pains: [
      "posta, mas não gera contato",
      "Instagram funciona como vitrine, não canal comercial",
      "conteúdo não direciona para conversa",
      "bio/CTA fracos",
      "falta estratégia para transformar atenção em lead"
    ],
    approach_angles: [
      "transformar perfil em canal de conversa",
      "conteúdo com objetivo comercial",
      "melhorar CTA da bio/conteúdo",
      "gerar mais DMs qualificadas",
      "presença digital mais intencional"
    ],
    recommended_terms: ["conteúdo com intenção", "DM", "conversa", "bio", "posicionamento", "presença digital", "calendário", "engajamento local"],
    avoid_terms: ["viralizar", "ganhar seguidores", "postar por postar", "prometer alcance"],
    cta_examples: [
      "Posso te mandar uma ideia simples para transformar o perfil em mais conversas?",
      "Quer que eu te mostre um ponto que pode melhorar a geração de DMs?"
    ],
    likely_objections: [
      "Não temos tempo para criar conteúdo ou gerenciar redes.",
      "Redes sociais não trazem clientes para o nosso segmento."
    ],
    objection_responses: [
      "Entendo perfeitamente, por isso a ideia não é ficar postando dancinhas, e sim criar um perfil estruturado como canal comercial direto.",
      "Faz sentido achar isso, mas o Instagram hoje funciona como o novo Google. O cliente entra lá para ver se a empresa está ativa e passa confiança. Posso te mostrar um exemplo?"
    ],
    cadence_strategy: {
      day_1: "Abertura focada no perfil do Instagram e no direcionamento de seguidores para o comercial.",
      day_2: "Abordar a dor de gastar tempo postando sem gerar conversas de fato.",
      day_3: "Enviar ideia rápida para ajustar a bio e CTA para atrair DMs comerciais.",
      day_4: "Explicar como organizar um calendário com intenção em ${lead.nicho}.",
      day_5: "Quebrar a objeção clássica de que rede social é perda de tempo no setor.",
      day_6: "Oferecer observação rápida de um ponto de melhoria no link de contato.",
      day_7: "Toque final de despedida com cordialidade."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade} e passei pelo perfil de vocês.\n\nHoje o perfil ajuda a gerar conversas de novos clientes de forma ativa ou funciona mais como uma vitrine estática?\n\nPosso te mandar uma ideia simples para transformar o perfil em mais conversas?",
      day_2: "Oi, ${lead.nome}. Para empresas de ${lead.nicho}, muitas vezes o segredo não é ter milhares de seguidores, mas sim fazer com que quem visite a página chame no WhatsApp comercial.\n\nA bio e os posts devem funcionar como um funil de entrada.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto rápido: o link e o CTA da bio de vocês.\n\nÀs vezes, a falta de uma chamada clara de contato faz com que o cliente curioso saia sem abrir conversa.\n\nQuer que eu te mande esse ponto?",
      day_4: "Oi, ${lead.nome}. Para não tomar seu tempo: não precisa de reunião agora.\n\nQueria te mandar uma observação sobre o posicionamento de conteúdo que notei no perfil de vocês. Se ajudar, excelente; senão, você ignora.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. É comum achar que Instagram não traz cliente.\n\nMas em ${lead.cidade}, o cliente local usa a rede para validar se a empresa é séria e confiável. O ganho está em dar essa segurança rápida.\n\nQuer que eu te mande um exemplo de bio estruturada para o seu nicho?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mostrar um ponto rápido no seu perfil que pode estar deixando potenciais DMs na mesa, você avalia?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus envios. Se em outro momento quiser estruturar o Instagram como canal de aquisição ativa em ${lead.cidade}, me avise.\n\nPosso deixar meu contato registrado?"
    }
  },
  full_service: {
    label: "Full Service",
    commercial_goal: "Gerar conversa sobre diagnóstico 360, tráfego, criativo, funil e presença digital integrada.",
    diagnosis_lens: "site, Instagram, Google, canal de contato, clareza da oferta, tráfego, design, funil, jornada do cliente",
    likely_pains: [
      "presença digital existe, mas está desconectada",
      "site, Instagram e WhatsApp não trabalham juntos",
      "campanha pode gerar atenção, mas não virar conversa",
      "falta visão integrada de marketing",
      "funil pouco claro"
    ],
    approach_angles: [
      "diagnóstico 360",
      "integrar tráfego, criativo e conversão",
      "transformar presença digital em funil",
      "alinhar site, Instagram e WhatsApp",
      "melhorar jornada comercial"
    ],
    recommended_terms: ["diagnóstico 360", "funil integrado", "tráfego", "criativo", "conversão", "jornada", "canais conectados", "presença digital integrada"],
    avoid_terms: ["fazemos tudo", "pacote completo genérico", "promessa exagerada"],
    cta_examples: [
      "Posso te mandar um diagnóstico rápido com 2 pontos de melhoria?",
      "Quer que eu te mostre onde pode ter perda entre presença digital e conversa comercial?"
    ],
    likely_objections: [
      "Já temos uma agência de marketing cuidando de tudo.",
      "Marketing completo é muito caro."
    ],
    objection_responses: [
      "Excelente, a ideia não é substituir a agência, mas sim trazer um diagnóstico complementar e independente para comparar resultados.",
      "Entendo, marketing integrado pode parecer caro quando não traz retorno. O foco aqui é otimizar o fluxo para que cada canal gere lucro direto. Quer ver como funciona?"
    ],
    cadence_strategy: {
      day_1: "Abertura com uma visão integrada 360 da jornada online até a conversão.",
      day_2: "Abordar a dor de ter os canais digitais (site, redes, anúncios) desconectados.",
      day_3: "Enviar um diagnóstico rápido da conexão entre site e canais de contato.",
      day_4: "Explicar a lógica de funil de vendas unificado para ${lead.nicho}.",
      day_5: "Contornar a objeção de já possuir parceiro ou agência ativa.",
      day_6: "Oferecer um checklist curto 360 para a equipe interna do lead.",
      day_7: "Finalização respeitosa com canal aberto para contatos futuros."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nOlhando de fora a estrutura de vocês, notei que têm bons ativos online, mas fiquei com a dúvida se eles estão integrados e convertendo na velocidade que poderiam.\n\nPosso te mandar um diagnóstico 360 rápido com 2 pontos de melhoria?",
      day_2: "Oi, ${lead.nome}. É muito comum ver empresas de ${lead.nicho} que investem em posts e site, mas sofrem com canais desconectados (ex: anúncio bom que cai em site sem WhatsApp fácil).\n\nQuando tudo trabalha integrado, a aquisição fica muito mais barata.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto prático de diagnóstico 360: o fluxo de conversão. Se o cliente chega pelo Instagram ou Google, ele encontra a mesma proposta no WhatsApp?\n\nEssa coerência de jornada dobra o aproveitamento de contatos.\n\nQuer que eu te mande um exemplo?",
      day_4: "Oi, ${lead.nome}. Sem complicação ou reuniões comerciais agora.\n\nQueria te mandar uma observação rápida sobre onde reparei que pode haver perda de oportunidades na transição dos canais de vocês.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. Se você já tem alguém cuidando do marketing, ótimo.\n\nA ideia deste diagnóstico é ser uma auditoria complementar simples para ajudar você a validar se a operação está no rumo correto.\n\nQuer que eu te mande o ponto principal?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mandar um resumo simples de 3 pontos para conectar melhor seu tráfego e design com o WhatsApp comercial, você daria uma olhada rápida?\n\nPosso enviar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos comerciais. Se em outro momento fizer sentido revisar a jornada integrada da empresa em ${lead.cidade}, estou por aqui.\n\nPosso deixar meu contato registrado?"
    }
  },
  prospeccao: {
    label: "Prospecção",
    commercial_goal: "Gerar conversa sobre geração ativa de oportunidades, listas, abordagem e follow-up.",
    diagnosis_lens: "tipo de empresa, se vende serviço ou B2B, potencial de prospecção ativa, canais de contato, região, nichos possíveis, capacidade de escalar abordagem",
    likely_pains: [
      "depende de indicação",
      "não tem rotina ativa de prospecção",
      "perde tempo montando lista manualmente",
      "aborda sem contexto",
      "não faz follow-up",
      "não sabe quem abordar"
    ],
    approach_angles: [
      "encontrar oportunidades melhores",
      "abordar com contexto",
      "montar rotina previsível",
      "transformar cidade/nicho em lista",
      "reduzir tempo manual"
    ],
    recommended_terms: ["oportunidades", "lista qualificada", "abordagem", "follow-up", "previsibilidade comercial", "prospecção ativa", "conversas comerciais"],
    avoid_terms: ["spam", "disparo em massa", "promessa de venda garantida"],
    cta_examples: [
      "Posso te mostrar um exemplo de lista e abordagem para o seu nicho?",
      "Faz sentido eu te mandar uma simulação de prospecção aplicada ao seu mercado?"
    ],
    likely_objections: [
      "Prospecção ativa não funciona no nosso mercado.",
      "Não gostamos de fazer spam ou contatos frios."
    ],
    objection_responses: [
      "Compreendo, se for feita sem critério parece spam. O segredo é abordar poucas empresas bem qualificadas e com um contexto real delas. Quer ver um exemplo?",
      "Justo. Por isso não trabalhamos com disparador em massa. A ideia é iniciar conversas consultivas e de alto nível com quem realmente tem fit. Posso te mostrar?"
    ],
    cadence_strategy: {
      day_1: "Abertura abordando a busca de novas oportunidades e o processo comercial ativo.",
      day_2: "Abordar a dor de depender apenas de indicações e a falta de rotina de prospecção.",
      day_3: "Enviar um exemplo de lista qualificada e ângulo de abordagem para ${lead.nicho}.",
      day_4: "Explicar como o follow-up estruturado evita perder oportunidades comerciais.",
      day_5: "Contornar a objeção clássica de que prospecção ativa é spam ou incômodo.",
      day_6: "Oferecer uma simulação de abordagem para um cliente ideal do lead.",
      day_7: "Despedida mantendo a porta aberta para discussões futuras."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atendam com ${lead.nicho}${lead.cidade}.\n\nHoje vocês já contam com uma rotina ativa e previsível para abrir novas conversas comerciais ou a captação ainda depende mais de indicação e busca manual?\n\nPosso te mostrar um exemplo de abordagem contextualizada para o seu nicho?",
      day_2: "Oi, ${lead.nome}. Muitas empresas de ${lead.nicho} têm um excelente serviço, mas passam meses sem crescer porque não têm um fluxo constante de abertura de novos contatos comerciais.\n\nA prospecção ativa estruturada resolve essa falta de previsibilidade comercial.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto prático: a montagem de uma lista qualificada na região de ${lead.cidade} e o uso de uma dor real do nicho para iniciar a conversa.\n\nIsso corta o tempo perdido com listas genéricas e abordagens frias.\n\nQuer que eu te mande um exemplo?",
      day_4: "Oi, ${lead.nome}. Sem complicação ou reuniões formais agora.\n\nQueria te mandar uma simulação de como preparar uma abordagem focada em um cliente ideal de vocês. Se fizer sentido, ótimo; senão, fica de ideia para seu comercial.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. Talvez pareça que prospectar é ser inconveniente.\n\nMas a verdade é que, quando abordamos com base em um achado real do cliente, ele percebe valor e agradece o contato consultivo.\n\nQuer que eu te mande um exemplo aplicado ao seu nicho?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mostrar um ponto prático sobre como encontrar e abrir conversas com potenciais parceiros locais sem parecer chato, você daria uma olhada rápida?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos comerciais. Se em outro momento quiser estruturar uma rotina previsível de prospecção comercial ativa em ${lead.cidade}, estou por aqui.\n\nPosso deixar meu contato registrado?"
    }
  },
  gestao_interna: {
    label: "Gestão Interna",
    commercial_goal: "Gerar conversa sobre organização, processos, atendimento e eficiência operacional.",
    diagnosis_lens: "tipo de operação, volume provável de atendimento, canais de contato, necessidade de organização, processos manuais, controle de leads/clientes, rotina comercial ou administrativa",
    likely_pains: [
      "atendimento desorganizado",
      "perda de informação",
      "falta de controle de status",
      "demora para responder",
      "processos manuais",
      "dificuldade em acompanhar oportunidades"
    ],
    approach_angles: [
      "organização do atendimento",
      "controle de processo",
      "produtividade",
      "reduzir retrabalho",
      "melhorar acompanhamento",
      "centralizar informações"
    ],
    recommended_terms: ["processo", "organização", "atendimento", "controle", "rotina", "produtividade", "acompanhamento", "status"],
    avoid_terms: ["bagunçado", "desorganizado de forma ofensiva", "crítica direta pesada"],
    cta_examples: [
      "Posso te mostrar uma ideia simples para organizar melhor esse fluxo?",
      "Faz sentido eu te mandar um exemplo de controle mais prático para esse tipo de operação?"
    ],
    likely_objections: [
      "Já temos nossa própria forma de gerenciar e funciona bem.",
      "Mudar processos agora vai dar muito trabalho para a equipe."
    ],
    objection_responses: [
      "Compreendo, rotinas consolidadas são preciosas. A ideia é apenas apresentar um pequeno ajuste que reduz cliques e erros manuais, sem mudar tudo de uma vez.",
      "Justo. Por isso começamos com melhorias atômicas que resolvem tarefas chatas primeiro, ganhando a aprovação do time no primeiro dia. Quer ver um exemplo?"
    ],
    cadence_strategy: {
      day_1: "Abertura sobre a organização do atendimento e fluxo de contatos.",
      day_2: "Abordar a dor do tempo gasto com tarefas manuais repetitivas e controle de leads.",
      day_3: "Enviar um ponto prático de organização de status de leads ou etapas comerciais.",
      day_4: "Explicar como o acompanhamento rápido de oportunidades evita desperdício comercial.",
      day_5: "Quebrar a objeção clássica de que mudar processos dá muito trabalho.",
      day_6: "Oferecer uma simulação de fluxo centralizado para controle de contatos.",
      day_7: "Despedida cordial mantendo porta aberta para melhorias futuras."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nHoje como funciona a recepção de novas oportunidades comerciais e administrativas de vocês: o time gerencia tudo centralizado ou as informações ficam muito espalhadas nos contatos individuais?\n\nPosso te mostrar uma ideia simples para organizar melhor esse fluxo de atendimento?",
      day_2: "Oi, ${lead.nome}. Para operações comerciais em ${lead.nicho}, o maior gargalo costuma ser o tempo perdido buscando informações de clientes antigos ou fazendo acompanhamentos manuais.\n\nCentralizar e padronizar o processo salva horas de trabalho por semana.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto prático: a categorização rápida das conversas que chegam para saber exatamente quem precisa de retorno imediato e quem está em negociação.\n\nIsso evita que contatos quentes esfriem.\n\nQuer que eu te envie um exemplo?",
      day_4: "Oi, ${lead.nome}. Sem complicação ou reuniões demoradas agora.\n\nQueria te mandar uma ideia simples de controle de status que criamos para o seu mercado. Se fizer sentido para o time, ótimo; senão, você descarta.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. Entendo que mexer em processo dá receio de bagunçar a operação.\n\nA ideia aqui é implantar pequenas melhorias que ajudam os vendedores a venderem mais, sem burocracia desnecessária.\n\nQuer que eu te mostre como fazer isso?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mandar um modelo de rotina de controle comercial desenhado para o seu segmento, você conseguiria dar uma olhada em poucos minutos?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos. Se em outro momento quiser revisar a organização e processos da sua rotina comercial em ${lead.cidade}, estou à disposição.\n\nPosso deixar meu contato registrado?"
    }
  },
  zuno_internal_prospecting: {
    label: "Prospecção para a Zuno",
    commercial_goal: "Gerar conversa para apresentar uma solução de prospecção B2B com IA.",
    diagnosis_lens: "se a empresa precisa prospectar, se vende serviço, se depende de novos clientes, se pode se beneficiar de listas por cidade/nicho, se precisa de abordagem contextualizada, se tem perfil para Free, Pro ou Agência",
    likely_pains: [
      "depende de indicação",
      "perde tempo buscando clientes manualmente",
      "não sabe quem abordar",
      "não sabe o que falar",
      "não tem rotina comercial previsível",
      "precisa gerar conversas com possíveis clientes"
    ],
    approach_angles: [
      "prospecção com IA",
      "encontrar empresas por cidade e nicho",
      "abordagem pronta com contexto",
      "economizar tempo",
      "gerar novas conversas",
      "organizar oportunidades"
    ],
    recommended_terms: ["prospecção com IA", "empresas por cidade e nicho", "abordagem contextualizada", "oportunidades", "conversas comerciais", "economia de tempo", "rotina de prospecção"],
    avoid_terms: [
      "encontrei você usando a Zuno",
      "achei você pela Zuno",
      "a Zuno encontrou você",
      "usei a Zuno para encontrar sua empresa",
      "revelar método de busca",
      "zuno_internal_prospecting"
    ],
    cta_examples: [
      "Posso te mostrar um exemplo prático aplicado ao seu nicho?",
      "Faz sentido eu te mostrar como isso funcionaria para sua rotina comercial?"
    ],
    likely_objections: [
      "Quem é você e como conseguiu meu contato?",
      "Não temos tempo para usar outra ferramenta agora."
    ],
    objection_responses: [
      "Compreendo, peguei o contato pelos canais públicos da empresa. Vi alguns sinais da presença digital de vocês e achei que valia te mandar uma observação curta, sem compromisso.",
      "Justo. A ideia é justamente economizar tempo: a IA monta as listas e copies de abordagem comercial em segundos para você só precisar abrir a conversa."
    ],
    cadence_strategy: {
      day_1: "Abertura contextualizada sobre geração ativa de oportunidades comerciais.",
      day_2: "Abordar a dor de gastar tempo buscando leads manualmente na internet.",
      day_3: "Enviar um exemplo prático de copy contextual de prospecção para ${lead.nicho}.",
      day_4: "Explicar como o follow-up ajuda a não perder leads de vista.",
      day_5: "Contornar a objeção clássica de falta de tempo para testar ferramentas.",
      day_6: "Oferecer simulação curta de lista qualificada na região sem compromisso.",
      day_7: "Último toque de encerramento deixando canais de contato abertos."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade} e fiquei com uma dúvida rápida.\n\nHoje a entrada de novas conversas comerciais acontece de forma previsível ou ainda depende muito de indicação e tentativa manual?\n\nPosso te mandar 1 observação objetiva sobre isso?",
      day_2: "Oi, ${lead.nome}. Passei pelo perfil de vocês e me chamou atenção que a empresa já passa uma boa presença inicial.\n\nFiquei com a dúvida se isso hoje está virando conversa comercial com frequência ou se o perfil funciona mais como vitrine.\n\nSe fizer sentido, te mando o ponto que observei.",
      day_3: "Tudo bem, ${lead.nome}? Só complementando a mensagem anterior.\n\nO que mais me chamou atenção foi a chance de existir demanda, mas sem uma rotina clara para aproveitar melhor essas oportunidades.\n\nEm ${lead.nicho}, isso costuma aparecer quando a empresa até gera interesse, mas não transforma isso em conversa com consistência.",
      day_4: "Olá, ${lead.nome}.\n\nOlhando os sinais públicos da empresa${lead.cidade}, vi uma oportunidade simples: ganhar mais previsibilidade na entrada de novas conversas comerciais.\n\nA empresa já passa sinais de presença digital e canal aberto, o que sugere base para melhorar abordagem e conversão.\n\nSe fizer sentido, posso te responder esta mensagem com uma observação objetiva sobre onde eu olharia primeiro.",
      day_5: "Olá, ${lead.nome}, uma pergunta direta:\n\nHoje vocês sabem de onde costumam vir as melhores conversas comerciais ou isso ainda fica meio espalhado entre indicação, Instagram, WhatsApp e outros canais?\n\nPergunto porque, quando existe base digital, o maior ganho costuma estar em priorizar melhor o que realmente vira oportunidade.",
      day_6: "Passando rapidinho, ${lead.nome}.\n\nA ideia aqui não é te mandar pitch pronto, e sim uma leitura curta sobre onde a empresa pode estar deixando conversa na mesa.\n\nSe fizer sentido, te mando o ponto principal e você vê se vale aprofundar.",
      day_7: "Olá, ${lead.nome}, última mensagem sobre isso.\n\nSó te chamei porque vi sinais de que vocês já têm uma base que pode render conversas melhores com um pouco mais de clareza e rotina comercial.\n\nSe não for prioridade agora, tudo certo. Fico por aqui para não insistir."
    }
  },
  crm: {
    label: "CRM",
    commercial_goal: "Gerar conversa sobre controle comercial, gerenciamento de funil de vendas e acompanhamento de leads.",
    diagnosis_lens: "gerenciamento de leads, processo de follow-up, controle comercial, dados do histórico de atendimento",
    likely_pains: [
      "esquece de fazer follow-up",
      "leads espalhados no WhatsApp dos vendedores",
      "falta de histórico comercial",
      "não sabe em qual etapa a venda travou"
    ],
    approach_angles: [
      "organização de pipeline",
      "acompanhamento de leads sem esquecimento",
      "histórico comercial centralizado",
      "previsibilidade de fechamento"
    ],
    recommended_terms: ["CRM", "funil de vendas", "pipeline", "follow-up comercial", "histórico de vendas", "gerenciamento de leads"],
    avoid_terms: ["bagunçado", "desorganizado de forma ofensiva", "perda de dinheiro de forma agressiva"],
    cta_examples: [
      "Quer ver uma forma de evitar que leads interessados fiquem sem retorno?",
      "Posso te mandar um exemplo de funil comercial aplicado ao seu nicho?"
    ],
    likely_objections: [
      "Nosso time usa apenas planilha e atende bem.",
      "Ferramenta de CRM é muito complexa para nós."
    ],
    objection_responses: [
      "Entendo perfeitamente, planilhas funcionam bem no início. O ganho do CRM é o alerta automático de follow-up para que o vendedor não esqueça nenhum contato quente. Quer ver?",
      "Justo. Por isso montamos um pipeline visual simples com apenas 3 etapas: Novo, Em Contato e Negociando. Dá para dominar em 10 minutos. Quer dar uma olhada?"
    ],
    cadence_strategy: {
      day_1: "Abertura focada no controle de contatos comerciais e no funil de vendas.",
      day_2: "Abordar a dor de leads quentes que esfriam por falta de follow-up sistemático.",
      day_3: "Enviar um ponto prático de categorização de clientes em negociação.",
      day_4: "Explicar como um histórico de interações ajuda a fechar mais vendas de ${lead.nicho}.",
      day_5: "Desmistificar a complexidade de usar um CRM.",
      day_6: "Oferecer visualização de um pipeline comercial simples para o nicho.",
      day_7: "Despedida com porta aberta para futuras trocas de ideias."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nHoje como vocês fazem o acompanhamento dos leads que entram em contato comercial: os vendedores controlam tudo no próprio celular ou vocês já usam algum CRM integrado para ter controle de quem comprou e quem ficou pendente?\n\nPosso te mostrar um exemplo de funil comercial aplicado ao seu nicho?",
      day_2: "Oi, ${lead.nome}. Para empresas de ${lead.nicho}, um dos maiores ralos de faturamento é a falta de follow-up em tempo real. Muitas vezes o cliente chama, mas o vendedor demora a responder e ele compra com o concorrente que foi mais rápido.\n\nOrganizar esse fluxo comercial evita essa perda de leads quentes.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto rápido: o histórico do cliente. Se um vendedor falta ou sai da empresa, as negociações dele ficam registradas ou são perdidas?\n\nTer um banco de dados centralizado dá segurança para a operação crescer.\n\nQuer que eu te mande esse exemplo?",
      day_4: "Oi, ${lead.nome}. Sem complicação agora: não precisa de reunião.\n\nQueria te mandar uma observação rápida sobre como estruturar etapas simples de vendas no seu WhatsApp comercial. Se fizer sentido, ótimo.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. É comum achar que CRM é complicado ou caro.\n\nMas a verdade é que as melhores operações usam apenas o básico: saber quem é o lead, o que ele quer e quando ligar de volta. O ganho está na disciplina do processo.\n\nQuer ver como fazemos isso de forma prática?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mostrar um modelo visual de funil comercial desenhado para o seu mercado, você avalia?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos. Se em outro momento quiser revisar a organização e o pipeline comercial da empresa em ${lead.cidade}, fico à disposição.\n\nPosso deixar meu contato registrado?"
    }
  },
  automacao: {
    label: "Automação",
    commercial_goal: "Gerar conversa sobre fluxos automatizados de atendimento, respostas rápidas e nutrição de contatos.",
    diagnosis_lens: "tempo de resposta comercial, uso de robôs ou fluxos automáticos, integração de canais de contato, automação de e-mails/WhatsApp",
    likely_pains: [
      "demora para responder contatos",
      "perda de leads fora do horário comercial",
      "retornos manuais repetitivos",
      "falta de padrão nas respostas comerciais"
    ],
    approach_angles: [
      "atendimento imediato de leads",
      "automação de respostas recorrentes",
      "qualificação automática de contatos",
      "nutrição de leads 24 horas"
    ],
    recommended_terms: ["automação comercial", "resposta instantânea", "fluxo de atendimento", "qualificação automática", "nutrição de contatos", "agilidade comercial"],
    avoid_terms: ["robô de spam", "disparador automático", "promessa de automação que substitui 100% os humanos"],
    cta_examples: [
      "Posso te mostrar um fluxo simples de qualificação automática de leads?",
      "Faz sentido eu te mandar um exemplo de resposta rápida para fora do horário comercial?"
    ],
    likely_objections: [
      "Nossos clientes não gostam de falar com robôs.",
      "Já temos mensagens prontas cadastradas no celular."
    ],
    objection_responses: [
      "Entendo, o robô frio realmente afasta o cliente. A ideia é usar a automação apenas para a primeira recepção imediata e qualificar o contato antes de passar para o atendimento humano.",
      "Justo. A diferença está em integrar esse fluxo com seu site e CRM, para que o lead seja cadastrado de forma automática e receba alertas sem depender de digitação manual. Quer ver como funciona?"
    ],
    cadence_strategy: {
      day_1: "Abertura focada no tempo de resposta comercial a novos leads digitais.",
      day_2: "Abordar a dor de perder contatos interessados por demora no retorno.",
      day_3: "Enviar exemplo prático de um fluxo de recepção automática de contatos.",
      day_4: "Explicar a lógica de qualificação automatizada de leads de ${lead.nicho}.",
      day_5: "Contornar o receio de que o cliente rejeita o atendimento automatizado.",
      day_6: "Oferecer simulação de resposta rápida para contatos fora do expediente.",
      day_7: "Despedida mantendo canal de comunicação aberto de forma cortês."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nHoje quando um lead chega pelo site ou Instagram de vocês fora do horário comercial, ele recebe um atendimento automático imediato ou precisa esperar até o próximo dia útil?\n\nPosso te mostrar uma ideia simples para automatizar essa primeira resposta sem perder a humanização?",
      day_2: "Oi, ${lead.nome}. No mercado de ${lead.nicho}, o lead esfria muito rápido. Se ele manda mensagem e demora 15 minutos para ser respondido, as chances de fechar caem 80%.\n\nA automação comercial garante que 100% dos leads sejam recebidos no mesmo segundo.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto prático: a triagem de contatos. A automação faz perguntas simples (ex: qual serviço busca?) e encaminha o lead pronto para o vendedor certo.\n\nIsso poupa tempo operacional precioso.\n\nQuer que eu te envie um fluxo desse?",
      day_4: "Oi, ${lead.nome}. Sem tomar muito tempo: não precisa de reunião.\n\nQueria te mandar um modelo de fluxo de triagem desenhado para empresas do seu nicho. Se achar viável, excelente.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. Muitos acham que automação deixa o atendimento frio.\n\nMas o segredo está em usar textos naturais e avisar o cliente que o atendimento humano já vai continuar. O cliente prefere um retorno rápido natural do que o silêncio comercial.\n\nQuer ver um exemplo de copy desse fluxo?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mandar uma simulação de automação de recepção integrada ao seu WhatsApp, você avalia?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos comerciais. Se em outro momento quiser revisar a velocidade de atendimento do seu comercial em ${lead.cidade}, estou por aqui.\n\nPosso deixar meu contato registrado?"
    }
  },
  seo: {
    label: "SEO",
    commercial_goal: "Gerar conversa sobre tráfego orgânico, posicionamento no Google e atração passiva de clientes.",
    diagnosis_lens: "posicionamento no Google, presença no Google Meu Negócio, otimização de site, palavras-chave locais",
    likely_pains: [
      "depende de anúncios caros para ter visitas",
      "não aparece na primeira página de buscas",
      "concorrentes locais atraem toda a demanda do Google",
      "site existe mas não recebe visitas orgânicas"
    ],
    approach_angles: [
      "atrair clientes qualificados sem pagar por clique",
      "vencer concorrência local nas buscas do Google",
      "tráfego orgânico de longo prazo",
      "posicionamento de autoridade local"
    ],
    recommended_terms: ["busca orgânica", "Google Meu Negócio", "otimização de buscas", "tráfego gratuito", "palavras-chave", "posicionamento local"],
    avoid_terms: ["primeiro lugar no Google garantido", "fórmula mágica do SEO", "promessa de resultado em 24 horas"],
    cta_examples: [
      "Posso te mostrar como está o posicionamento da sua empresa em comparação com os concorrentes?",
      "Quer ver as palavras-chave mais buscadas para o seu nicho na região?"
    ],
    likely_objections: [
      "SEO demora muito tempo para trazer resultados.",
      "Já aparecemos bem quando buscam pelo nosso nome."
    ],
    objection_responses: [
      "Compreendo, SEO é um investimento de médio prazo. Mas a vantagem é o efeito composto: depois que posiciona, você atrai clientes de graça por meses sem precisar pagar anúncios diariamente.",
      "Justo, aparecer pelo nome é ótimo para quem já te conhece. O ganho real está em aparecer para termos amplos (ex: ${lead.nicho}${lead.cidade}) para quem ainda não conhece a empresa. Posso te mostrar essas buscas?"
    ],
    cadence_strategy: {
      day_1: "Abertura sobre a visibilidade da empresa nas pesquisas locais do Google.",
      day_2: "Abordar a dor de pagar caro por anúncios enquanto os concorrentes atraem tráfego grátis.",
      day_3: "Enviar análise simples do posicionamento da ficha do Google Meu Negócio.",
      day_4: "Explicar o volume de buscas mensais para o nicho na cidade de ${lead.cidade}.",
      day_5: "Quebrar o receio sobre o tempo de retorno do trabalho de SEO.",
      day_6: "Oferecer 2 sugestões de palavras-chave fáceis de ranquear no site atual.",
      day_7: "Toque respeitoso de despedida mantendo canal aberto."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nHoje quando alguém pesquisa por ${lead.nicho} na região de vocês, a empresa aparece nas primeiras posições orgânicas do Google Meu Negócio ou a concorrência acaba atraindo a maioria dessas ligações gratuitas?\n\nPosso te mostrar um diagnóstico rápido de posicionamento local?",
      day_2: "Oi, ${lead.nome}. Anúncios são excelentes, mas quando você desliga, os leads param. SEO cria uma entrada consistente de contatos locais de graça no longo prazo.\n\nVale a pena comparar o custo dos cliques pagos com a audiência orgânica.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto rápido de SEO local: o preenchimento de palavras-chave na ficha do Google Meu Negócio de vocês.\n\nÀs vezes, pequenos ajustes no título ou avaliações sobem a empresa em 5 posições no mapa de buscas.\n\nQuer que eu te mostre?",
      day_4: "Oi, ${lead.nome}. Sem complicação ou reuniões formais agora.\n\nQueria te mandar as 3 principais buscas de clientes locais no seu nicho que poderiam estar caindo no seu site. Se te interessar, ótimo.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. É verdade que SEO leva semanas para maturar.\n\nMas o ganho comercial para ${lead.nicho} é duradouro. Um site posicionado vira um vendedor ativo trabalhando 24 horas por dia de graça.\n\nQuer ver como estruturamos isso?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mostrar um ponto técnico simples que está impedindo seu site de subir nas buscas orgânicas hoje, você avalia?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos. Se em outro momento quiser aumentar as visitas orgânicas e gratuitas da empresa em ${lead.cidade}, estou à disposição.\n\nPosso deixar meu contato registrado?"
    }
  },
  sites_landing: {
    label: "Sites/Landing Pages",
    commercial_goal: "Gerar conversa sobre criação de landing pages, otimização de conversão e clareza da proposta de valor.",
    diagnosis_lens: "velocidade do site, clareza da oferta principal, visibilidade do botão de WhatsApp, design responsivo, formulários simples",
    likely_pains: [
      "site lento ou confuso",
      "muito acesso na página mas poucas chamadas no WhatsApp",
      "página não funciona bem no celular",
      "falta clareza de proposta de valor imediata"
    ],
    approach_angles: [
      "transformar visitantes de anúncios em contatos reais",
      "clareza de oferta em menos de 5 segundos",
      "página rápida e focada em conversão local",
      "landing page de alta performance"
    ],
    recommended_terms: ["conversão de página", "landing page", "proposta de valor", "design focado em vendas", "velocidade do site", "celular responsivo"],
    avoid_terms: ["site institucional completo de 10 páginas", "desenvolvimento complexo que demora meses", "crítica destrutiva ao site atual"],
    cta_examples: [
      "Posso te mandar uma observação sobre o ponto de maior fuga de visitantes no seu site?",
      "Quer ver um modelo de landing page focado em vendas para o seu nicho?"
    ],
    likely_objections: [
      "Já temos um site institucional no ar há anos.",
      "Refazer site é muito caro e demorado."
    ],
    objection_responses: [
      "Entendo perfeitamente, o site institucional é importante para credibilidade geral. A ideia é criar uma Landing Page separada de página única, focada especificamente em conversão rápida para anúncios. Quer ver a diferença?",
      "Compreendo o receio. Por isso não sugerimos um projeto de meses. Criamos landing pages otimizadas de alta performance em poucos dias, focando diretamente no WhatsApp comercial. Posso te mostrar?"
    ],
    cadence_strategy: {
      day_1: "Abertura sobre a performance de conversão e o tempo de carregamento da página.",
      day_2: "Abordar a dor de investir em anúncios e perder visitantes por um site confuso.",
      day_3: "Enviar um diagnóstico rápido do carregamento móvel do site atual.",
      day_4: "Explicar como a clareza da oferta em 5 segundos impacta a conversão em ${lead.nicho}.",
      day_5: "Contornar o receio de custos e prazos altos para refazer sites.",
      day_6: "Oferecer exemplo de estrutura de landing page de alta performance.",
      day_7: "Despedida mantendo canal de comunicação aberto de forma cortês."
    },
    fallback_messages: {
      day_1: "Olá, ${lead.nome}, tudo bem?\n\nVi que vocês atuam com ${lead.nicho}${lead.cidade}.\n\nOlhando o site de vocês, fiquei com a dúvida se hoje a maioria das pessoas que visitam a página chama no WhatsApp comercial ou se existe uma perda invisível de contatos porque a página demora a carregar ou é muito institucional?\n\nPosso te mandar uma observação simples sobre a conversão do site?",
      day_2: "Oi, ${lead.nome}. Para empresas de ${lead.nicho}, o site deve ter um único objetivo: fazer o visitante clicar no WhatsApp comercial. Páginas com excesso de botões ou textos longos acabam confundindo o cliente e diminuindo o lucro.\n\nA simplicidade e foco geram muito mais vendas.\n\nQuer ver um exemplo?",
      day_3: "Tudo bem, ${lead.nome}? Pensei em um ponto prático: o carregamento no celular. Mais de 85% dos contatos chegam por dispositivos móveis.\n\nSe o botão de contato do celular de vocês exige rolar muito a página, muitos clientes desistem no caminho.\n\nQuer que eu te mande essa observação?",
      day_4: "Oi, ${lead.nome}. Para não tomar seu tempo: não precisa de reunião.\n\nQueria te mandar uma sugestão de cabeçalho de alta conversão para o seu nicho. Se te for útil, ótimo.\n\nPosso enviar por aqui?",
      day_5: "Olá, ${lead.nome}. É comum associar novos sites a projetos demorados.\n\nMas o segredo está em focar em uma Landing Page direta de alta velocidade de uma única página. Ela converte anúncios até 3 vezes mais do que portais tradicionais.\n\nQuer ver como criamos essa estrutura?",
      day_6: "Oi, ${lead.nome}, sem compromisso. Se eu te mostrar um ponto rápido no layout da sua página que pode estar gerando fuga de contatos, você daria uma olhada em poucos minutos?\n\nPosso mandar?",
      day_7: "Olá, ${lead.nome}. Vou encerrar meus contatos. Se em outro momento quiser aumentar a performance de conversão digital em ${lead.cidade}, fico à disposição.\n\nPosso deixar meu contato registrado?"
    }
  }
};

export function normalizeDisclosureText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getSafeFocusLabel(foco?: string | null): string {
  if (!foco || foco === ZUNO_INTERNAL_PROSPECTING_FOCUS) {
    return ZUNO_COMMERCIAL_FOCUS_LABEL;
  }
  return foco;
}

export function getFocusBehavior(foco?: string | null): FocusBehavior {
  const f = normalizeDisclosureText(foco || "").replace(/[\s\/-]+/g, "_");
  if (f.includes("trafego") || f.includes("traf")) return FOCUS_BEHAVIOR_MAP.trafego;
  if (f.includes("design")) return FOCUS_BEHAVIOR_MAP.design;
  if (f.includes("social")) return FOCUS_BEHAVIOR_MAP.social;
  if (f.includes("zuno") || f.includes("prospeccao_para_a_zuno")) return FOCUS_BEHAVIOR_MAP.zuno_internal_prospecting;
  if (f.includes("prospeccao")) return FOCUS_BEHAVIOR_MAP.prospeccao;
  if (f.includes("crm")) return FOCUS_BEHAVIOR_MAP.crm;
  if (f.includes("gestao") || f.includes("interna")) return FOCUS_BEHAVIOR_MAP.gestao_interna;
  if (f.includes("automacao")) return FOCUS_BEHAVIOR_MAP.automacao;
  if (f.includes("seo")) return FOCUS_BEHAVIOR_MAP.seo;
  if (f.includes("site") || f.includes("landing")) return FOCUS_BEHAVIOR_MAP.sites_landing;
  return FOCUS_BEHAVIOR_MAP.full_service;
}

export function replacePlaceholders(text: string, lead: any): string {
  const cityContext = lead.cidade && lead.cidade !== "Não informada" && lead.cidade !== "Não informado" && lead.cidade !== "NÃ£o informada" && lead.cidade !== "NÃ£o informado" ? ` em ${lead.cidade}` : "";
  return text
    .replace(/\$\{lead\.nome\}/g, lead.nome || "a empresa")
    .replace(/\$\{lead\.nicho\}/g, lead.nicho || "o segmento")
    .replace(/\$\{lead\.cidade\}/g, cityContext)
    .replace(/\$\{lead\.foco\}/g, getSafeFocusLabel(lead.foco) || "essa frente");
}
