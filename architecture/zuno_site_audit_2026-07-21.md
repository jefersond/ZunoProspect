# Auditoria do site público da Zuno

Data: 21 de julho de 2026
URL: https://www.zunopropect.com.br/

## Resumo executivo

A proposta de valor está clara e a identidade visual é consistente, mas o site ainda não está pronto para receber tráfego pago. Há um erro visível no mobile, lacunas jurídicas e de consentimento, sinais de prova social não verificável e fricção desnecessária escondendo o plano gratuito sem cartão.

Prioridade recomendada: corrigir confiança e conversão orgânica primeiro. Mídia paga permanece em R$ 0.

## O que já funciona

- Headline explica problema, público e resultado esperado.
- A demonstração visual deixa cidade, nicho, análise e abordagem fáceis de entender.
- Planos e preços estão visíveis: Starter R$ 47, Pro R$ 97 e Agency R$ 247 após o teste.
- O FAQ admite corretamente que a Zuno não garante clientes.
- O visual escuro, verde e tecnológico é coerente em toda a página.
- Há CTAs repetidos ao longo da jornada e uma explicação razoável do fluxo do produto.

## P0 — corrigir antes de divulgar

### 1. Hero cortado no celular

No viewport de 390 px, a área útil do documento ficou em 375 px. O grid possui 343 px, mas os dois filhos do hero mediram aproximadamente 399 px e terminaram em 415 px. A regra overflow-x-hidden esconde o excesso, cortando headline, parágrafo e mockup à direita.

Causa mais provável no código: conteúdo com largura mínima dentro do item do grid, especialmente o selo longo no topo. Aplicar min-w-0 aos filhos do grid e permitir quebra no selo com max-w-full e whitespace-normal. Depois testar 320, 360, 375, 390 e 430 px.

### 2. Atividade “ao vivo” é simulada no código

O hero alterna automaticamente cinco atividades fixas como “Curitiba ativou o teste há 2 min” e “São Paulo encontrou 47 leads agora”. Se não vierem de eventos reais, o visitante interpreta uma simulação como prova social ao vivo.

Ação: remover, substituir por uma demonstração explicitamente rotulada ou alimentar o bloco com eventos reais anonimizados e autorizados.

### 3. Estatísticas e depoimentos precisam de comprovação

O site exibe +80 profissionais ativos, +3.000 leads encontrados, menos de 5 minutos e 4.9 estrelas, além de nomes, fotos e resultados em depoimentos. Guardar fonte, período, método e autorização de cada afirmação. Sem documentação, remover ou trocar por evidência demonstrável do produto.

### 4. Rodapé sem páginas jurídicas

O rodapé mostra apenas a marca e o ano de 2024. Não há links para Privacidade, Termos, Cookies, Contato ou tratamento de dados. Isso reduz confiança e aumenta risco, especialmente porque a plataforma trabalha com contatos de empresas e usa rastreamento.

Ação: publicar documentos adequados à operação atual em CPF, sem inventar CNPJ, e atualizar o ano automaticamente.

### 5. Meta Pixel carrega antes de consentimento

O Pixel da Meta é inicializado diretamente no index.html, antes de qualquer escolha do visitante. Implementar banner e gestão de consentimento e só carregar rastreamento não essencial após a decisão aplicável.

## P1 — aumentar conversão orgânica

### 1. Dar destaque ao plano Free sem cartão

O FAQ informa que existe plano Free com 20 leads e 3 análises por mês, mas o hero promove apenas o teste de sete dias com cartão. Para aquisição orgânica e primeira receita, o CTA principal de menor atrito pode ser “Começar grátis sem cartão”; o teste dos planos pagos continua como alternativa para quem quer mais volume.

### 2. Reduzir repetição e aproximar a prova do CTA

A página é longa e repete várias vezes a mesma promessa. Enxugar seções semelhantes e colocar uma demonstração verificável, exemplo real ou vídeo curto antes do primeiro pedido de cartão.

### 3. Ajustar afirmações absolutas

Revisar frases como “Nenhuma lista desatualizada”, “WhatsApp ativo”, “Instagram reais”, “qualquer cidade do Brasil”, “empresas reais” e “lista de 30 leads em cerca de 5 minutos”. Usar condicionais compatíveis com disponibilidade e cobertura real dos provedores.

### 4. Explicar melhor o que acontece após o clique

O CTA diz “Começar teste grátis”, mas o usuário só descobre o cartão e a cobrança em textos menores. Manter a transparência junto ao botão e mostrar claramente: cadastro, escolha do plano, cartão, sete dias, data e valor da primeira cobrança e cancelamento.

## P1 — SEO e compartilhamento

- Alterar o idioma do HTML de en para pt-BR.
- Adicionar URL canônica absoluta.
- Usar URLs absolutas para as imagens Open Graph e Twitter.
- Adicionar dados estruturados adequados: SoftwareApplication ou Product; FAQPage somente quando o conteúdo visível corresponder.
- Confirmar robots.txt e sitemap.xml no deploy.
- Criar títulos e descrições específicos para páginas jurídicas, preços, autenticação e conteúdos futuros.

## Sequência recomendada

1. Corrigir overflow mobile e testar os principais breakpoints.
2. Remover ou rotular a atividade simulada e auditar todas as provas.
3. Publicar Privacidade, Termos, Cookies e Contato; implementar consentimento.
4. Tornar o plano Free sem cartão o caminho orgânico de entrada.
5. Corrigir idioma, canonical, imagens sociais e dados estruturados.
6. Medir cadastro iniciado, cadastro concluído, primeira busca, primeiro lead salvo e upgrade.
7. Só depois avaliar teste pequeno de mídia paga, se o administrador decidir liberar verba.
