import { handleChat } from '@/lib/server/chat';
export const runtime = 'nodejs';
export const maxDuration = 40;
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleChat(request); }
