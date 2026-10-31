import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3, FileCode2, GitBranch, LockKeyhole, Menu, RefreshCw, ShieldCheck, X } from 'lucide-react';

type Phase = 'idle' | 'capture' | 'verify' | 'transfer' | 'ready';

function useSectionMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('motion-ready');
    const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -5% 0px' });
    items.forEach((item) => {
      const bounds = item.getBoundingClientRect();
      if (bounds.top < window.innerHeight * 0.95 && bounds.bottom > 0) item.classList.add('revealed');
      else observer.observe(item);
    });
    return () => { observer.disconnect(); document.documentElement.classList.remove('motion-ready'); };
  }, []);
}

function RelayMark({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? 'relay-mark compact' : 'relay-mark'} aria-hidden="true">
    <svg viewBox="0 0 36 36" fill="none"><path d="M5 10h10a8 8 0 0 1 0 16H5v-6h10a2 2 0 1 0 0-4H5v-6Z" fill="currentColor"/><path d="M31 26H21a8 8 0 0 1 0-16h10v6H21a2 2 0 1 0 0 4h10v6Z" fill="currentColor"/><path d="M12 18h12" stroke="#F8F8F5" strokeWidth="2.2"/></svg>
  </span>;
}

function Wordmark() {
  return <a className="relay-wordmark" href="#top" aria-label="Relay AI home"><span className="relay-logo-crop"><img src="/relay-logo.png" alt="" /></span></a>;
}

function RelayMotionGraphic() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typedText, setTypedText] = useState('');
  const firstLeg = useRef<SVGAnimateMotionElement | null>(null);
  const secondLeg = useRef<SVGAnimateMotionElement | null>(null);
  const timers = useRef<number[]>([]);
  const runId = useRef(0);
  const prompt = 'Continue the sign-in redirect in src/auth/useSession.ts. The authentication screen is complete; the redirect is the next task.';
  const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  useEffect(() => () => { clearTimers(); }, []);
  useEffect(() => {
    if (phase !== 'ready') { setTypedText(''); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTypedText(prompt); return; }
    let index = 0;
    const interval = window.setInterval(() => {
      index += 2;
      setTypedText(prompt.slice(0, index));
      if (index >= prompt.length) window.clearInterval(interval);
    }, 24);
    return () => window.clearInterval(interval);
  }, [phase]);

  const start = () => {
    clearTimers();
    const current = ++runId.current;
    setTypedText('');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase('ready'); return; }
    setPhase('capture');
    firstLeg.current?.beginElement();
    timers.current.push(window.setTimeout(() => {
      if (runId.current !== current) return;
      setPhase('verify');
      timers.current.push(window.setTimeout(() => {
        if (runId.current !== current) return;
        setPhase('transfer');
        secondLeg.current?.beginElement();
        timers.current.push(window.setTimeout(() => { if (runId.current === current) setPhase('ready'); }, 1050));
      }, 850));
    }, 950));
  };

  const status = {
    idle: 'Ready when you are',
    capture: 'Capturing the unfinished task',
    verify: 'Checking repository evidence',
    transfer: 'Moving the approved packet',
    ready: 'Context packet is ready',
  }[phase];

  return <div className={`relay-stage phase-${phase}`} id="walkthrough">
    <div className="stage-topline"><span><i className="stage-live-dot"/> CONTEXT RELAY / WALKTHROUGH</span><span className="simulation-label">SIMULATED REPOSITORY</span></div>
    <div className="relay-graphic" aria-label="Illustrative context packet moving from OpenCode through Relay AI to Codex">
      <svg className="route-svg" viewBox="0 0 1000 360" preserveAspectRatio="none" aria-hidden="true">
        <path className="route-base" d="M115 180 C265 180 310 180 500 180 S735 180 885 180"/>
        <path className="route-verified" d="M115 180 C265 180 310 180 500 180 S735 180 885 180"/>
        <circle className="route-node-dot" cx="115" cy="180" r="5"/><circle className="route-node-dot" cx="500" cy="180" r="5"/><circle className="route-node-dot" cx="885" cy="180" r="5"/>
        <circle className="moving-packet" cx="115" cy="180" r="8">
          <animateMotion ref={firstLeg} dur=".95s" begin="indefinite" fill="freeze" additive="sum" path="M0 0 C145 0 210 0 385 0"/>
          <animateMotion ref={secondLeg} dur="1.05s" begin="indefinite" fill="freeze" additive="sum" path="M385 0 C560 0 625 0 770 0"/>
        </circle>
      </svg>
      <div className="relay-cards">
        <article className="flow-card source-card">
          <div className="flow-card-head"><span className="agent-glyph opencode-glyph">O</span><div><strong>OpenCode</strong><small>Source session · feature/auth</small></div><span className="source-status">WORKING</span></div>
          <div className="terminal-window"><div className="terminal-title"><span/> <span/> <span/><code>relay / auth-flow</code></div><div className="terminal-command"><b>›</b> finish the sign-in flow</div><div className="source-task"><Check size={13}/><span>Authentication screen</span><em>complete</em></div><div className="source-task pending"><Clock3 size={13}/><span>Redirect after login</span><em>open</em></div><div className="source-files"><FileCode2 size={12}/> 3 files touched <span>src/auth · src/routes</span></div></div>
        </article>
        <article className="flow-card relay-core-card">
          <div className="relay-core-brand"><RelayMark compact/><div><strong>Relay AI</strong><small>continuity engine</small></div></div>
          <div className="core-rule"/>
          <div className={`core-check ${phase !== 'idle' ? 'check-active' : ''}`}><span className="check-seal"><Check size={12}/></span><div><strong>{phase === 'idle' || phase === 'capture' ? 'Task state captured' : 'Task state retained'}</strong><small>unfinished redirect · source: session</small></div></div>
          <div className={`core-check ${phase === 'verify' || phase === 'transfer' || phase === 'ready' ? 'check-active' : ''}`}><span className="check-seal"><ShieldCheck size={12}/></span><div><strong>Repository evidence</strong><small>sample snapshot · main / 3 changed files</small></div></div>
          <div className="core-verdict"><span className="verdict-mark"/>{phase === 'verify' ? 'checking evidence' : phase === 'ready' ? 'reviewed packet' : 'awaiting approval'}<span className="core-stamp">{phase === 'ready' ? 'READY' : phase === 'verify' ? 'CHECK' : 'DRAFT'}</span></div>
        </article>
        <article className="flow-card destination-card">
          <div className="flow-card-head"><span className="agent-glyph codex-glyph">⌘</span><div><strong>Codex</strong><small>Destination session</small></div><span className={`destination-status ${phase === 'ready' ? 'status-ready' : ''}`}>{phase === 'ready' ? 'READY' : 'WAITING'}</span></div>
          <div className={`destination-prompt ${phase === 'ready' ? 'prompt-ready' : ''}`}><span className="prompt-label">CONTEXT FOR THE NEXT SESSION</span><p>{typedText || (phase === 'idle' ? 'The destination is waiting for an approved context packet.' : status)}{phase === 'ready' && <i className="typing-caret" aria-hidden="true"/>}</p></div>
          <div className="destination-foot"><span><LockKeyhole size={12}/> Local handoff preview</span><span>{phase === 'ready' ? '1 packet' : '—'}</span></div>
        </article>
      </div>
    </div>
    <div className="stage-footer"><div className="stage-progress" aria-label={status}><span className={`progress-segment ${phase !== 'idle' ? 'complete' : ''}`}/><span className={`progress-segment ${['verify','transfer','ready'].includes(phase) ? 'complete' : ''}`}/><span className={`progress-segment ${['transfer','ready'].includes(phase) ? 'complete' : ''}`}/><span className={`progress-segment ${phase === 'ready' ? 'complete' : ''}`}/></div><span className="phase-caption">{status}</span><button className="stage-run" onClick={start}>{phase === 'ready' ? 'Run it again' : phase === 'idle' ? 'Run handoff' : 'Restart handoff'} <RefreshCw size={14}/></button></div>
  </div>;
}

export default function LandingPage({ goDashboard }: { goDashboard: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useSectionMotion();
  return <main className="relay-landing" id="main-content">
    <header className="relay-header" id="top"><Wordmark/><nav id="landing-navigation" className={menuOpen ? 'open' : ''} aria-label="Main navigation"><a href="#product" onClick={() => setMenuOpen(false)}>Product</a><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#verification" onClick={() => setMenuOpen(false)}>Verification</a></nav><div className="header-actions"><a className="github-link" href="https://github.com/search?q=Relay+AI+context+continuity&type=repositories" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13}/></a><button className="header-launch" onClick={goDashboard}>Launch dashboard <ArrowRight size={14}/></button></div><button className="mobile-nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="landing-navigation">{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button></header>

    <section className="relay-hero" id="product">
      <div className="hero-editorial"><p className="hero-overline"><span/> BUILT FOR THE MOMENT YOU SWITCH</p><h1><span className="headline-mask"><span>Switch agents.</span></span><span className="headline-mask headline-blue"><span>Keep progress.</span></span></h1><p className="hero-description">The next coding assistant should know what’s done, what’s open, and what the repository can prove.</p><div className="hero-buttons"><button className="primary-action" onClick={goDashboard}>Open Relay workspace <ArrowRight size={16}/></button><a className="secondary-action" href="#walkthrough">Watch a handoff <span>↓</span></a></div><div className="hero-proofline"><span><LockKeyhole size={14}/> Private by default</span><span><GitBranch size={14}/> Evidence from your repo</span></div></div>
      <RelayMotionGraphic/>
    </section>

    <section className="manifesto-section" data-reveal><div className="manifesto-index">A CONTEXT PACKET HAS A PAPER TRAIL</div><div className="manifesto-copy"><h2>Progress moves.<br/><span>Claims keep their source.</span></h2><p>Relay carries the work forward with its origin attached. A task can be a session claim; a file check can be repository evidence. They stay distinct all the way to the next assistant.</p></div><div className="manifesto-ribbon"><span>SESSION MEMORY</span><i/><span>REPOSITORY EVIDENCE</span><i/><span>USER APPROVAL</span><i/><span>DESTINATION CONTEXT</span></div></section>

    <section className="walkthrough-section"><div className="section-heading" data-reveal><div><span className="section-count">01 / THE TRANSFER</span><h2>One task. Three systems.<br/><span>Nothing lost in between.</span></h2></div><p>Run the illustrative walkthrough. The packet is animated only when the handoff advances; it stops at each real stage.</p></div><div className="walkthrough-caption"><span>OPENCODE <i/> RELAY AI <i/> CODEX</span><span>EXAMPLE SESSION · NOT LIVE REPOSITORY DATA</span></div></section>

    <section className="feature-editorial" id="features">
      <div className="feature-lead" data-reveal><span className="section-count">02 / PROJECT MEMORY</span><h2>Memory that<br/>keeps its <span>origin.</span></h2><p>Tasks, decisions, files, and unresolved issues are tied to a project and marked with where they came from.</p><div className="memory-ledger"><div className="ledger-top"><span>PROJECT MEMORY</span><span>03 ITEMS</span></div><div className="ledger-row"><span className="ledger-number">01</span><div><strong>Authentication screen complete</strong><small>Task · OpenCode session</small></div><span className="ledger-tag tag-source">SESSION</span></div><div className="ledger-row"><span className="ledger-number">02</span><div><strong>Login redirect still open</strong><small>Task · status in progress</small></div><span className="ledger-tag tag-open">OPEN</span></div><div className="ledger-row"><span className="ledger-number">03</span><div><strong>src/auth/useSession.ts</strong><small>File reference · repository</small></div><span className="ledger-tag tag-file">FILE</span></div></div></div>
      <div className="feature-proof" id="verification" data-reveal><span className="section-count">03 / REPOSITORY CHECKS</span><div className="verification-art"><div className="verification-art-head"><div><ShieldCheck size={18}/><strong>Evidence check</strong></div><span className="evidence-demo-label">EXAMPLE</span></div><div className="commit-line"><span className="commit-dot"/><div><strong>feature/auth-redirect</strong><small>sample working tree</small></div><code>3 changed</code></div><div className="check-row"><span className="fact-icon fact-good"><Check size={13}/></span><div><strong>File exists in repository</strong><small>src/auth/useSession.ts · observed</small></div><span className="fact-result">VERIFIED</span></div><div className="check-row"><span className="fact-icon fact-warn"><CircleAlert size={13}/></span><div><strong>Redirect is incomplete</strong><small>Session statement · no code proof</small></div><span className="fact-result fact-open">UNVERIFIED</span></div><div className="verify-seal"><span><Check size={12}/></span>Git status alone cannot prove the task is done.</div></div><h2>Check what the repo can show.</h2><p>Relay reads actual Git state and checks specific file references. It does not turn a successful command into blanket verification.</p></div>
      <div className="feature-privacy" data-reveal><span className="section-count">04 / HUMAN APPROVAL</span><div className="approval-art"><div className="approval-stamp">REVIEW BEFORE TRANSFER</div><div className="approval-direction"><span className="mini-agent">O</span><strong>OpenCode</strong><span className="direction-route"/><span className="mini-agent mini-codex">⌘</span><strong>Codex</strong></div><p>3 memory items selected<br/>1 repository observation · 1 unverified claim</p><div className="approval-switch"><span>Include selected context</span><i><b/></i><Check size={13}/></div></div><h2>You choose<br/>what <span>crosses.</span></h2><p>Inspect the context package, review its evidence, and approve it before the destination assistant can load it.</p></div>
    </section>

    <section className="steps-section" id="how"><div className="steps-title" data-reveal><span className="section-count">05 / HOW RELAY WORKS</span><h2>Keep the thread<br/><span>through every switch.</span></h2></div><div className="steps-track"><article data-reveal><span className="step-count">01</span><div className="step-line"><i/></div><h3>Work naturally</h3><p>Use your coding assistant. Save the useful context to the local project memory.</p></article><article data-reveal><span className="step-count">02</span><div className="step-line"><i/></div><h3>Check the evidence</h3><p>Relay inspects current repository state and marks what it can and cannot verify.</p></article><article data-reveal><span className="step-count">03</span><div className="step-line"><i/></div><h3>Approve the handoff</h3><p>Choose what to include. The destination receives the package only after approval.</p></article></div></section>

    <section className="privacy-band-new" data-reveal><div className="privacy-symbol"><LockKeyhole size={22}/></div><div><span>LOCAL FIRST, BY DEFAULT</span><h2>Your project memory stays on your machine.</h2></div><p>Groq enrichment is optional. When requested, redacted context is sent to Groq; the key stays in the local API environment.</p></section>
    <section className="closing-section" data-reveal><div className="closing-path" aria-hidden="true"><span>OPENCODE</span><i/><RelayMark compact/><i/><span>CODEX</span></div><span className="section-count">THE NEXT SESSION STARTS HERE</span><h2>Switch agents.<br/><span>Keep the work.</span></h2><button className="primary-action" onClick={goDashboard}>Launch Relay AI <ArrowRight size={16}/></button></section>
    <footer className="relay-footer"><Wordmark/><span>Switch agents. Keep progress. Verify continuity.</span><a href="#top">Back to top ↑</a><small>© 2026 Relay AI · Local context, verified where possible.</small></footer>
  </main>;
}
