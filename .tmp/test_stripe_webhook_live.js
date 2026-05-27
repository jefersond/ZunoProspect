const crypto = require('crypto');
const https = require('https');

const WEBHOOK_URL = "https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/stripe-webhook";
const WEBHOOK_SECRET = "whsec_YFVp0T2wfiJu09Bvl61gmccPOChEePGu";

const payload = {
    "id": "evt_test_webhook_validation_antigravity",
    "object": "event",
    "api_version": "2023-10-16",
    "created": Math.floor(Date.now() / 1000),
    "type": "checkout.session.completed",
    "data": {
        "object": {
            "id": "cs_live_b1kPcnLSGhhi1tBP4Aruz9LaxQ2PqgsQBGmuV3QJZqO5qNkMVLIETII37v",
            "object": "checkout.session",
            "amount_total": 9700,
            "currency": "brl",
            "customer": "cus_UaAJZtbMx68Omf",
            "customer_details": {
                "email": "falecom@klsalescompany.com",
                "name": "KL Sales Company"
            },
            "metadata": {
                "plan_id": "pro",
                "user_id": "b133f74a-863f-4f44-98f8-b4505822fac0"
            },
            "payment_status": "paid",
            "status": "complete",
            "subscription": "sub_1TazyQFgIIQ1aOHHElbp8uTC"
        }
    }
};

const payloadString = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signedPayload = `${timestamp}.${payloadString}`;

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(signedPayload)
  .digest('hex');

const header = `t=${timestamp},v1=${signature}`;

console.log("Enviando requisição de teste para o Webhook ao vivo via Node.js...");
console.log(`URL: ${WEBHOOK_URL}`);
console.log(`Email do Cliente: falecom@klsalescompany.com`);
console.log(`Plano: Pro (R$ 97,00)`);

const url = new URL(WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': header,
    'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`\n🎉 RESPOSTA DA EDGE FUNCTION (HTTP ${res.statusCode}):`);
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ ERRO DE REQUISIÇÃO: ${e.message}`);
});

req.write(payloadString);
req.end();
