import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Novavents · Event Planner', description: 'Turn an event idea into a thoughtful plan. A school project by Novavents.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
