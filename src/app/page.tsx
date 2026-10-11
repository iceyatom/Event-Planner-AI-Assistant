import Chat from '@/components/Chat';
import { mode } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
export default function Home() { return <Chat mode={mode()} />; }
