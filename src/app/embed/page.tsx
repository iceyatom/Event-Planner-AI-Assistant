import Chat from '@/components/Chat';
import { mode } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
export default function Embed() { return <Chat mode={mode()} embedded />; }
