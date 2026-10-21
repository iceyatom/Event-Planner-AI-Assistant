'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ChatResult, Message, Mode } from '@/lib/contracts';

const starters = [
  { icon: '✦', title: 'Plan a fundraiser', detail: 'A little purpose. A lot of possibility.', prompt: 'Plan a two-hour school fundraiser for 40 guests.' },
  { icon: '◷', title: 'Build an agenda', detail: 'Make every moment count.', prompt: 'Help me build an agenda for a two-hour school club celebration.' },
  { icon: '✓', title: 'Make a checklist', detail: 'The details, taken care of.', prompt: 'Create a preparation checklist for a small school event.' },
];

export default function Chat({ mode, embedded = false }: { mode: Mode; embedded?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copyFallback, setCopyFallback] = useState(false);
  const pending = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const latestPlan = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(text = draft) {
    if (pending.current || mode === 'disabled' || !text.trim() || text.length > 2000) return;
    pending.current = true;
    const version = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35000);
    setBusy(true); setError(''); setCopyFallback(false);
    const history = messages.slice(-12);
    if (messages.length > 12) setNotice('Older context was left out. Please restate any important details.');
    setMessages(previous => [...previous, { role: 'user', content: text.trim() }]);
    setDraft('');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text.trim(), history }), signal: controller.signal, credentials: 'omit' });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The planner is unavailable. Please try again.');
      const result = data as ChatResult;
      if (typeof result.reply !== 'string') throw new Error('No plan was received. Please try again.');
      if (generation.current !== version) return;
      setMessages(previous => [...previous, { role: 'assistant', content: result.reply }]);
      if (result.contextTrimmed) setNotice('Older context was left out. Please restate any important details.');
    } catch (err) {
      if (generation.current !== version) return;
      setError(controller.signal.aborted ? 'The request took too long. Please try again when you are ready.' : err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setDraft(text);
      setMessages(previous => previous.slice(0, -1));
    } finally {
      clearTimeout(timeout);
      if (generation.current === version) { pending.current = false; setBusy(false); input.current?.focus(); }
    }
  }
  function clear() {
    generation.current += 1; abort.current?.abort(); pending.current = false;
    setMessages([]); setDraft(''); setError(''); setBusy(false); setCopyFallback(false); setNotice('Chat cleared.'); input.current?.focus();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(latestPlan); setNotice('Plan copied.'); }
    catch { setCopyFallback(true); setNotice('Select the plan below and copy it manually.'); }
  }
  return <div className={embedded ? 'app embedded' : 'app'}>
    {!embedded && <header className="site-header"><Link href="/" className="wordmark" aria-label="Novavents home"><span className="brand-icon" aria-hidden="true">✳</span> novavents<span className="wordmark-dot">.</span></Link><span className="header-note">GOOD IDEAS BRING PEOPLE TOGETHER</span><a className="site-link" href="https://sites.google.com/view/novavents/" target="_blank" rel="noreferrer">Visit our site <span aria-hidden="true">↗</span></a></header>}
    <main className="workspace">
      {!embedded && <aside className="intro"><div className="eyebrow"><span /> YOUR NEXT GREAT GATHERING</div><h1>Big ideas.<br />Thoughtful plans.<br /><em>Let’s begin.</em></h1><p>From the first “what if” to the last little detail. Shape an event that brings your people together.</p><div className="orbit-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-star">✳</span><span className="art-dot" /><span className="art-label">a little planning,<br />a lot of possibility.</span></div><div className="intro-foot"><span>01 / THE PLANNING STUDIO</span><span>MADE FOR YOUR MOMENTS</span></div></aside>}
      <section className="chat-panel" aria-labelledby="chat-title">
        <header className="chat-header"><div className="assistant-mark" aria-hidden="true">✦</div><div className="chat-heading"><h2 id="chat-title">Your event, taking shape.</h2><span>{mode === 'demo' ? 'Demo mode · sample responses, no AI calls' : mode === 'disabled' ? 'Chat is currently turned off' : 'AI planning assistant · here to help'}</span></div><a className="expand-link" href="/" target="_blank" rel="noreferrer" aria-label="Open chatbot in a new tab" title="Open chatbot">↗</a></header>
        <div className="chat-content">
          {!messages.length && <div className="welcome"><span className="welcome-tag">A GOOD EVENT STARTS WITH A CONVERSATION</span><h3>What are we planning?</h3><p>Tell me what you have in mind. We’ll explore a few ideas, find the right package, and map out next steps together.</p><div className="starters">{starters.map(s => <button type="button" key={s.title} onClick={() => { setDraft(s.prompt); input.current?.focus(); }} disabled={busy || mode === 'disabled'}><span className="starter-icon" aria-hidden="true">{s.icon}</span><span><strong>{s.title}</strong><small>{s.detail}</small></span><span className="starter-arrow" aria-hidden="true">↗</span></button>)}</div><div className="gentle-note"><span aria-hidden="true">✧</span> A rough idea is a perfectly good place to start.</div></div>}
          <div role="log" aria-label="Chat transcript" aria-live="polite" aria-relevant="additions" className="transcript">{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><span className="message-author">{message.role === 'user' ? 'YOU' : mode === 'demo' ? 'NOVAVENTS · DEMO SAMPLE' : 'NOVAVENTS'}</span><div className="message-text">{message.content}</div></article>)}</div>
          {busy && <p role="status" className="thinking">✦ Putting your plan together…</p>}
          <div ref={end} />
        </div>
        <div className="composer-wrap">
          {error && <p role="alert" className="error">{error}</p>}
          {notice && <p role="status" className="notice">{notice}</p>}
          {copyFallback && <div className="copy-fallback"><label htmlFor="copy-plan">Select and copy your plan</label><textarea id="copy-plan" readOnly value={latestPlan} onFocus={event => event.currentTarget.select()} /></div>}
          <form onSubmit={event => { event.preventDefault(); void send(); }}>
            <label htmlFor="message" className="sr-only">Tell me about your event</label><div className="composer"><textarea ref={input} id="message" placeholder="An idea, a date, a guest count… start anywhere." rows={2} maxLength={2000} value={draft} disabled={busy || mode === 'disabled'} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} aria-describedby="input-help" /><button type="submit" className="send" disabled={busy || !draft.trim() || mode === 'disabled'} aria-label="Send message">{busy ? '…' : '↑'}</button></div>
            <div className="composer-help" id="input-help"><span>Enter to send · Shift + Enter for a new line</span><span>{draft.length}/2,000</span></div>
          </form>
          <div className="chat-actions"><button type="button" onClick={clear}>Clear chat</button><button type="button" onClick={() => void copy()} disabled={!latestPlan || busy}>Copy plan <span aria-hidden="true">↗</span></button><a href="/" target="_blank" rel="noreferrer">Open chatbot ↗</a></div>
          <p className="privacy">AI planning assistant. Use fictional details. Messages are sent to OpenAI in live mode. Ideas need checking. {mode === 'demo' && 'This demo sends nothing to OpenAI.'} Chat stays in this tab’s memory.</p>
        </div>
      </section>
    </main>
    {!embedded && <footer className="site-footer"><span>A LITTLE STRUCTURE. ROOM FOR MAGIC.</span><span>Novavents · A school project</span></footer>}
  </div>;
}
