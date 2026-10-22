import facts from '@/data/facts.json';
import { planSchema, type Plan } from './contracts';

export function renderPlan(value: unknown) {
  const plan = planSchema.parse(value);
  if (plan.agenda.length > 12 || plan.checklist.length > 12) throw new Error('Invalid plan');
  const bounded = (n: number, max: number) => {
    if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error('Invalid number');
    return n;
  };
  let elapsed = 0;
  const agenda = plan.agenda.map(item => {
    const start = elapsed;
    elapsed += bounded(item.minutes, 1440);
    return `${start}–${elapsed} min: ${item.activity}`;
  });
  const pkg = plan.recommendedPackage && facts.packages.find(p => p.name === plan.recommendedPackage);
  return [
    plan.summary,
    plan.questions.length ? `A couple of details\n${plan.questions.map(q => `• ${q}`).join('\n')}` : '',
    plan.knownFacts.length ? `Known facts\n${plan.knownFacts.map(f => `• ${f}`).join('\n')}` : '',
    plan.options.length ? `${plan.options.length === 3 ? 'Three' : 'A few'} directions to consider\n${plan.options.map((o, i) => `${i + 1}. ${o.name}: ${o.description}${o.example.trim() ? `\n   Example: ${o.example.trim()} (check availability)` : ''}`).join('\n')}` : '',
    pkg ? `Recommended package · ${pkg.name} (${pkg.tagline.toLowerCase()})\n${plan.packageReason ? `${plan.packageReason}\n` : ''}Includes: ${pkg.includes.join(', ')}.\nSee all packages at ${facts.siteUrl}` : '',
    agenda.length ? `Suggested agenda\n${agenda.join('\n')}\nDuration: ${elapsed} minutes` : '',
    plan.checklist.length ? `Next steps\n${plan.checklist.map(c => `□ ${c}`).join('\n')}` : '',
    FOOTER,
  ].filter(Boolean).join('\n\n');
}

const FOOTER = 'Ideas only. Nothing has been booked or approved.';

// Shortens a past reply before it is sent back to the AI as history. Drops the parts
// renderPlan adds the same way every time (package inclusions, site link, footer), which
// the AI never needs to reread. The user still sees the full reply in the chat.
export function compactReply(text: string) {
  const kept = text.split('\n').filter(line => !line.startsWith('Includes: ') && !line.startsWith('See all packages at ') && line !== FOOTER);
  const compact = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return compact || text;
}

export function basePlan(): Plan {
  return { summary: '', questions: [], knownFacts: [], options: [], recommendedPackage: null, packageReason: '', agenda: [], checklist: [] };
}
