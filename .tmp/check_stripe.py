import urllib.request
import urllib.parse
import json

stripe_key = "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"
emails = ["falecom@klsalescompany.com", "zunopropect@gmail.com"]

headers = {
    "Authorization": f"Bearer {stripe_key}",
    "Content-Type": "application/x-www-form-urlencoded"
}

def get_customer_by_email(email):
    query = urllib.parse.urlencode({"email": email})
    url = f"https://api.stripe.com/v1/customers?{query}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data.get("data", [])
    except Exception as e:
        print(f"Erro ao buscar customer para {email}: {e}")
        return []

def get_subscriptions(customer_id):
    query = urllib.parse.urlencode({"customer": customer_id})
    url = f"https://api.stripe.com/v1/subscriptions?{query}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data.get("data", [])
    except Exception as e:
        print(f"Erro ao buscar subscriptions para {customer_id}: {e}")
        return []

for email in emails:
    print(f"\n=== Investigando e-mail: {email} ===")
    customers = get_customer_by_email(email)
    if not customers:
        print(f"Nenhum cliente Stripe encontrado para {email}")
        continue
    
    for cust in customers:
        cust_id = cust["id"]
        print(f"Cliente Stripe: {cust_id} (Nome: {cust.get('name')})")
        subs = get_subscriptions(cust_id)
        if not subs:
            print("  Nenhuma assinatura encontrada no Stripe.")
        else:
            for sub in subs:
                print(f"  Assinatura ID: {sub['id']}")
                print(f"    Status: {sub['status']}")
                print(f"    Current Period Start: {sub.get('current_period_start')}")
                print(f"    Current Period End: {sub.get('current_period_end')}")
                for item in sub.get("items", {}).get("data", []):
                    price = item.get("price", {})
                    print(f"    Item Preço ID: {price.get('id')}")
                    print(f"    Valor: {price.get('unit_amount') / 100} {price.get('currency').upper()}")
                    print(f"    Metadata: {sub.get('metadata')}")
