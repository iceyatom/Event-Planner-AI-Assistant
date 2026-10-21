import type { ChatRequest } from './contracts';
import { basePlan, renderPlan } from './planner';

// Deliberately deterministic sample logic. This is never a fallback for OpenAI.
export function demoReply(request: ChatRequest) {
  const current = request.message.toLowerCase();
  if (/book|confirmed|vendor|price|cost|how much/.test(current)) return 'Demo sample: I cannot book vendors or quote prices. Package pricing is on the Novavents site, and I can suggest event ideas and the package that fits best. What kind of event are you planning?';
  const context = [...request.history.filter(m => m.role === 'user').map(m => m.content), request.message].join(' ').toLowerCase();
  if (!/event|fundrais|party|celebrat|agenda|wedding|gala|indoor|guest|checklist|theme|workshop/.test(context)) return 'Demo sample: I help with event themes, agendas, checklists, and choosing a Novavents package. What kind of event would you like to plan?';
  const last = (pattern: RegExp) => [...context.matchAll(pattern)].at(-1)?.[1];
  const guestText = last(/(\d+)\s*(?:guests|people|students|attendees)/g);
  const hours = last(/(\d+(?:\.\d+)?)\s*[- ]?hours?/g) ?? (/two[- ]hour/.test(context) ? '2' : undefined);
  const minutes = Math.min(Math.max(hours ? Math.round(Number(hours) * 60) : 120, 30), 480);
  const kind = /wedding/.test(context) ? 'Wedding' : /fundrais/.test(context) ? 'Fundraiser' : /gala/.test(context) ? 'Gala' : 'Celebration';
  const indoor = /indoor/.test(context);
  const p = basePlan();
  p.knownFacts = [`Event: ${kind.toLowerCase()}`];
  if (hours) p.knownFacts.push(`Length: about ${minutes / 60} hours`);
  if (indoor) p.knownFacts.push('Setting: indoors');
  if (!guestText) {
    p.summary = `Demo sample · ${kind}\nLovely, let's shape this together. A couple of details will help me suggest ideas that fit.`;
    p.questions = ['About how many guests are you expecting?', 'What feel are you going for: relaxed, lively, or elegant?'];
    return renderPlan(p);
  }
  const guests = Number(guestText);
  p.summary = `Demo sample · ${kind} for ${guests} guests\nHere are three directions to get us started.`;
  p.knownFacts.splice(1, 0, `Guests: about ${guests}`);
  if (!hours) p.knownFacts.push('Length: about 2 hours (assumed)');
  p.options = [
    { name: 'Garden Glow', description: `Soft string lights, greenery, and a relaxed ${indoor ? 'indoor garden' : 'open-air'} feel for easy mingling.`, example: 'Riverside Botanical Garden (demo sample name)' },
    { name: 'Modern Minimal', description: 'Clean lines, a neutral palette, and one standout focal piece that keeps things polished but simple.', example: 'The Foundry Loft event space (demo sample name)' },
    { name: 'Golden Hour Social', description: 'Warm tones, lounge seating, and an interactive station so guests have something to gather around.', example: 'Sunset Mobile Bar Co. (demo sample name)' },
  ];
  p.recommendedPackage = guests <= 50 && minutes <= 360 ? 'Essential' : guests <= 150 && minutes <= 600 ? 'Signature' : 'Luxe';
  p.packageReason = p.recommendedPackage === 'Essential'
    ? `With ${guests} guests and a ${minutes / 60}-hour event, the essentials and day-of coordination should cover it well.`
    : p.recommendedPackage === 'Signature'
      ? `At ${guests} guests, a full timeline, custom design, and vendor management will keep everything running smoothly.`
      : `For ${guests} guests or a long day, full-day management and premium vendor access give you the most support.`;
  p.checklist = ['Pick the direction you like best.', 'Confirm the date and venue.', 'Review the recommended package on the Novavents site.'];
  return renderPlan(p);
}
