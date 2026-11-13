import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleAlert, Clock3, Code2, Command, Database, FileCode2, GitBranch, GitCommitHorizontal, Layers3, LockKeyhole, Menu, Network, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import LandingPage from './Landing';

type Project = { id: string; name: string; rootPath: string; updatedAt: string; repository?: string };
type MemoryItem = { id: string; projectId: string; kind: string; content: string; status?: string; source: string; evidence: { kind: string; status: string; description: string; path?: string; source: string }[]; createdAt: string };
type Handoff = { id: string; projectId?: string; title: string; summary?: string; source: string; destination: string; verification: string; evidence?: { kind: string; status: string; description: string; source: string }[]; memoryItemIds?: string[]; createdAt: string; status: string };
type HandoffReceipt = { handoffId: string; destination: string; approvedItemIds: string[]; repositorySnapshot?: string; evidence: { kind: string; status: string; description: string; source: string }[]; retrievedAt: string | null; retrievalCount: number };
const env = (import.meta as any).env;
const API = env?.VITE_RELAY_API ?? (env?.DEV ? '/api/v1' : 'http://127.0.0.1:4317/api/v1');

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark${small ? ' brand-mark-small' : ''}`} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 10.5h8.5a5.5 5.5 0 0 1 0 11H5v-5.8h8.5a.8.8 0 1 0 0-1.6H5z" fill="currentColor"/><path d="M27 21.5h-8.5a5.5 5.5 0 0 1 0-11H27v5.8h-8.5a.8.8 0 1 0 0 1.6H27z" fill="currentColor"/><path d="M11 16h10" stroke="#F8F8F5" strokeWidth="2"/></svg></span>;
}

function Wordmark() { return <a className="wordmark" href="#top" aria-label="Relay AI home"><span className="relay-logo-crop"><img src="/relay-logo.png" alt="" /></span></a>; }

function SectionGlyph({ name }: { name: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'Overview': return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 13.5v3.5l2 1.4"/><circle cx="17" cy="17" r="3.5"/></svg>;
    case 'Projects': return <svg {...common}><path d="M3.5 7.5h6l2 2h9v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 9.5v-2a2 2 0 0 1 2-2h4l2 2"/><path d="M9 14h4m0 0-1.7-1.7M13 14l-1.7 1.7"/><circle cx="17.5" cy="14" r="1.5"/></svg>;
    case 'Context explorer': return <svg {...common}><path d="M5 4.5h11l3 3v5"/><path d="M16 4.5v3h3"/><path d="M5 4.5v14a2 2 0 0 0 2 2h4"/><path d="M8 10h7M8 13h5"/><circle cx="16.5" cy="16.5" r="3.5"/><path d="m19 19 2 2"/></svg>;
    case 'Handoff studio': return <svg {...common}><rect x="3.5" y="5" width="5" height="5" rx="1.3"/><rect x="15.5" y="14" width="5" height="5" rx="1.3"/><path d="M8.5 7.5h5a3 3 0 0 1 3 3v3.5"/><path d="m14 12 2.5 2.5L19 12"/><path d="M8 17.5h3"/><circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/></svg>;
    case 'Verification': return <svg {...common}><path d="M12 3.5 19 6v5.2c0 4.2-2.8 7.4-7 9.3-4.2-1.9-7-5.1-7-9.3V6z"/><path d="m8.5 11.8 2.2 2.2 4.8-4.8"/><path d="M8 7.2h3"/></svg>;
    default: return <svg {...common}><path d="M4 6.5h16M4 12h16M4 17.5h16"/><circle cx="9" cy="6.5" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="11" cy="17.5" r="2" fill="var(--surface)"/></svg>;
  }
}

function AgentIcon({ name }: { name: string }) { return <span className={`agent-icon ${name.toLowerCase().includes('claude') ? 'claude' : name.toLowerCase().includes('codex') ? 'codex' : 'generic'}`} aria-hidden="true">{name.toLowerCase().includes('claude') ? 'C' : name.toLowerCase().includes('codex') ? '⌘' : '⌁'}</span>; }

function RelayDemo() {
  const [stage, setStage] = useState(0);
  const stages = ['Source session', 'Capturing context', 'Checking repository', 'Ready for Codex'];
  const run = () => setStage(s => s >= 3 ? 0 : s + 1);
  return <section className="demo-shell" aria-label="Interactive context relay demonstration" data-ui>
    <div className="demo-topline"><span><span className="live-dot"/> INTERACTIVE PREVIEW</span><span className="demo-tag">SIMULATED · NO REPOSITORY CONNECTED</span></div>
    <div className="demo-flow">
      <article className={`agent-pane source-pane ${stage === 0 ? 'pane-active' : ''}`}>
        <div className="pane-heading"><AgentIcon name="OpenCode"/><div><strong>OpenCode</strong><small>Source session</small></div><span className="pane-state">{stage > 0 ? 'captured' : 'working'}</span></div>
        <div className="session-title"><span className="mono-label">SESSION / AUTH-142</span><strong>Finish the sign-in flow</strong></div>
        <div className="task-list"><div className="task done"><Check size={14}/><span>Authentication UI completed</span></div><div className="task pending"><Clock3 size={14}/><span>Login redirect pending</span></div></div>
        <div className="file-stack"><span className="mono-label">3 FILES TOUCHED</span><code><FileCode2 size={13}/> src/auth/LoginForm.tsx</code><code><FileCode2 size={13}/> src/auth/useSession.ts</code><code><FileCode2 size={13}/> src/routes.ts</code></div>
        <div className="git-note"><GitBranch size={14}/><span>Working tree has local changes</span><span className="git-count">+3</span></div>
      </article>
      <div className={`relay-node ${stage > 0 ? 'relay-active' : ''}`}>
        <div className="relay-mark"><Mark small/></div><strong>Relay</strong><span>{stages[stage]}</span>
        <div className="relay-track"><i className={stage > 0 ? 'track-on' : ''}/><i className={stage > 1 ? 'track-on' : ''}/><i className={stage > 2 ? 'track-on' : ''}/></div>
      </div>
      <article className={`agent-pane destination-pane ${stage === 3 ? 'pane-active' : ''}`}>
        <div className="pane-heading"><AgentIcon name="Codex"/><div><strong>Codex</strong><small>Destination assistant</small></div><span className={`pane-state ${stage === 3 ? 'state-ready' : ''}`}>{stage === 3 ? 'ready' : 'waiting'}</span></div>
        <div className="destination-empty">
          {stage === 3 ? <><span className="ready-check"><Check size={17}/></span><strong>Context package prepared</strong><p>Task state, modified files, and the pending redirect are ready to continue.</p></> : <><span className="packet-icon"><Layers3 size={19}/></span><strong>Waiting for handoff</strong><p>Approved context appears here with its verification status and evidence.</p></>}
        </div>
        <div className="destination-footer"><span><ShieldCheck size={14}/> {stage === 3 ? 'Example Git check' : 'No context loaded'}</span><span className="mono-label">{stage === 3 ? 'DEMO' : '—'}</span></div>
      </article>
    </div>
    <div className="demo-bottom"><div className="demo-step"><span className="step-bar"><i style={{ width: `${stage * 33.333}%` }}/></span><span>{stages[stage]}</span></div><button className="demo-action" onClick={run}>{stage === 3 ? 'Replay demo' : stage === 0 ? 'Relay this context' : 'Continue'} {stage === 3 ? <RefreshCw size={14}/> : <ArrowRight size={14}/>}</button></div>
  </section>;
}

function Landing({ goDashboard }: { goDashboard: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <main id="top" className="landing">
    <header className="site-header"><Wordmark/><nav id="main-navigation" className={mobileOpen ? 'nav-open' : ''} aria-label="Main navigation"><a href="#product" onClick={() => setMobileOpen(false)}>Product</a><a href="#how" onClick={() => setMobileOpen(false)}>How it works</a><a href="#features" onClick={() => setMobileOpen(false)}>Features</a><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13}/></a></nav><button className="nav-cta" onClick={goDashboard}>Launch dashboard <ArrowUpRight size={14}/></button><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} aria-controls="main-navigation">{mobileOpen ? <X/> : <Menu/>}</button></header>
    <section className="hero" id="product"><div className="hero-copy"><p className="hero-kicker"><span className="kicker-line"/> CONTEXT CONTINUITY FOR DEVELOPERS</p><h1>Switch agents.<br/><span>Keep everything<br/>that matters.</span></h1><p className="hero-sub">Your project context shouldn’t disappear when you change AI coding assistants. Relay captures, verifies, and carries your progress forward.</p><div className="hero-actions"><a className="button-primary" href="#demo">Explore Relay AI <ArrowRight size={16}/></a><a className="button-quiet" href="#how">See how it works <ArrowDown size={15}/></a></div><div className="hero-proof"><span><ShieldCheck size={15}/> Git-backed evidence</span><span><LockKeyhole size={14}/> Local-first by design</span></div></div><div className="hero-visual"><div className="visual-caption"><span>THE CONTEXT RELAY</span><span>OPENCODE → CODEX</span></div><div className="route-illustration"><div className="route-node route-source"><AgentIcon name="OpenCode"/><span>OpenCode</span></div><div className="route-line"><i/><i/><i/></div><div className="route-core"><Mark small/><span>Relay AI</span><Check size={12}/></div><div className="route-line route-line-end"><i/><i/><i/></div><div className="route-node route-destination"><AgentIcon name="Codex"/><span>Codex</span></div></div><div className="visual-payload"><span>TRANSFER PACKAGE</span><span className="payload-chip"><Check size={12}/> Task state</span><span className="payload-chip"><GitCommitHorizontal size={12}/> Git evidence</span><span className="payload-chip"><FileCode2 size={12}/> Relevant files</span><span className="payload-chip payload-secure"><LockKeyhole size={12}/> Reviewed locally</span></div></div></section>
    <div className="demo-anchor" id="demo"><div className="section-intro"><span className="eyebrow">A HANDOFF, IN MOTION</span><p>See what travels with the task.<br/>And what gets checked along the way.</p></div><RelayDemo/></div>
    <section className="problem-section"><div className="problem-label"><span className="eyebrow">THE CONTEXT GAP</span><span className="problem-index">01 / 03</span></div><div className="problem-content"><h2>Every switch used to start with a recap.</h2><div className="problem-bottom"><p>Decisions stay in one thread. Unfinished work stays in another. The next assistant gets a blank slate—and you become the missing integration.</p><div className="gap-diagram" aria-label="Project context fragmented across coding assistant sessions"><span className="gap-agent"><AgentIcon name="OpenCode"/>OpenCode<br/><small>decisions · progress</small></span><span className="broken-path" aria-hidden="true">···</span><span className="gap-agent muted-agent"><AgentIcon name="Codex"/>Codex<br/><small>new session · no context</small></span><span className="gap-caption">THE THREAD BREAKS HERE</span></div></div></div></section>
    <section className="features-section" id="features"><div className="features-heading"><span className="eyebrow">WHAT RELAY CARRIES</span><h2>Continuity you<br/>can inspect.</h2><p>Structured project memory with provenance, repository evidence, and a clear approval step.</p></div><div className="feature-list">
      <article className="feature-row"><div className="feature-copy"><span className="feature-number">01</span><h3>Memory with a source.</h3><p>Tasks, decisions, files, and open questions stay attached to their project, timestamp, and origin.</p></div><div className="feature-visual memory-visual" data-ui><div className="memory-header"><Database size={15}/><span>EXAMPLE PROJECT MEMORY</span><span className="memory-count">sample records</span></div><div className="memory-row"><span className="memory-mark complete-mark"><Check size={12}/></span><div><strong>Auth screen is complete</strong><small>Task · from OpenCode</small></div><span className="record-state">DONE</span></div><div className="memory-row"><span className="memory-mark pending-mark"><Clock3 size={12}/></span><div><strong>Redirect after login</strong><small>Open task · from session</small></div><span className="record-state amber-state">OPEN</span></div><div className="memory-row"><span className="memory-mark file-mark"><FileCode2 size={12}/></span><div><strong>src/auth/useSession.ts</strong><small>File reference · repository</small></div><span className="record-state">FILE</span></div></div></article>
      <article className="feature-row reverse-row"><div className="feature-copy"><span className="feature-number">02</span><h3>Evidence beside the claim.</h3><p>Git status and file checks help show what still matches the working tree. Anything else stays marked as unverified.</p></div><div className="feature-visual evidence-visual" data-ui><div className="evidence-title"><ShieldCheck size={17}/><strong>Example repository check</strong><span>illustrative</span></div><div className="evidence-check"><span className="evidence-dot verified-dot"><Check size={11}/></span><div><strong>LoginForm.tsx exists</strong><small>Sample repository observation</small></div><span className="evidence-label">OBSERVED</span></div><div className="evidence-check"><span className="evidence-dot unverified-dot">?</span><div><strong>Redirect is unfinished</strong><small>Claim from session memory</small></div><span className="evidence-label unverified-label">UNVERIFIED</span></div><div className="evidence-foot"><GitBranch size={13}/> example Git status · illustrative</div></div></article>
      <article className="feature-row"><div className="feature-copy"><span className="feature-number">03</span><h3>You approve what leaves.</h3><p>Review the package, remove anything sensitive, and approve its destination. Local project memory stays on your machine.</p></div><div className="feature-visual approval-visual" data-ui><div className="approval-head"><span>EXAMPLE HANDOFF</span><span className="approval-id">DEMO</span></div><div className="approval-route"><AgentIcon name="OpenCode"/><span>OpenCode</span><span className="approval-arrow"><ArrowRight size={14}/></span><AgentIcon name="Codex"/><span>Codex</span></div><div className="approval-fields"><div><span>INCLUDED</span><strong>3 context items</strong></div><div><span>EVIDENCE</span><strong><ShieldCheck size={13}/> Partial verification</strong></div></div><div className="approval-footer"><span><LockKeyhole size={13}/> Review before transfer</span><button type="button" aria-label="Example approval button">Approve handoff <ArrowRight size={13}/></button></div></div></article>
    </div></section>
    <section className="how-section" id="how"><div className="how-heading"><span className="eyebrow">THREE STEPS, NO RECAP</span><h2>Pick up where<br/>you left off.</h2></div><div className="how-steps"><article><span className="how-step">01</span><div className="how-step-art"><Code2 size={21}/><span>your coding assistant</span></div><h3>Work naturally.</h3><p>Stay in the assistant and editor you already use.</p></article><article><span className="how-step">02</span><div className="how-step-art verify-art"><Network size={21}/><span>memory + repo evidence</span></div><h3>Capture and verify.</h3><p>Relay structures project context and checks repository facts.</p></article><article><span className="how-step">03</span><div className="how-step-art destination-art"><Command size={21}/><span>approved handoff</span></div><h3>Continue anywhere.</h3><p>Approve a relevant package for a supported destination agent.</p></article></div></section>
    <section className="privacy-band"><div><LockKeyhole size={17}/><span>YOUR PROJECT MEMORY</span></div><p>Local by default.<br/><strong>Yours to inspect and control.</strong></p><span className="privacy-note">Groq enrichment is optional.<br/>The key stays server-side.</span></section>
    <section className="closing-cta"><span className="eyebrow">KEEP THE THREAD</span><h2>Your progress<br/>should move with you.</h2><button className="button-primary" onClick={goDashboard}>Launch Relay AI <ArrowRight size={16}/></button><div className="cta-route" aria-hidden="true"><span>OPENCODE</span><i/><Mark small/><i/><span>CODEX</span></div></section>
    <footer className="site-footer"><Wordmark/><span>Switch agents. Keep progress. Verify continuity.</span><a href="#top">Back to top <ArrowUpRight size={13}/></a><small>© 2026 Relay AI · Context belongs to your project.</small></footer>
  </main>;
}

function Dashboard({ goHome }: { goHome: () => void }) {
  const [tab, setTab] = useState('Overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [projectHandoffs, setProjectHandoffs] = useState<Handoff[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [activeHandoff, setActiveHandoff] = useState<Handoff | null>(null);
  const [handoffReceipt, setHandoffReceipt] = useState<HandoffReceipt | null>(null);
  const [handoffItems, setHandoffItems] = useState<MemoryItem[]>([]);
  const [includedIds, setIncludedIds] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<{ checkedAt: string; evidence: { kind: string; status: string; description: string; source: string }[]; conflicts: string[] } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftKind, setDraftKind] = useState('task');
  const [draftStatus, setDraftStatus] = useState('in-progress');
  const [handoffTitle, setHandoffTitle] = useState('');
  const [handoffQuery, setHandoffQuery] = useState('');
  const [handoffSource, setHandoffSource] = useState('opencode');
  const [handoffDestination, setHandoffDestination] = useState('codex');
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serviceState, setServiceState] = useState<'ok' | 'offline'>('offline');
  const [extractionProvider, setExtractionProvider] = useState<'groq' | 'local'>('local');
  const [error, setError] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const observedHandoffStatus = useRef(new Map<string, string>());

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [health, p] = await Promise.all([fetch(`${API}/health`), fetch(`${API}/projects`)]);
      if (!health.ok || !p.ok) throw new Error('The local service returned an error.');
      const healthInfo = await health.json(); setExtractionProvider(healthInfo.intelligenceProvider === 'groq' ? 'groq' : 'local');
      const pj = await p.json(); setProjects(Array.isArray(pj) ? pj : pj.projects ?? []); setServiceState('ok');
      if (!selectedProjectId && (Array.isArray(pj) ? pj : pj.projects ?? []).length) setSelectedProjectId((Array.isArray(pj) ? pj : pj.projects)[0].id);
      const recent = await Promise.all((Array.isArray(pj) ? pj : pj.projects ?? []).slice(0, 4).map(async (project: Project) => {
        const response = await fetch(`${API}/projects/${encodeURIComponent(project.id)}/handoffs`);
        if (!response.ok) return [];
        const data = await response.json(); return Array.isArray(data) ? data : data.handoffs ?? [];
      }));
      const knownHandoffs = recent.flat();
      knownHandoffs.forEach((handoff: Handoff) => observedHandoffStatus.current.set(handoff.id, handoff.status));
      setHandoffs(knownHandoffs.slice(0, 5));
    } catch (e) { setServiceState('offline'); setError(e instanceof Error ? e.message : 'Could not reach the local service.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const submitProject = async (e: React.FormEvent) => {
    e.preventDefault(); if (!projectName.trim() || !projectPath.trim()) return;
    setSaving(true); setError('');
    try {
      const r = await fetch(`${API}/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectName.trim(), rootPath: projectPath.trim() }) });
      if (!r.ok) { const body = await r.json().catch(() => ({})); throw new Error(body.error?.message ?? 'Could not add this project.'); }
      const created = await r.json(); setProjects(p => [created, ...p]); setSelectedProjectId(created.id); setProjectName(''); setProjectPath(''); setShowConnect(false); setTab('Projects');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add this project.'); }
    finally { setSaving(false); }
  };

  const chooseProject = async (id: string) => {
    setSelectedProjectId(id); setMemoryItems([]); setVerifyResult(null); setError('');
    if (!id) return;
    try { const response = await fetch(`${API}/projects/${encodeURIComponent(id)}/memory`); if (!response.ok) throw new Error('Could not load project memory.'); setMemoryItems(await response.json()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load project memory.'); }
  };
  useEffect(() => {
    if (tab !== 'Context explorer' || !selectedProjectId) return;
    void fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/memory`).then(async response => {
      if (!response.ok) throw new Error('Could not load project memory.');
      setMemoryItems(await response.json());
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not load project memory.'));
  }, [tab, selectedProjectId]);
  useEffect(() => {
    if (tab !== 'Handoff studio' || !selectedProjectId) return;
    void fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/handoffs`).then(async response => {
      if (!response.ok) throw new Error('Could not load saved handoffs.');
      setProjectHandoffs(await response.json());
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not load saved handoffs.'));
  }, [tab, selectedProjectId]);
  useEffect(() => {
    let stopped = false;
    setHandoffReceipt(null);
    if (!activeHandoff || activeHandoff.status !== 'loaded') return;
    void fetch(`${API}/handoffs/${encodeURIComponent(activeHandoff.id)}/receipt`).then(async response => {
      if (!response.ok) throw new Error('Could not load the handoff receipt.');
      const receipt = await response.json();
      if (!stopped) setHandoffReceipt(receipt);
    }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : 'Could not load the handoff receipt.'); });
    return () => { stopped = true; };
  }, [activeHandoff?.id, activeHandoff?.status]);
  useEffect(() => {
    if (serviceState !== 'ok' || !selectedProjectId) return;
    let stopped = false;
    const refreshHandoffActivity = async () => {
      try {
        const response = await fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/handoffs`);
        if (!response.ok) return;
        const current: Handoff[] = await response.json();
        if (stopped) return;
        current.forEach(handoff => {
          const previous = observedHandoffStatus.current.get(handoff.id);
          observedHandoffStatus.current.set(handoff.id, handoff.status);
        });
        setProjectHandoffs(current);
        const currentById = new Map(current.map(handoff => [handoff.id, handoff]));
        setActiveHandoff(previous => previous ? currentById.get(previous.id) ?? previous : previous);
        setHandoffs(previous => {
          return previous.map(handoff => currentById.get(handoff.id) ?? handoff);
        });
      } catch { /* keep the last-known activity when the local service is temporarily unavailable */ }
    };
    void refreshHandoffActivity();
    const timer = window.setInterval(() => void refreshHandoffActivity(), 3500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [selectedProjectId, serviceState]);
  const reviewHandoff = async (handoff: Handoff) => {
    setWorking(true); setError(''); setActiveHandoff(handoff); setHandoffTitle(handoff.title); setHandoffSource(handoff.source); setHandoffDestination(handoff.destination);
    try {
      const response = await fetch(`${API}/projects/${encodeURIComponent(handoff.projectId ?? selectedProjectId)}/memory`);
      if (!response.ok) throw new Error('Could not load this handoff’s saved context.');
      const items: MemoryItem[] = await response.json();
      setHandoffItems(items.filter(item => handoff.memoryItemIds?.includes(item.id)));
      setIncludedIds(handoff.memoryItemIds ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this handoff’s saved context.'); }
    finally { setWorking(false); }
  };
  const saveMemory = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedProjectId || !draftText.trim()) return;
    setWorking(true); setError('');
    try {
      const response = await fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: draftKind, content: draftText.trim(), status: draftKind === 'task' || draftKind === 'issue' ? draftStatus : undefined, source: 'user' }) });
      const item = await response.json(); if (!response.ok) throw new Error(item.error?.message ?? 'Could not save memory.');
      setDraftText(''); await chooseProject(selectedProjectId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save memory.'); }
    finally { setWorking(false); }
  };
  const createHandoff = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedProjectId) return;
    setWorking(true); setError('');
    try {
      const response = await fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/handoffs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: handoffSource, destination: handoffDestination, title: handoffTitle.trim() || undefined, query: handoffQuery.trim() || undefined }) });
      const handoff = await response.json(); if (!response.ok) throw new Error(handoff.error?.message ?? 'Could not prepare a handoff.');
      const memoryResponse = await fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/memory`); const allItems: MemoryItem[] = await memoryResponse.json();
      const included = allItems.filter(item => handoff.memoryItemIds?.includes(item.id));
      observedHandoffStatus.current.set(handoff.id, handoff.status);
      setActiveHandoff(handoff); setHandoffItems(included); setIncludedIds(included.map(item => item.id)); setHandoffTitle(''); setHandoffs(prev => [handoff, ...prev]); setProjectHandoffs(prev => [handoff, ...prev.filter(item => item.id !== handoff.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare a handoff.'); }
    finally { setWorking(false); }
  };
  const approveHandoff = async () => {
    if (!activeHandoff) return;
    setWorking(true); setError('');
    try {
      const response = await fetch(`${API}/handoffs/${encodeURIComponent(activeHandoff.id)}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ includeItemIds: includedIds }) });
      const updated = await response.json(); if (!response.ok) throw new Error(updated.error?.message ?? 'Could not approve handoff.');
      observedHandoffStatus.current.set(updated.id, updated.status);
      setActiveHandoff(updated); setHandoffs(prev => prev.map(h => h.id === updated.id ? updated : h)); setProjectHandoffs(prev => prev.map(h => h.id === updated.id ? updated : h));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not approve handoff.'); }
    finally { setWorking(false); }
  };
  const loadHandoff = async () => {
    if (!activeHandoff) return;
    setWorking(true); setError('');
    try {
      const response = await fetch(`${API}/handoffs/${encodeURIComponent(activeHandoff.id)}/context?destination=${encodeURIComponent(activeHandoff.destination)}`);
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Could not load this handoff.');
      observedHandoffStatus.current.set(payload.handoff.id, payload.handoff.status);
      setActiveHandoff(payload.handoff); setHandoffItems(payload.items); setHandoffs(prev => prev.map(h => h.id === payload.handoff.id ? payload.handoff : h)); setProjectHandoffs(prev => prev.map(h => h.id === payload.handoff.id ? payload.handoff : h));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load this handoff.';
      setError(message);
    }
    finally { setWorking(false); }
  };
  const runVerification = async () => {
    if (!selectedProjectId) return;
    setWorking(true); setError('');
    try { const response = await fetch(`${API}/projects/${encodeURIComponent(selectedProjectId)}/verification`); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? 'Repository check failed.'); setVerifyResult(result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Repository check failed.'); }
    finally { setWorking(false); }
  };

  const sections = ['Overview', 'Projects', 'Context explorer', 'Handoff studio', 'Verification', 'Settings'];
  const statusCopy = serviceState === 'ok' ? 'Local service connected' : 'Local service offline';
  return <div className="dashboard">
    <aside className={`sidebar ${showMobileNav ? 'sidebar-open' : ''}`}><div className="sidebar-top"><div className="sidebar-brand"><Wordmark/><button onClick={goHome} aria-label="Return to landing page"><ArrowLeft size={14}/></button></div><div className="workspace-picker"><span className="workspace-avatar">R</span><span><strong>Local workspace</strong><small>Relay AI</small></span><ChevronDown size={14}/></div><div className="side-label">WORKSPACE</div><nav id="dashboard-nav" aria-label="Workspace navigation">{sections.map(s => <button key={s} onClick={() => { setTab(s); setShowMobileNav(false); }} className={tab === s ? 'side-link active' : 'side-link'} aria-current={tab === s ? 'page' : undefined}><span className="side-icon"><SectionGlyph name={s}/></span>{s}{s === 'Handoff studio' && <span className="side-beta">NEW</span>}</button>)}</nav></div><div className="sidebar-bottom"><div className="service-status"><span className={serviceState === 'ok' ? 'status-dot online' : 'status-dot'}/><div><strong>{statusCopy}</strong><small>{serviceState === 'ok' ? '127.0.0.1 · local only' : 'Start the local Relay service'}</small></div></div><button className="sidebar-help" onClick={() => setTab('Settings')}><CircleAlert size={14}/> Service & privacy settings</button></div></aside>
    {showMobileNav && <button className="mobile-scrim" onClick={() => setShowMobileNav(false)} aria-label="Close navigation"/>}
    <main className="dash-main" id="main-content"><header className="dash-topbar"><button className="dash-menu" onClick={() => setShowMobileNav(true)} aria-label="Open navigation" aria-expanded={showMobileNav} aria-controls="dashboard-nav"><Menu/></button><span className="breadcrumb">Workspace <span>/</span> {tab}</span><div className="topbar-actions"><span className={`connection-label ${serviceState}`}><i/> {serviceState === 'ok' ? 'Connected' : 'Disconnected'}</span><button className="icon-button" onClick={() => void load()} aria-label="Refresh data"><RefreshCw size={15}/></button><span className="user-avatar">R</span></div></header>
      <div className="dash-content"><div className="dash-pagehead"><div><span className="eyebrow">RELAY AI / LOCAL WORKSPACE</span><h1>{tab}</h1><p>{tab === 'Overview' ? 'Your projects and their latest continuity state.' : `Manage ${tab.toLowerCase()} for your local projects.`}</p></div><button className="button-primary compact-button" onClick={() => setShowConnect(true)}>Add project <ArrowRight size={14}/></button></div>
        {error && <div className="service-error" role="status"><CircleAlert size={16}/><div><strong>{serviceState === 'offline' ? 'Can’t reach the local Relay service' : 'Request failed'}</strong><span>{error}</span></div><button onClick={() => void load()}>Retry</button></div>}
        {loading ? <div className="dash-loading"><span className="loading-line"/><span className="loading-line short"/><span className="loading-line"/></div> : <>
           {tab === 'Overview' && <><section className="metric-row"><div><span>ACTIVE PROJECTS</span><strong>{projects.length}</strong><small>Registered locally</small></div><div><span>RECENT HANDOFFS</span><strong>{handoffs.length}</strong><small>Recorded by Relay</small></div><div><span>CONNECTED AGENTS</span><strong>—</strong><small>Configure through MCP</small></div><div><span>VERIFICATION</span><strong className="metric-word">{serviceState === 'ok' ? 'Ready' : 'Offline'}</strong><small>Live repository checks</small></div></section><div className="dash-grid"><section className="dash-panel projects-panel"><div className="panel-title"><div><h2>Projects</h2><p>Repositories registered with this local service</p></div><button onClick={() => setTab('Projects')}>View all <ArrowRight size={13}/></button></div>{projects.length === 0 ? <EmptyState icon={<Code2 size={19}/>} title="No projects connected" text="Add a local repository to start collecting project context." action="Add a project" onAction={() => setShowConnect(true)}/> : <div className="project-table">{projects.slice(0, 5).map(p => <button className="project-row" key={p.id} onClick={() => setTab('Projects')}><span className="project-icon"><GitBranch size={15}/></span><span className="project-info"><strong>{p.name}</strong><code>{p.rootPath}</code></span><span className="project-updated">{new Date(p.updatedAt).toLocaleDateString()}</span><ArrowRight size={14}/></button>)}</div>}</section><section className="dash-panel handoffs-panel"><div className="panel-title"><div><h2>Recent handoffs</h2><p>Live status from Relay and MCP</p></div><button onClick={() => setTab('Handoff studio')}>Open studio <ArrowRight size={13}/></button></div>{handoffs.length === 0 ? <EmptyState icon={<Network size={19}/>} title="Nothing handed off yet" text="Create and review a context package when you're ready to switch agents." action="Open handoff studio" onAction={() => setTab('Handoff studio')}/> : handoffs.map(h => <button type="button" className="handoff-row" key={h.id} onClick={() => { setTab('Handoff studio'); void reviewHandoff(h); }}><span className="handoff-icon"><ArrowRight size={15}/></span><span><strong>{h.title}</strong><small>{h.source} → {h.destination} · {h.status}</small></span><span className={`handoff-status ${h.verification}`}>{h.verification}</span></button>)}</section></div><section className="continuity-strip"><div className="continuity-symbol"><Mark small/></div><div><strong>Context stays on this machine.</strong><p>Relay stores project memory locally. Only approved context is included in a handoff.</p></div><button onClick={() => setTab('Settings')}>Privacy settings <ArrowRight size={13}/></button></section></>}
          {tab === 'Projects' && <section className="dash-panel full-panel"><div className="panel-title"><div><h2>Registered repositories</h2><p>Local paths available for context capture and verification</p></div></div>{projects.length === 0 ? <EmptyState icon={<Code2 size={19}/>} title="No local projects yet" text="Register a repository to give Relay a project boundary for context and Git checks." action="Add a project" onAction={() => setShowConnect(true)}/> : projects.map(p => <button className="project-row" key={p.id} onClick={() => { void chooseProject(p.id); setTab('Context explorer'); }}><span className="project-icon"><GitBranch size={15}/></span><span className="project-info"><strong>{p.name}</strong><code>{p.rootPath}</code></span><span className="project-updated">Updated {new Date(p.updatedAt).toLocaleString()}</span><ArrowRight size={14}/></button>)}</section>}
          {tab === 'Context explorer' && <section className="dash-panel full-panel"><div className="panel-title"><div><h2>Project intelligence</h2><p>Memory items retain their source and verification state.</p></div>{projects.length > 0 && <select aria-label="Choose a project" value={selectedProjectId} onChange={e => void chooseProject(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>{projects.length ? <><form className="inline-memory-form" onSubmit={saveMemory}><div className="memory-form-controls"><select aria-label="Memory type" value={draftKind} onChange={e => setDraftKind(e.target.value)}><option value="task">Task</option><option value="decision">Decision</option><option value="issue">Issue</option><option value="file">File</option><option value="note">Note</option></select>{(draftKind === 'task' || draftKind === 'issue') && <select aria-label="Memory status" value={draftStatus} onChange={e => setDraftStatus(e.target.value)}><option value="in-progress">In progress</option><option value="open">Open</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select>}</div><label className="visually-hidden" htmlFor="memory-content">Project memory</label><textarea id="memory-content" value={draftText} onChange={e => setDraftText(e.target.value)} placeholder="Record a decision, task, file reference, or unresolved issue…" required/><button className="button-primary compact-button" disabled={working || !draftText.trim()}>{working ? 'Saving…' : 'Save memory'} <ArrowRight size={13}/></button></form><div className="memory-explorer-list">{memoryItems.length ? memoryItems.map(item => <article className="memory-explorer-row" key={item.id}><span className="memory-kind-mark"><Database size={15}/></span><div><strong>{item.content}</strong><small>{item.kind} · {item.source}{item.status ? ` · ${item.status}` : ''} · {new Date(item.createdAt).toLocaleString()}</small>{item.evidence?.length > 0 && <small>{item.evidence.length} evidence record(s); inspect status before relying on them</small>}</div><span className="record-state">{item.evidence?.some(e => e.status === 'verified') ? 'EVIDENCE' : 'UNVERIFIED'}</span></article>) : <div className="empty-note">No memory items saved for this project yet.</div>}</div></> : <EmptyState icon={<Database size={19}/>} title="No projects connected" text="Add a local repository first. Memory appears here after it has been captured." action="Add a project" onAction={() => setShowConnect(true)}/>}</section>}
          {tab === 'Handoff studio' && <section className="dash-panel full-panel"><div className="panel-title"><div><h2>Prepare a context handoff</h2><p>Review the source, destination, included context, and evidence before approval.</p></div></div>{projects.length ? <>{projectHandoffs.length > 0 && <div className="handoff-queue"><div className="handoff-queue-heading"><strong>Saved packages</strong><span>Review drafts created in Relay or through MCP.</span></div>{projectHandoffs.slice(0, 6).map(handoff => <button key={handoff.id} type="button" className="handoff-queue-row" onClick={() => void reviewHandoff(handoff)}><span className="handoff-queue-title">{handoff.title}</span><span className="handoff-queue-route">{handoff.source} <ArrowRight size={12}/> {handoff.destination}</span><span className={`handoff-queue-state ${handoff.verification}`}>{handoff.status} · {handoff.verification}</span></button>)}</div>}<form className="handoff-form" onSubmit={createHandoff}><label>Project<select aria-label="Handoff project" value={selectedProjectId || projects[0].id} onChange={e => setSelectedProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>From<select aria-label="Source agent" value={handoffSource} onChange={e => setHandoffSource(e.target.value)}><option value="opencode">OpenCode</option><option value="codex">Codex</option><option value="other">Other</option></select></label><label>To<select aria-label="Destination agent" value={handoffDestination} onChange={e => setHandoffDestination(e.target.value)}><option value="codex">Codex</option><option value="opencode">OpenCode</option><option value="other">Other</option></select></label><label className="handoff-title-field">Package title<input value={handoffTitle} onChange={e => setHandoffTitle(e.target.value)} placeholder="Continue the current task"/></label><label className="handoff-title-field">Focus query<input value={handoffQuery} onChange={e => setHandoffQuery(e.target.value)} placeholder="Optional: narrow relevant memory"/></label><button className="button-primary compact-button" disabled={working || handoffSource === handoffDestination}>{working ? 'Preparing…' : 'Build draft package'} <ArrowRight size={13}/></button></form>{activeHandoff ? <div className="handoff-review"><div className="handoff-review-head"><div><span className="eyebrow">HANDOFF REVIEW · {activeHandoff.status.toUpperCase()}</span><h3>{activeHandoff.title}</h3></div><span className={`handoff-status ${activeHandoff.verification}`}>{activeHandoff.verification}</span></div><p className="handoff-summary">{activeHandoff.summary || 'No saved context matched this package yet.'}</p><div className="review-items">{handoffItems.length ? handoffItems.map(item => <label className="review-item" key={item.id}><input type="checkbox" disabled={activeHandoff.status !== 'draft'} checked={includedIds.includes(item.id)} onChange={e => setIncludedIds(ids => e.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))}/><span><strong>{item.content}</strong><small>{item.kind} · {item.source} · {item.status ?? 'open'}</small></span></label>) : <p className="empty-note">This draft has no matching memory. Add context in Context Explorer, then build another draft.</p>}</div><div className="review-evidence"><strong>Repository evidence</strong>{(activeHandoff.evidence ?? []).length ? activeHandoff.evidence!.map((e, i) => <p key={i}><span className={`evidence-state ${e.status}`}>{e.status}</span> {e.description}</p>) : <p>No repository evidence was collected.</p>}</div>{activeHandoff.status === 'loaded' && <div className="review-evidence continuity-receipt"><strong>Proof of continuity · retrieval receipt</strong><p>{handoffReceipt ? `${handoffReceipt.retrievalCount} retrieval ${handoffReceipt.retrievalCount === 1 ? 'request' : 'requests'} · ${handoffReceipt.approvedItemIds.length} approved context items · ${handoffReceipt.destination}` : 'Loading retrieval receipt…'}</p>{handoffReceipt?.repositorySnapshot && <p>{handoffReceipt.repositorySnapshot}</p>}<small>This records Relay returning the approved package. It does not confirm the model understood the context.</small></div>}<div className="review-actions">{activeHandoff.status === 'draft' ? <button className="button-primary compact-button" onClick={() => void approveHandoff()} disabled={working}>Approve selected context <Check size={14}/></button> : activeHandoff.status === 'approved' ? <button className="button-primary compact-button" onClick={() => void loadHandoff()} disabled={working}>Preview approved context <ArrowRight size={14}/></button> : <span className="loaded-confirmation"><Check size={15}/> Package retrieval recorded · {handoffReceipt?.retrievedAt ? new Date(handoffReceipt.retrievedAt).toLocaleString() : new Date(activeHandoff.createdAt).toLocaleString()}</span>}</div></div> : <div className="empty-note">Build a draft to inspect its selected context and repository evidence before approval.</div>}</> : <EmptyState icon={<Network size={19}/>} title="Connect a project first" text="Relay needs a registered repository to prepare a project-scoped handoff." action="Add a project" onAction={() => setShowConnect(true)}/>}</section>}
          {tab === 'Verification' && <section className="dash-panel full-panel"><div className="panel-title"><div><h2>Evidence and conflicts</h2><p>Repository observations are kept separate from assistant and model claims.</p></div><span className={`verification-pill ${serviceState}`}>{serviceState === 'ok' ? 'SERVICE READY' : 'SERVICE OFFLINE'}</span></div>{projects.length ? <><div className="verification-controls"><select aria-label="Repository to verify" value={selectedProjectId || projects[0].id} onChange={e => setSelectedProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="button-primary compact-button" onClick={() => void runVerification()} disabled={working}>{working ? 'Checking…' : 'Check repository'} <RefreshCw size={13}/></button></div>{verifyResult ? <div className="evidence-results"><p>Checked {new Date(verifyResult.checkedAt).toLocaleString()} · {verifyResult.conflicts.length} conflict(s)</p>{verifyResult.conflicts.map((c, i) => <p className="conflict-line" key={i}><CircleAlert size={14}/>{c}</p>)}{verifyResult.evidence.map((e, i) => <article className="evidence-result-row" key={i}><span className={`evidence-state ${e.status}`}>{e.status}</span><div><strong>{e.kind}</strong><p>{e.description}</p><small>Source: {e.source}</small></div></article>)}</div> : <div className="verification-empty"><ShieldCheck size={21}/><strong>No repository check run yet</strong><p>Select a project and check its current Git state. A successful Git command does not verify every memory claim.</p></div>}</> : <EmptyState icon={<ShieldCheck size={19}/>} title="No repository evidence yet" text="Live evidence only appears after a repository is registered and checked." action="Add a project" onAction={() => setShowConnect(true)}/>}</section>}
          {tab === 'Settings' && <section className="settings-list"><Setting title="Local service" detail={serviceState === 'ok' ? `Connected at ${API}` : `Not reachable at ${API}`} state={serviceState === 'ok' ? 'Connected' : 'Offline'}/><Setting title="Desktop companion" detail="Run npm run desktop from the repository root to show the Relay agent in the Windows tray and on your desktop." state="Separate app"/><Setting title="Project storage" detail="Project memory is stored by the local Relay service." state="Local"/><Setting title="MCP integrations" detail="OpenCode project config and Codex MCP entry are set up." state="Configured"/><Setting title="Context extraction" detail={extractionProvider === 'groq' ? 'Groq is configured on the local API. Requested context is redacted before transmission; local extraction remains available if Groq is unavailable.' : 'Local extraction is active. Add GROQ_API_KEY to apps/api/.env to enable Groq enrichment.'} state={extractionProvider === 'groq' ? 'Groq configured' : 'Local only'}/><Setting title="Context transfer" detail="A handoff requires explicit review and approval." state="Approval required"/></section>}
        </>}</div>
    </main>
     {showConnect && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowConnect(false); }}><form className="connect-modal" onSubmit={submitProject} aria-labelledby="connect-title"><button type="button" className="modal-close" onClick={() => setShowConnect(false)} aria-label="Close"><X size={17}/></button><span className="eyebrow">LOCAL REPOSITORY</span><h2 id="connect-title">Add a project</h2><p>Relay will scope repository checks to this folder. The path stays on this machine.</p><label>Project name<input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. relay-web" required/></label><label>Absolute repository path<input value={projectPath} onChange={e => setProjectPath(e.target.value)} placeholder="C:\\dev\\my-project" required/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button-quiet" onClick={() => setShowConnect(false)}>Cancel</button><button className="button-primary" disabled={saving || serviceState !== 'ok'}>{saving ? 'Adding…' : 'Register project'} <ArrowRight size={14}/></button></div>{serviceState !== 'ok' && <small className="modal-hint">Start the local Relay service to add a repository.</small>}</form></div>}
  </div>;
}

function EmptyState({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p><button onClick={onAction}>{action} <ArrowRight size={13}/></button></div>;
}
function Setting({ title, detail, state }: { title: string; detail: string; state: string }) { return <div className="setting-row"><div><strong>{title}</strong><p>{detail}</p></div><span>{state}</span></div>; }

export default function App() {
  const [dashboard, setDashboard] = useState(location.hash === '#dashboard');
  useEffect(() => { const onHash = () => setDashboard(location.hash === '#dashboard'); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  const goDashboard = () => { location.hash = 'dashboard'; window.scrollTo(0, 0); };
  const goHome = () => { location.hash = 'top'; window.scrollTo(0, 0); };
  return <><a className="skip-link" href="#main-content">Skip to main content</a>{dashboard ? <Dashboard goHome={goHome}/> : <LandingPage goDashboard={goDashboard}/>}</>;
}
