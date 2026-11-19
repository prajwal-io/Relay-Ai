import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Clock3, Command, Download, FileCode2, GitBranch, LockKeyhole, Menu, RefreshCw, ShieldCheck, Terminal, X } from 'lucide-react';
import { supabase, supabaseConfigured } from './supabase';

type Phase = 'idle' | 'capture' | 'verify' | 'review' | 'transfer' | 'ready';

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
  const packet = useRef<SVGAnimateMotionElement | null>(null);
  const moving = phase === 'capture' || phase === 'verify' || phase === 'transfer';
  const prompt = 'Continue the sign-in redirect in src/auth/useSession.ts. The authentication screen is complete; the redirect is the next task.';

  useEffect(() => {
    if (phase !== 'capture' && phase !== 'verify' && phase !== 'transfer') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) packet.current?.beginElement();
    const next = phase === 'capture' ? 'verify' : phase === 'verify' ? 'review' : 'ready';
    const duration = phase === 'verify' ? 360 : phase === 'capture' ? 700 : 780;
    const timer = window.setTimeout(() => setPhase(next), reduced ? 0 : duration);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const status = {
    idle: 'Start with an unfinished task.',
    capture: 'Collecting the task and file references…',
    verify: 'Checking the sample repository…',
    review: 'Review the evidence, then approve to continue.',
    transfer: 'Sending the approved context to Codex…',
    ready: 'Codex received the approved context.',
  }[phase];

  return <div className={`relay-stage phase-${phase}`} id="walkthrough">
    <div className="stage-topline"><span><i className="stage-live-dot"/> INTERACTIVE HANDOFF</span><span className="simulation-label">SIMULATED</span></div>
    <div className="stage-controls">
      <div className="stage-steps" aria-label="Walkthrough steps">
        <span data-active={phase === 'capture' || phase === 'verify' || phase === 'idle'}>Prepare</span>
        <span data-active={phase === 'review'}>Review</span>
        <span data-active={phase === 'transfer' || phase === 'ready'}>Deliver</span>
      </div>
      <div className="stage-action-row">
        <span className="phase-caption" role="status">{status}</span>
        <button className="stage-run" aria-disabled={moving} onClick={() => { if (!moving) setPhase(phase === 'review' ? 'transfer' : 'capture'); }}>
          {phase === 'ready' ? 'Replay' : phase === 'review' ? 'Approve & send' : moving ? 'In progress' : 'Run handoff'}
          {phase === 'ready' ? <RefreshCw size={14}/> : <ArrowRight size={14}/>}
        </button>
      </div>
    </div>
    <div className="relay-graphic" aria-label="Illustrative context packet moving from OpenCode through Relay AI to Codex">
      <svg className="route-svg" viewBox="0 0 1000 360" preserveAspectRatio="none" aria-hidden="true">
        <path className="route-base" d="M115 180 C265 180 310 180 500 180 S735 180 885 180"/>
        <path className="route-verified" d="M115 180 C265 180 310 180 500 180 S735 180 885 180"/>
        <circle className="route-node-dot" cx="115" cy="180" r="5"/><circle className="route-node-dot" cx="500" cy="180" r="5"/><circle className="route-node-dot" cx="885" cy="180" r="5"/>
        {(phase === 'capture' || phase === 'transfer') && <circle key={phase} className="transfer-packet" cx={phase === 'capture' ? 115 : 500} cy="180" r="7">
          <animateMotion ref={packet} dur={phase === 'capture' ? '.7s' : '.78s'} begin="indefinite" fill="freeze" path="M0 0 C95 0 260 0 385 0"/>
        </circle>}
      </svg>
      <div className="relay-cards">
        <article className="flow-card source-card">
          <div className="flow-card-head"><span className="agent-glyph opencode-glyph"><Terminal size={14} aria-hidden="true"/></span><div><strong>OpenCode</strong><small>Source session</small></div></div>
          <div className="terminal-window"><div className="terminal-title"><span/> <span/> <span/><code>relay / auth-flow</code></div><div className="terminal-command"><b>›</b> finish the sign-in flow</div><div className="source-task"><Check size={13}/><span>Authentication screen</span><em>complete</em></div><div className="source-task pending"><Clock3 size={13}/><span>Redirect after login</span><em>open</em></div><div className="source-files"><FileCode2 size={12}/> 3 files touched <span>src/auth · src/routes</span></div></div>
        </article>
        <article className="flow-card relay-core-card">
          <div className="relay-core-brand"><RelayMark compact/><div><strong>Relay AI</strong><small>continuity engine</small></div></div>
          <div className="core-rule"/>
          <div className={`core-check ${phase !== 'idle' ? 'check-active' : ''}`}><span className="check-seal"><Check size={12}/></span><div><strong>{phase === 'idle' ? 'Session context' : 'Task state captured'}</strong><small>unfinished redirect · source: session</small></div></div>
          <div className={`core-check ${['verify', 'review', 'transfer', 'ready'].includes(phase) ? 'check-active' : ''}`}><span className="check-seal"><ShieldCheck size={12}/></span><div><strong>Repository evidence</strong><small>sample snapshot · main / 3 changed files</small></div></div>
          <div className="core-verdict"><span className="verdict-mark"/>{phase === 'verify' ? 'Checking evidence' : phase === 'review' ? 'Approval required' : phase === 'transfer' || phase === 'ready' ? 'Approved by you' : 'Waiting for context'}<span className="core-stamp">{phase === 'ready' ? 'SENT' : phase === 'transfer' ? 'SENDING' : phase === 'review' ? 'REVIEW' : 'DRAFT'}</span></div>
        </article>
        <article className="flow-card destination-card">
          <div className="flow-card-head"><span className="agent-glyph codex-glyph"><Command size={14} aria-hidden="true"/></span><div><strong>Codex</strong><small>Destination session</small></div></div>
          <div className={`destination-prompt ${phase === 'ready' ? 'prompt-ready' : ''}`}><span className="prompt-label">CONTEXT FOR THE NEXT SESSION</span><p>{phase === 'ready' ? prompt : 'Waiting for approved context.'}</p></div>
          <div className="destination-foot"><span><LockKeyhole size={12}/> Local handoff preview</span><span>{phase === 'ready' ? '1 packet' : '—'}</span></div>
        </article>
      </div>
    </div>
  </div>;
}

export default function LandingPage({ goDashboard }: { goDashboard: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  useSectionMotion();
  useEffect(() => {
    if (!authOpen) return;
    document.getElementById('download-email')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { sessionStorage.removeItem('relay-download-after-auth'); setAuthOpen(false); }
      if (event.key === 'Tab') {
        const controls = [...document.querySelectorAll<HTMLElement>('.auth-dialog button, .auth-dialog input')].filter(item => !item.hasAttribute('disabled'));
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [authOpen]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      if (current && sessionStorage.getItem('relay-download-after-auth') === '1') {
        sessionStorage.removeItem('relay-download-after-auth');
        window.location.assign('https://github.com/prajwal-io/Relay-Ai/releases');
      }
    });
    const stopDesktopCallback = (window as any).relayDesktop?.onAuthCallback?.(({ code, error }: { code?: string; error?: string }) => {
      if (error) { setAuthError(error); return; }
      if (code) void client.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) setAuthError('That sign-in link expired. Request another one.');
      });
    });
    return () => { data.subscription.unsubscribe(); stopDesktopCallback?.(); };
  }, []);

  const requestDownload = () => {
    if (session) { window.location.assign('https://github.com/prajwal-io/Relay-Ai/releases'); return; }
    sessionStorage.setItem('relay-download-after-auth', '1');
    setAuthError(''); setAuthMessage(''); setAuthOpen(true);
  };
  const sendSignInLink = async (event: React.FormEvent) => {
    event.preventDefault(); if (!supabase || !email.trim()) return;
    setAuthBusy(true); setAuthError(''); setAuthMessage('');
    const emailRedirectTo = (window as any).relayDesktop?.isDesktopApp ? 'relay-ai://auth/callback' : `${location.origin}/`;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo } });
    if (error) { setAuthError(error.message); sessionStorage.removeItem('relay-download-after-auth'); }
    else setAuthMessage('Check your inbox. After signing in, you’ll see the GitHub release status; the Windows installer is not published yet.');
    setAuthBusy(false);
  };
  return <main className="relay-landing" id="main-content" tabIndex={-1}>
    <header className="relay-header" id="top"><Wordmark/><nav id="landing-navigation" className={menuOpen ? 'open' : ''} aria-label="Main navigation"><a href="#product" onClick={() => setMenuOpen(false)}>Product</a><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#verification" onClick={() => setMenuOpen(false)}>Verification</a></nav><div className="header-actions"><button className="header-signin" onClick={() => session ? void supabase?.auth.signOut() : (setAuthError(''), setAuthMessage(''), setAuthOpen(true))}>{session ? 'Sign out' : 'Sign in'}</button><button className="header-dashboard" onClick={goDashboard}>Dashboard</button><button className="header-launch" onClick={requestDownload}>Release status <Download size={14}/></button></div><button className="mobile-nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="landing-navigation">{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button></header>

    <section className="relay-hero" id="product">
      <div className="hero-editorial"><h1><span className="headline-mask"><span>Switch agents.</span></span><span className="headline-mask headline-blue"><span>Keep progress.</span></span></h1><p className="hero-description">Pick up where you left off. Relay shows the next assistant what’s done, what’s left, and what the repository confirms.</p><div className="hero-buttons"><button className="primary-action" onClick={requestDownload}>Check release status <ArrowRight size={16}/></button><a className="secondary-action" href="#walkthrough">Try the walkthrough <span aria-hidden="true">↓</span></a></div><p className="release-status"><span>WINDOWS X64 · PRE-RELEASE</span>No installer has been published yet.</p><div className="hero-proofline"><span><LockKeyhole size={14}/> Private by default</span><span><GitBranch size={14}/> Evidence from your repo</span></div></div>
      <RelayMotionGraphic/>
    </section>

    <section className="manifesto-section" data-reveal><div className="manifesto-copy"><h2>A handoff that shows<br/><span>what carries over.</span></h2><p>See the unfinished work and project decisions before you switch. Relay keeps your notes separate from facts it checks in the repository.</p></div><div className="manifesto-ribbon"><span>SESSION MEMORY</span><i/><span>REPOSITORY EVIDENCE</span><i/><span>USER APPROVAL</span><i/><span>DESTINATION CONTEXT</span></div></section>

    <section className="repo-start-section" data-reveal><div><span className="section-kicker">A QUICK START THAT STAYS LOCAL</span><h2>Start with a<br/><span>repository link.</span></h2><p>Paste a public GitHub or GitLab URL. Relay clones it to this computer, reads the README and tracked file list, then keeps its project memory in local SQLite.</p></div><div className="repo-import-preview"><div className="repo-preview-top"><span className="repo-preview-dot"/><span>ADD A PROJECT</span><span className="repo-preview-local"><LockKeyhole size={11}/> ON THIS COMPUTER</span></div><div className="repo-preview-url"><GitBranch size={15}/><code>github.com/team/project</code><Check size={15}/></div><div className="repo-preview-result"><span className="repo-preview-mark"><Check size={14}/></span><div><strong>Project overview ready</strong><small>README · tracked files · repository evidence</small></div><span>LOCAL</span></div></div></section>

    <section className="walkthrough-section"><div className="section-heading" data-reveal><div><h2>Review it once.<br/><span>Then keep working.</span></h2></div><p>See what Relay collects, checks, and shares after you approve.</p></div><div className="walkthrough-caption"><span>OPENCODE <i/> RELAY AI <i/> CODEX</span><span>EXAMPLE SESSION · NOT LIVE REPOSITORY DATA</span></div></section>

    <section className="feature-editorial" id="features">
      <div className="feature-lead" data-reveal><h2>Project notes<br/>with their <span>source.</span></h2><p>Keep tasks, decisions, and open issues together. Relay shows whether each came from a chat, a note, or a repository check.</p><div className="memory-ledger"><div className="ledger-top"><span>PROJECT MEMORY</span><span>03 ITEMS</span></div><div className="ledger-row"><span className="ledger-number">01</span><div><strong>Authentication screen complete</strong><small>Task · OpenCode session</small></div><span className="ledger-tag tag-source">SESSION</span></div><div className="ledger-row"><span className="ledger-number">02</span><div><strong>Login redirect still open</strong><small>Task · status in progress</small></div><span className="ledger-tag tag-open">OPEN</span></div><div className="ledger-row"><span className="ledger-number">03</span><div><strong>src/auth/useSession.ts</strong><small>File reference · repository</small></div><span className="ledger-tag tag-file">FILE</span></div></div></div>
      <div className="feature-proof" id="verification" data-reveal><div className="verification-art"><div className="verification-art-head"><div><ShieldCheck size={18}/><strong>Evidence check</strong></div><span className="evidence-demo-label">EXAMPLE</span></div><div className="commit-line"><span className="commit-dot"/><div><strong>feature/auth-redirect</strong><small>sample working tree</small></div><code>3 changed</code></div><div className="check-row"><span className="fact-icon fact-good"><Check size={13}/></span><div><strong>File exists in repository</strong><small>src/auth/useSession.ts · observed</small></div><span className="fact-result">VERIFIED</span></div><div className="check-row"><span className="fact-icon fact-warn"><CircleAlert size={13}/></span><div><strong>Redirect is incomplete</strong><small>Session statement · no code proof</small></div><span className="fact-result fact-open">UNVERIFIED</span></div><div className="verify-seal"><span><Check size={12}/></span>Git status alone cannot prove the task is done.</div></div><h2>See what the repository confirms.</h2><p>Relay checks current Git state and referenced files. It marks uncertain details instead of calling everything verified.</p></div>
      <div className="feature-privacy" data-reveal><div className="approval-art"><div className="approval-stamp">REVIEW BEFORE TRANSFER</div><div className="approval-direction"><span className="mini-agent">O</span><strong>OpenCode</strong><span className="direction-route"/><span className="mini-agent mini-codex">⌘</span><strong>Codex</strong></div><p>3 memory items selected<br/>1 repository observation · 1 unverified claim</p><div className="approval-switch"><span>Include selected context</span><i><b/></i><Check size={13}/></div></div><h2>Share only<br/>what you <span>approve.</span></h2><p>Review the handoff first. The next assistant can load it only after you approve.</p></div>
    </section>

    <section className="steps-section" id="how"><div className="steps-title" data-reveal><h2>Pick up the work<br/><span>in three steps.</span></h2></div><div className="steps-track"><article data-reveal><span className="step-count">01</span><div className="step-line"><i/></div><h3>Work naturally</h3><p>Work in Codex or OpenCode as usual. Add the useful notes to Relay.</p></article><article data-reveal><span className="step-count">02</span><div className="step-line"><i/></div><h3>Check the evidence</h3><p>Relay checks the repository and flags anything it cannot confirm.</p></article><article data-reveal><span className="step-count">03</span><div className="step-line"><i/></div><h3>Approve the handoff</h3><p>Review and approve the context, then open OpenCode in Terminal or its desktop app. Relay confirms delivery only after OpenCode retrieves it.</p></article></div></section>

    <section className="privacy-band-new" data-reveal><div className="privacy-symbol"><LockKeyhole size={22}/></div><div><span>LOCAL FIRST, BY DEFAULT</span><h2>Your project stays on your computer.</h2></div><p>SQLite stores project memory locally. Optional Supabase account backup saves selected memory and public repo links; it does not upload local paths or source files.</p></section>
    <section className="closing-section" data-reveal><div className="closing-path" aria-hidden="true"><span>OPENCODE</span><i/><RelayMark compact/><i/><span>CODEX</span></div><h2>Switch agents.<br/><span>Keep the work.</span></h2><button className="primary-action" onClick={requestDownload}>Check release status <ArrowRight size={16}/></button></section>
    <footer className="relay-footer"><Wordmark/><span>Switch agents. Keep progress. Verify continuity.</span><a href="#top">Back to top ↑</a><small>© 2026 Relay AI · Local context, verified where possible.</small></footer>
    {authOpen && <div className="auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { sessionStorage.removeItem('relay-download-after-auth'); setAuthOpen(false); } }}><section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={() => { sessionStorage.removeItem('relay-download-after-auth'); setAuthOpen(false); }} aria-label="Close sign in"><X size={17}/></button><span className="section-kicker">RELAY AI ACCOUNT</span><h2 id="auth-title">Sign in or create an account.</h2><p>Enter your email and we’ll send a secure link. After sign-in, you’ll see the GitHub release page. The Windows x64 installer is not published yet.</p>{!supabaseConfigured ? <div className="auth-setup-note" role="status">Email sign-in is not enabled for this site yet. The site owner needs to connect a Supabase project and set its public URL and publishable key.</div> : <form onSubmit={sendSignInLink}><label htmlFor="download-email">Email address</label><input id="download-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required/><button className="primary-action" disabled={authBusy}>{authBusy ? 'Sending link…' : 'Email me a sign-in link'} <ArrowRight size={15}/></button></form>}{authMessage && <p className="auth-message" role="status">{authMessage}</p>}{authError && <p className="auth-error" role="alert">{authError}</p>}<small>New users are created automatically. Downloads will be available after the beta release is published.</small></section></div>}
  </main>;
}
