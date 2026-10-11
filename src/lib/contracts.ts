import { z } from 'zod';
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(8000),
}).strict();
export const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(messageSchema).max(12),
}).strict();
export type Message = z.infer<typeof messageSchema>;
export type ChatRequest = z.infer<typeof requestSchema>;
export type Mode = 'demo' | 'live' | 'disabled';
export type ChatResult = { reply: string; mode: Mode; contextTrimmed: boolean };

// Keep the provider schema compact; validate numerical bounds again locally.
export const planSchema = z.object({
  summary: z.string(),
  questions: z.array(z.string()).max(2),
  assumptions: z.array(z.string()),
  agenda: z.array(z.object({ activity: z.string(), minutes: z.number().int() }).strict()),
  currency: z.string(),
  budgetCents: z.number().int().nullable(),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int(), unitCents: z.number().int() }).strict()),
  checklist: z.array(z.string()),
}).strict();
export type Plan = z.infer<typeof planSchema>;
