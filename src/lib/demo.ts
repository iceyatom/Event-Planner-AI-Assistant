import type { ChatRequest } from './contracts';
import { basePlan, renderPlan } from './planner';

// Deliberately deterministic sample logic. This is never a fallback for OpenAI.
export function demoReply(request: ChatRequest) {
  const current = request.message.toLowerCase();
  if (/book|confirmed|vendor|live price/.test(current)) return 'Demo sample: I cannot book a venue or confirm vendor prices. I can help draft questions for a vendor and an estimated event budget. What kind of event are you planning?';
  const context = [...request.history.filter(m => m.role === 'user').map(m => m.content), request.message].join(' ').toLowerCase();
  if (!/event|fundrais|party|celebrat|agenda|budget|indoor|guest|checklist|theme|workshop/.test(context)) return 'Demo sample: I help with event themes, agendas, budgets, and checklists. What kind of event would you like to plan?';
  const last = (pattern: RegExp) => [...context.matchAll(pattern)].at(-1)?.[1];
  const guests = Number(last(/(\d+)\s*(?:guests|people|students)/g) || 40);
  const budget = Number(last(/\$\s*(\d+(?:\.\d{1,2})?)/g) || 300);
  const hours = last(/(\d+(?:\.\d+)?)\s*[- ]?hours?/g);
  const minutes = hours ? Math.round(Number(hours) * 60) : /two[- ]hour/.test(context) ? 120 : 120;
  const safeMinutes = Math.min(Math.max(minutes, 30), 480);
  const safeBudget = Math.min(budget, 100000);
  const p = basePlan();
  p.summary = `Demo sample · ${/fundrais/.test(context) ? 'School fundraiser' : 'Community gathering'}\nTheme: Small moments, big impact. A welcoming plan for ${guests} guests.`;
  p.questions = ['What date and location should we plan for?', 'Is USD the right currency?'];
  p.assumptions = [
    `${safeMinutes} minutes; ${guests} guests${guests === 40 && !/40\s*(guests|people|students)/.test(context) ? ' (sample guest count)' : ''}.`,
    `${/indoor/.test(context) ? 'Indoor room' : 'School space'} available at no charge, subject to permission.`,
    `USD ${safeBudget.toFixed(2)} spending limit${!/\$/.test(context) ? ' (sample budget)' : ''}; prices below are invented examples.`,
  ];
  const welcome = Math.round(safeMinutes / 8);
  const close = welcome;
  const mingle = Math.round(safeMinutes / 4);
  p.agenda = [{ activity: 'Welcome and introduce the cause', minutes: welcome }, { activity: 'Activity stations and fundraising', minutes: safeMinutes - welcome - close - mingle }, { activity: 'Connect, refreshments, and thank supporters', minutes: mingle }, { activity: 'Wrap up and clean up', minutes: close }];
  p.budgetCents = Math.round(safeBudget * 100);
  const perGuest = guests > 0 ? Math.floor(p.budgetCents * 0.45 / guests) : 0;
  p.items = [{ name: 'Refreshments', quantity: Math.min(guests, 100000), unitCents: perGuest }, { name: 'Activity supplies', quantity: 1, unitCents: Math.floor(p.budgetCents * 0.25) }, { name: 'Decorations and signs', quantity: 1, unitCents: Math.floor(p.budgetCents * 0.15) }, { name: 'Contingency', quantity: 1, unitCents: Math.floor(p.budgetCents * 0.15) }];
  p.checklist = ['Confirm venue permission, accessibility, and any school rules.', 'Check actual prices and dietary needs without collecting personal records here.', 'Assign setup and cleanup volunteers; review the plan with your teacher.'];
  return renderPlan(p);
}
