export const TRIAL_DURATION_DAYS = 4;
export const TRIAL_POLICY_VERSION = "4d_2026_09";
export const TRIAL_REQUIRES_CARD = true;

export function trialTypeTag() {
  return `${TRIAL_DURATION_DAYS}_day_card_required`;
}
