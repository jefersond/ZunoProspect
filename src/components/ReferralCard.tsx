// Componente de indicação temporariamente desativado.
// As colunas (referral_code, referred_by, buscas_saldo) ainda não existem
// na tabela `profiles`. Reative quando a migration em referral_trigger.sql
// for aplicada.
export function ReferralCard() {
  return null;
}
