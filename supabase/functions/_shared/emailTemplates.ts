const SITE_URL = "https://zunopropect.com.br";
const BRAND_NAME = "Zuno Propect";
const BRAND_EMAIL = "contato@zunopropect.com.br";
const FOUNDER_CAMPAIGN_SUBJECT = "Onde o Zuno Propect errou (e o seu acesso VIP)";
const FOUNDER_CAMPAIGN_PREHEADER = "Separei uma condi\u00e7\u00e3o especial para quem testou o Zuno antes.";

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createPreheader(text: string) {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">
      ${escapeHtml(text)}
    </div>
  `;
}

function createInfoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;line-height:18px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">
          ${escapeHtml(label)}
        </div>
        <div style="margin-top:4px;font-size:15px;line-height:22px;color:#111827;font-weight:600;word-break:break-word;">
          ${escapeHtml(value)}
        </div>
      </td>
    </tr>
  `;
}

function createButton(label: string, url: string) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="#10b981" style="border-radius:10px;box-shadow:0 10px 22px rgba(16,185,129,0.24);">
          <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function createZunoEmailLayout(params: {
  preheader: string;
  eyebrow?: string;
  title: string;
  body: string;
  content: string;
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
}) {
  const cta = params.ctaLabel && params.ctaUrl ? createButton(params.ctaLabel, params.ctaUrl) : "";
  const note = params.note
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;">
        <tr>
          <td style="padding:14px 16px;border-radius:12px;background:#ecfdf5;border:1px solid #bbf7d0;color:#065f46;font-size:14px;line-height:21px;">
            ${escapeHtml(params.note)}
          </td>
        </tr>
      </table>
    `
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    ${createPreheader(params.preheader)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fa;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
            <tr>
              <td style="height:5px;background:#10b981;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:30px 32px 22px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;border-radius:12px;background:#064e3b;color:#ffffff;font-size:18px;font-weight:800;">
                            Z
                          </td>
                          <td style="padding-left:12px;">
                            <div style="font-size:19px;line-height:24px;color:#111827;font-weight:800;">
                              ${BRAND_NAME}
                            </div>
                            <div style="font-size:13px;line-height:18px;color:#6b7280;">
                              Sistema profissional de geracao de leads
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:18px;background:#f8fafc;border:1px solid #e5e7eb;">
                  <tr>
                    <td align="center" style="padding:30px 26px;">
                      <div style="width:54px;height:54px;border-radius:999px;background:#d1fae5;color:#047857;font-size:28px;line-height:54px;font-weight:800;margin:0 auto 16px auto;">
                        &#10003;
                      </div>
                      ${params.eyebrow ? `<div style="font-size:12px;line-height:18px;color:#059669;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">${escapeHtml(params.eyebrow)}</div>` : ""}
                      <h1 style="margin:0;font-size:26px;line-height:33px;color:#111827;font-weight:800;">
                        ${escapeHtml(params.title)}
                      </h1>
                      <p style="margin:12px 0 0 0;font-size:15px;line-height:24px;color:#4b5563;">
                        ${escapeHtml(params.body)}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px 32px;">
                ${params.content}
                ${cta ? `<div style="padding-top:28px;text-align:center;">${cta}</div>` : ""}
                ${note}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
            <tr>
              <td align="center" style="padding:18px 20px 0 20px;color:#6b7280;font-size:12px;line-height:19px;">
                <strong style="color:#111827;">${BRAND_NAME}</strong><br>
                Este e um e-mail automatico de teste enviado pelo sistema Zuno Propect.<br>
                <a href="mailto:${BRAND_EMAIL}" style="color:#059669;text-decoration:none;">${BRAND_EMAIL}</a>
                &nbsp;|&nbsp;
                <a href="${SITE_URL}" style="color:#059669;text-decoration:none;">zunopropect.com.br</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function createTestEmailTemplate(params: {
  from: string;
  replyTo: string;
  recipient: string;
  dateTime: string;
}) {
  const details = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;">
      <tr>
        <td style="padding:20px 22px;">
          <h2 style="margin:0 0 4px 0;font-size:17px;line-height:24px;color:#111827;font-weight:800;">
            Detalhes do teste
          </h2>
          <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#6b7280;">
            Estes foram os dados usados para validar a configuracao de envio.
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${createInfoRow("Remetente", params.from)}
            ${createInfoRow("Reply-To", params.replyTo || "nao definido")}
            ${createInfoRow("Enviado para", params.recipient)}
            ${createInfoRow("Data e hora", params.dateTime)}
          </table>
        </td>
      </tr>
    </table>
  `;

  const text = `Configuracao de e-mail concluida - Zuno Propect

Seu ambiente de envio foi validado com sucesso. A partir de agora, o Zuno Propect ja pode utilizar esta configuracao para testes, campanhas e comunicacoes do sistema.

Detalhes do teste:
Remetente: ${params.from}
Reply-To: ${params.replyTo || "nao definido"}
Enviado para: ${params.recipient}
Data e hora: ${params.dateTime}

Acessar o Zuno:
${SITE_URL}

Este e um e-mail automatico de teste enviado pelo sistema Zuno Propect.`;

  const html = createZunoEmailLayout({
    preheader: "Sua configuracao de e-mail no Zuno Propect foi validada com sucesso.",
    eyebrow: "Ambiente validado",
    title: "Configuracao de e-mail concluida",
    body: "Seu ambiente de envio foi validado com sucesso. A partir de agora, o Zuno Propect ja pode utilizar esta configuracao para testes, campanhas e comunicacoes do sistema.",
    content: details,
    ctaLabel: "Acessar o Zuno",
    ctaUrl: SITE_URL,
    note: "Este e-mail confirma que sua integracao de envio esta configurada corretamente.",
  });

  return { html, text };
}

function createFounderBullet(text: string) {
  return `
    <tr>
      <td width="26" valign="top" style="padding:8px 0 8px 0;">
        <div style="width:20px;height:20px;border-radius:999px;background:#d1fae5;color:#047857;font-size:13px;line-height:20px;text-align:center;font-weight:800;">&#10003;</div>
      </td>
      <td style="padding:8px 0 8px 8px;color:#374151;font-size:15px;line-height:22px;">
        ${text}
      </td>
    </tr>
  `;
}

export function createFounderAccessCampaignTemplate(params: {
  founderLink?: string;
  unsubscribeUrl?: string;
} = {}) {
  const founderLink = params.founderLink || "{{FOUNDER_LINK}}";
  const unsubscribeUrl = params.unsubscribeUrl || "{{UNSUBSCRIBE_URL}}";

  const text = `Fala, aqui e o Jeferson, criador do Zuno Propect.

Alguns meses atras, voce criou uma conta e testou a primeira versao da plataforma.

Sendo bem sincero: naquela fase, o Zuno ainda estava simples demais. Ele ajudava a encontrar contatos, mas nao ajudava o suficiente na parte mais importante: saber quem abordar e o que falar.

Por isso eu pausei o projeto e reconstrui o Zuno com uma nova camada de IA.

Agora ele nao entrega so uma lista. Ele ajuda voce a encontrar empresas, analisar sinais digitais e gerar roteiros de abordagem mais prontos para usar.

Como voce foi uma das primeiras pessoas a testar, separei uma condicao especial de Parceiro Fundador.

O plano Pro oficial custa R$ 97/mes, mas voce pode entrar pagando R$ 47/mes durante 12 meses.

Voce recebe:
- 800 leads por mes
- 100 roteiros de abordagem com IA
- analise de chance de conversao
- plano de prospeccao de 7 dias

Separei apenas 10 acessos nesse valor.

Se quiser garantir o seu, clique no botao abaixo ou responda este e-mail com "Eu quero".

Jeferson
Criador do Zuno Propect`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${FOUNDER_CAMPAIGN_SUBJECT}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    ${createPreheader(FOUNDER_CAMPAIGN_PREHEADER)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f7fa;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(15,23,42,0.08);">
            <tr>
              <td style="height:6px;background:#10b981;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:26px 28px 20px 28px;background:#0f172a;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <div style="font-size:22px;line-height:28px;color:#ffffff;font-weight:800;">Zuno Propect</div>
                      <div style="font-size:13px;line-height:19px;color:#a7f3d0;margin-top:3px;">Prospec&ccedil;&atilde;o com IA para vender mais</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="display:inline-block;padding:7px 10px;border-radius:999px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.36);color:#d1fae5;font-size:12px;line-height:16px;font-weight:700;">Acesso VIP</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0;background:#0f172a;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:8px 28px 32px 28px;">
                      <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:38px;font-weight:800;">
                        O Zuno mudou. E eu separei um acesso especial para voc&ecirc;.
                      </h1>
                      <p style="margin:14px 0 0 0;color:#cbd5e1;font-size:16px;line-height:26px;">
                        Voc&ecirc; testou uma vers&atilde;o inicial. Agora o produto foi reconstru&iacute;do com IA, an&aacute;lise de leads e roteiros prontos de abordagem.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 8px 28px;">
                <p style="margin:0 0 18px 0;color:#111827;font-size:16px;line-height:26px;font-weight:700;">Fala, aqui &eacute; o Jeferson, criador do Zuno Propect.</p>
                <p style="margin:0 0 16px 0;color:#374151;font-size:16px;line-height:26px;">Alguns meses atr&aacute;s, voc&ecirc; criou uma conta e testou a primeira vers&atilde;o da plataforma.</p>
                <p style="margin:0 0 16px 0;color:#374151;font-size:16px;line-height:26px;">Sendo bem sincero: naquela fase, o Zuno ainda estava simples demais. Ele ajudava a encontrar contatos, mas n&atilde;o ajudava o suficiente na parte mais importante: saber quem abordar e o que falar.</p>
                <p style="margin:0 0 16px 0;color:#374151;font-size:16px;line-height:26px;">Por isso eu pausei o projeto e reconstru&iacute; o Zuno com uma nova camada de IA.</p>
                <p style="margin:0;color:#374151;font-size:16px;line-height:26px;">Agora ele n&atilde;o entrega s&oacute; uma lista. Ele ajuda voc&ecirc; a encontrar empresas, analisar sinais digitais e gerar roteiros de abordagem mais prontos para usar.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;">
                  <tr>
                    <td style="padding:22px 22px 18px 22px;">
                      <h2 style="margin:0 0 8px 0;color:#111827;font-size:20px;line-height:27px;font-weight:800;">O que mudou</h2>
                      <p style="margin:0 0 12px 0;color:#6b7280;font-size:14px;line-height:22px;">Agora o Zuno ajuda voc&ecirc; a:</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        ${createFounderBullet("Encontrar empresas por cidade e nicho")}
                        ${createFounderBullet("Analisar sinais digitais do lead")}
                        ${createFounderBullet("Identificar chance de convers&atilde;o")}
                        ${createFounderBullet("Gerar roteiro de abordagem com IA")}
                        ${createFounderBullet("Criar plano de prospec&ccedil;&atilde;o de 7 dias")}
                        ${createFounderBullet("Organizar leads para acompanhamento")}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#052e2b;border-radius:18px;overflow:hidden;border:1px solid #064e3b;">
                  <tr>
                    <td style="padding:24px 22px;">
                      <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:12px;line-height:16px;font-weight:800;text-transform:uppercase;">Acesso Parceiro Fundador</div>
                      <h2 style="margin:14px 0 16px 0;color:#ffffff;font-size:25px;line-height:32px;font-weight:800;">Entre no Pro pagando menos da metade por 12 meses.</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="48%" style="padding:16px;border-radius:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);">
                            <div style="color:#a7f3d0;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;">Plano Pro oficial</div>
                            <div style="margin-top:8px;color:#ffffff;font-size:26px;line-height:32px;font-weight:800;">R$ 97<span style="font-size:14px;font-weight:600;color:#cbd5e1;">/m&ecirc;s</span></div>
                          </td>
                          <td width="4%" style="font-size:1px;line-height:1px;">&nbsp;</td>
                          <td width="48%" style="padding:16px;border-radius:14px;background:#10b981;border:1px solid #34d399;">
                            <div style="color:#ecfdf5;font-size:12px;line-height:16px;font-weight:800;text-transform:uppercase;">Seu acesso fundador</div>
                            <div style="margin-top:8px;color:#ffffff;font-size:31px;line-height:36px;font-weight:900;">R$ 47<span style="font-size:14px;font-weight:700;color:#ecfdf5;">/m&ecirc;s</span></div>
                            <div style="margin-top:4px;color:#ecfdf5;font-size:13px;line-height:18px;">por 12 meses</div>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
                        <tr>
                          <td style="padding:13px 0;border-top:1px solid rgba(255,255,255,0.12);color:#d1fae5;font-size:15px;line-height:23px;">&#10003; 800 leads/m&ecirc;s</td>
                          <td style="padding:13px 0;border-top:1px solid rgba(255,255,255,0.12);color:#d1fae5;font-size:15px;line-height:23px;">&#10003; 100 roteiros de IA/m&ecirc;s</td>
                        </tr>
                        <tr>
                          <td style="padding:13px 0;border-top:1px solid rgba(255,255,255,0.12);color:#d1fae5;font-size:15px;line-height:23px;">&#10003; acesso ao Plano Pro</td>
                          <td style="padding:13px 0;border-top:1px solid rgba(255,255,255,0.12);color:#d1fae5;font-size:15px;line-height:23px;">&#10003; pre&ccedil;o travado por 1 ano</td>
                        </tr>
                      </table>
                      <p style="margin:4px 0 0 0;color:#a7f3d0;font-size:14px;line-height:22px;font-weight:700;">Apenas 10 vagas dispon&iacute;veis nessa condi&ccedil;&atilde;o.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 28px 8px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;width:100%;max-width:360px;">
                  <tr>
                    <td align="center" bgcolor="#10b981" style="border-radius:12px;box-shadow:0 12px 24px rgba(16,185,129,0.28);">
                      <a href="${founderLink}" target="_blank" style="display:block;padding:16px 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;color:#ffffff;text-decoration:none;font-weight:800;border-radius:12px;">
                        Quero meu acesso fundador
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 18px;color:#065f46;font-size:15px;line-height:23px;">
                      Separei apenas 10 acessos nesse valor para validar essa nova fase com usu&aacute;rios pr&oacute;ximos.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 30px 28px;">
                <p style="margin:0 0 16px 0;color:#374151;font-size:16px;line-height:26px;">Se fizer sentido para voc&ecirc;, responde este e-mail com <strong style="color:#111827;">"Eu quero"</strong> ou clica no bot&atilde;o acima.</p>
                <p style="margin:0;color:#111827;font-size:16px;line-height:25px;font-weight:700;">Jeferson</p>
                <p style="margin:2px 0 0 0;color:#6b7280;font-size:14px;line-height:22px;">Criador do Zuno Propect</p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:18px 18px 0 18px;color:#6b7280;font-size:12px;line-height:19px;">
                <strong style="color:#111827;">Zuno Propect</strong><br>
                ${BRAND_EMAIL}<br>
                Campanha especial para usu&aacute;rios que testaram a primeira vers&atilde;o do Zuno Propect.<br>
                <a href="${unsubscribeUrl}" style="color:#059669;text-decoration:underline;">Sair desta lista</a>
                <div style="font-size:1px;line-height:1px;height:1px;overflow:hidden;">{{OPEN_PIXEL}}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: FOUNDER_CAMPAIGN_SUBJECT,
    preheader: FOUNDER_CAMPAIGN_PREHEADER,
    html,
    text,
  };
}
