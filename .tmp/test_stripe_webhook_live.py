import time
import hmac
import hashlib
import json
import urllib.request
import urllib.error

# Configurações do teste
WEBHOOK_URL = "https://ihtltqxxlvbsxbiacbpr.supabase.co/functions/v1/stripe-webhook"
WEBHOOK_SECRET = "whsec_YFVp0T2wfiJu09Bvl61gmccPOChEePGu"

# Payload do Stripe - checkout.session.completed para o plano Pro (9700 centavos)
payload_dict = {
    "id": "evt_test_webhook_validation_antigravity",
    "object": "event",
    "api_version": "2023-10-16",
    "created": int(time.time()),
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
}

# Converter para JSON strings compactas (exatamente o que o Stripe envia)
payload_json = json.dumps(payload_dict, separators=(',', ':'))

# Calcular a assinatura Stripe (stripe-signature)
timestamp = str(int(time.time()))
signed_payload = f"{timestamp}.{payload_json}"

signature = hmac.new(
    WEBHOOK_SECRET.encode('utf-8'),
    signed_payload.encode('utf-8'),
    hashlib.sha256
).hexdigest()

stripe_signature_header = f"t={timestamp},v1={signature}"

# Configurar a requisição
req = urllib.request.Request(
    WEBHOOK_URL,
    data=payload_json.encode('utf-8'),
    headers={
        'Content-Type': 'application/json',
        'Stripe-Signature': stripe_signature_header,
        'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
    },
    method='POST'
)

print("Enviando requisição de teste para o Webhook ao vivo...")
print(f"URL: {WEBHOOK_URL}")
print(f"Email do Cliente: falecom@klsalescompany.com")
print(f"Plano Simulador: Pro (R$ 97,00)")

try:
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        response_body = response.read().decode('utf-8')
        print("\n🎉 RESPOSTA DA EDGE FUNCTION:")
        print(f"Status HTTP: {status_code}")
        print(f"Corpo do Retorno: {response_body}")
except urllib.error.HTTPError as e:
    print(f"\n❌ ERRO HTTP: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"\n❌ ERRO DE CONEXÃO: {e}")
