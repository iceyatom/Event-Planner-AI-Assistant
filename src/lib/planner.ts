import { planSchema, type Plan } from './contracts';

export function renderPlan(value: unknown) {
  const plan = planSchema.parse(value);
  if (!/^[A-Z]{3}$/.test(plan.currency) || plan.items.length > 12 || plan.agenda.length > 12) throw new Error('Invalid plan');
  const money = (cents: number) => `${plan.currency} ${(cents / 100).toFixed(2)}`;
  const bounded = (n: number, max: number) => {
    if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error('Invalid number');
    return n;
  };
  let total = 0;
  const costs = plan.items.map(item => {
    const cost = bounded(item.quantity, 100000) * bounded(item.unitCents, 100000000);
    total += cost;
    return `${item.name}: ${item.quantity} × ${money(item.unitCents)} = ${money(cost)}`;
  });
  let elapsed = 0;
  const agenda = plan.agenda.map(item => {
    const start = elapsed;
    elapsed += bounded(item.minutes, 1440);
    return `${start}–${elapsed} min: ${item.activity}`;
  });
  if (plan.budgetCents !== null) bounded(plan.budgetCents, 1000000000);
  const difference = plan.budgetCents === null ? null : plan.budgetCents - total;
  return [
    plan.summary,
    plan.questions.length ? `A couple of details\n${plan.questions.map(q => `• ${q}`).join('\n')}` : '',
    plan.assumptions.length ? `Assumptions to confirm\n${plan.assumptions.map(a => `• ${a}`).join('\n')}` : '',
    agenda.length ? `Suggested agenda\n${agenda.join('\n')}\nDuration: ${elapsed} minutes` : '',
    costs.length ? `Estimated budget · not vendor quotes\n${costs.join('\n')}\nTotal: ${money(total)}${difference === null ? '' : `\n${difference >= 0 ? 'Remaining' : 'Over budget'}: ${money(Math.abs(difference))}`}` : '',
    plan.checklist.length ? `Next steps\n${plan.checklist.map(c => `□ ${c}`).join('\n')}` : '',
    'Estimates need checking. Nothing has been booked or approved.',
  ].filter(Boolean).join('\n\n');
}

export function basePlan(): Plan {
  return { summary: '', questions: [], assumptions: [], agenda: [], currency: 'USD', budgetCents: null, items: [], checklist: [] };
}
