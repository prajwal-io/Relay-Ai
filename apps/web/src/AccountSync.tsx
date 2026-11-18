import { useEffect, useState } from 'react';
import { ArrowRight, Cloud, LogOut, ShieldCheck } from 'lucide-react';
import { supabase, supabaseConfigured } from './supabase';

type Project = { id: string; name: string; repository?: string };
type SavedMemory = { id: string; kind: string; content: string; status?: string; source: string; updatedAt: string };
const API = (import.meta as any).env?.VITE_RELAY_API ?? ((import.meta as any).env?.DEV ? '/api/v1' : 'http://127.0.0.1:4317/api/v1');

function cloudSafeText(value: string) {
  return value
    .replace(/\b(?:gsk_[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|AIza[\w-]{25,})\b/g, '[REDACTED_SECRET]')
    .replace(/\b(password|token|api[_-]?key|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b[A-Z]:\\(?:[^\s"'<>]+\\?)+/g, '[LOCAL_PATH]')
    .replace(/\/(?:Users|home|private|mnt)\/[^\s"'<>]+/g, '[LOCAL_PATH]');
}

export default function AccountSync({ projects }: { projects: Project[] }) {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, current) => setSession(current));
    const stopAuthCallback = (window as any).relayDesktop?.onAuthCallback?.(({ code, error: authError }: { code?: string; error?: string }) => {
      if (authError) { setError(authError); return; }
      if (code) void client.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) setError('That sign-in link expired. Request a new one.');
      });
    });
    return () => { data.subscription.unsubscribe(); stopAuthCallback?.(); };
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); if (!supabase || !email.trim()) return;
    setBusy(true); setError(''); setMessage('');
    const emailRedirectTo = (window as any).relayDesktop?.isDesktopApp ? 'relay-ai://auth/callback' : `${location.origin}/?next=dashboard`;
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo } });
    if (authError) setError(authError.message);
    else setMessage('Check your email for a sign-in link.');
    setBusy(false);
  };

  const sync = async () => {
    if (!supabase || !session?.user) return;
    setBusy(true); setError(''); setMessage('Saving your project memory…');
    try {
      for (const project of projects) {
        const response = await fetch(`${API}/projects/${encodeURIComponent(project.id)}/memory`);
        if (!response.ok) throw new Error(`Could not read memory for ${project.name}.`);
        const items: SavedMemory[] = await response.json();
        const key = project.repository?.toLowerCase().replace(/\.git$/, '') || `local:${project.id}`;
        const { data: savedProject, error: projectError } = await supabase.from('relay_projects').upsert({
          owner_id: session.user.id, project_key: key, name: project.name, repository_url: project.repository ?? null, updated_at: new Date().toISOString(),
        }, { onConflict: 'owner_id,project_key' }).select('id').single();
        if (projectError) throw projectError;
        if (items.length) {
          const { error: memoryError } = await supabase.from('relay_memory_items').upsert(items.map(item => ({
            owner_id: session.user.id, project_id: savedProject.id, item_key: item.id, kind: item.kind,
            content: cloudSafeText(item.content).slice(0, 8_000), status: item.status ?? null, source: item.source,
            updated_at: item.updatedAt,
          })), { onConflict: 'project_id,item_key' });
          if (memoryError) throw memoryError;
        }
      }
      setMessage(`${projects.length} project${projects.length === 1 ? '' : 's'} and their saved context are synced.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sync your Relay account.');
      setMessage('');
    } finally { setBusy(false); }
  };

  if (!supabaseConfigured) return <section className="account-sync"><div className="account-sync-heading"><span><Cloud size={17}/></span><div><strong>Account backup</strong><small>Optional · local storage still works without an account</small></div><span className="account-sync-state">Not connected</span></div><p>Set the Supabase URL and publishable key to enable email sign-in and private account backup. Keys go in the web build environment; never use a secret key here.</p></section>;

  return <section className="account-sync"><div className="account-sync-heading"><span><Cloud size={17}/></span><div><strong>Account backup</strong><small>{session?.user?.email ?? 'Your work stays on this device until you choose to save a copy.'}</small></div><span className="account-sync-state">{session ? 'Signed in' : 'Local only'}</span></div>
    {!session ? <form className="account-sync-form" onSubmit={signIn}><label htmlFor="account-email">Sign in with email</label><div><input id="account-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required/><button className="button-primary compact-button" disabled={busy}>{busy ? 'Sending…' : 'Email me a link'} <ArrowRight size={13}/></button></div></form> : <div className="account-sync-actions"><p><ShieldCheck size={14}/> Save a private copy of project names, public repo links, and saved memory. Local folder paths and source files stay on this computer.</p><button className="button-primary compact-button" onClick={() => void sync()} disabled={busy || projects.length === 0}>{busy ? 'Saving…' : `Save ${projects.length} project${projects.length === 1 ? '' : 's'} to account`} <Cloud size={13}/></button><button className="button-quiet compact-button" onClick={() => void supabase?.auth.signOut()} disabled={busy}><LogOut size={13}/> Sign out</button></div>}
    {message && <p className="account-sync-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
