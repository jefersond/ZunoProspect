const stripeKey = "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";
const emails = ["falecom@klsalescompany.com", "zunopropect@gmail.com"];

const headers = {
  "Authorization": `Bearer ${stripeKey}`,
  "Content-Type": "application/x-www-form-urlencoded"
};

async function getCustomerByEmail(email) {
  const query = new URLSearchParams({ email }).toString();
  const url = `https://api.stripe.com/v1/customers?${query}`;
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.error(`Erro ao buscar customer para ${email}:`, e);
    return [];
  }
}

async function getSubscriptions(customerId) {
  const query = new URLSearchParams({ customer: customerId }).toString();
  const url = `https://api.stripe.com/v1/subscriptions?${query}`;
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.error(`Erro ao buscar subscriptions para ${customerId}:`, e);
    return [];
  }
}

async function run() {
  for (const email of emails) {
    console.log(`\n=== Investigando e-mail: ${email} ===`);
    const customers = await getCustomerByEmail(email);
    if (!customers || customers.length === 0) {
      console.log(`Nenhum cliente Stripe encontrado para ${email}`);
      continue;
    }
    
    for (const cust of customers) {
      const custId = cust.id;
      console.log(`Cliente Stripe: ${custId} (Nome: ${cust.name})`);
      const subs = await getSubscriptions(custId);
      if (!subs || subs.length === 0) {
        console.log("  Nenhuma assinatura encontrada no Stripe.");
      } else {
        for (const sub of subs) {
          console.log(`  Assinatura ID: ${sub.id}`);
          console.log(`    Status: ${sub.status}`);
          console.log(`    Current Period Start: ${new Date(sub.current_period_start * 1000).toISOString()}`);
          console.log(`    Current Period End: ${new Date(sub.current_period_end * 1000).toISOString()}`);
          for (const item of sub.items.data) {
            const price = item.price;
            console.log(`    Item Preço ID: ${price.id}`);
            console.log(`    Valor: ${price.unit_amount / 100} ${price.currency.toUpperCase()}`);
            console.log(`    Metadata:`, sub.metadata);
          }
        }
      }
    }
  }
}

run();
