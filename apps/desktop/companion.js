const toggle = document.querySelector('#toggle');
const panel = document.querySelector('#panel');
const widget = document.querySelector('#widget');
let expanded = false;
let lastEventId = '';
let firstState = true;
let collapseTimer;
let expansionSequence = 0;
let workflowOpen = false;
let workflowGeneration = 0;
let draft = null;

async function expand(value) {
  const sequence = ++expansionSequence;
  clearTimeout(collapseTimer);
  expanded = value;
  panel.inert = !value;
  toggle.inert = value;
  panel.setAttribute('aria-hidden', String(!value));
  toggle.setAttribute('aria-expanded', String(value));
  toggle.setAttribute('aria-label', value ? 'Collapse Relay desktop companion' : 'Open Relay desktop companion');
  widget.classList.toggle('expanded', value);
  if (value) {
    await window.relayDesktop.expand(true);
    if (sequence === expansionSequence) requestAnimationFrame(() => {
      if (sequence === expansionSequence) panel.classList.add('is-open');
    });
  } else {
    if (workflowOpen) closeWorkflow();
    panel.classList.remove('is-open');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 220;
    collapseTimer = window.setTimeout(() => {
      if (sequence === expansionSequence) {
        window.relayDesktop.expand(false);
        toggle.focus({ preventScroll: true });
      }
    }, delay);
  }
}

toggle.addEventListener('click', () => expand(!expanded));
document.querySelector('#close').addEventListener('click', () => expand(false));
document.querySelector('#dashboard').addEventListener('click', () => window.relayDesktop.openDashboard());

const workflow = document.querySelector('#switch-workflow');
const monitor = document.querySelector('#monitor-view');
const status = document.querySelector('#workflow-status');
const chatList = document.querySelector('#chat-list');
const context = document.querySelector('#chat-context');
const stages = ['chat-stage', 'review-stage', 'evidence-stage', 'opened-stage'];
function showStage(id) { stages.forEach(stage => { document.querySelector(`#${stage}`).hidden = stage !== id; }); status.textContent = ''; }
function errorMessage(error) { return (error?.message || 'Something went wrong. Please try again.').replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, ''); }
function closeWorkflow() {
  workflowOpen = false; workflowGeneration++;
  workflow.hidden = true; monitor.hidden = false;
  window.relayDesktop.workflow(false);
}
async function loadChats() {
  const generation = ++workflowGeneration;
  showStage('chat-stage'); chatList.replaceChildren(); status.textContent = 'Finding local Codex chats…';
  try {
    const result = await window.relayDesktop.listChats();
    if (!workflowOpen || generation !== workflowGeneration) return;
    status.textContent = result.hasMore ? 'Showing the first 500 chats.' : result.sessions.length ? '' : 'No local Codex chats were found.';
    for (const chat of result.sessions) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'chat-row';
      const symbol = document.createElement('span'); symbol.className = 'chat-symbol'; symbol.textContent = 'C';
      const copy = document.createElement('span'); copy.className = 'chat-copy';
      const title = document.createElement('strong'); title.textContent = chat.title;
      const location = document.createElement('small'); location.textContent = chat.cwd;
      const arrow = document.createElement('span'); arrow.className = 'chat-arrow'; arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
      copy.append(title, location); row.append(symbol, copy, arrow);
      const listItem = document.createElement('div'); listItem.setAttribute('role', 'listitem');
      row.addEventListener('click', () => readChat(chat.id)); listItem.append(row); chatList.append(listItem);
    }
  } catch (error) { if (workflowOpen && generation === workflowGeneration) status.textContent = errorMessage(error); }
}
async function readChat(id) {
  const generation = ++workflowGeneration;
  status.textContent = 'Reading the selected chat locally…';
  for (const button of chatList.querySelectorAll('button')) button.disabled = true;
  try {
    const result = await window.relayDesktop.readChat(id);
    if (!workflowOpen || generation !== workflowGeneration) return;
    context.value = result.text;
    document.querySelector('#review-meta').textContent = `${result.chat.title} · ${result.messageCount} text messages${result.omittedAttachments ? ` · ${result.omittedAttachments} attachments excluded` : ''}`;
    draft = null; showStage('review-stage'); context.focus();
  } catch (error) { if (workflowOpen && generation === workflowGeneration) { status.textContent = errorMessage(error); for (const button of chatList.querySelectorAll('button')) button.disabled = false; } }
}
document.querySelector('#start-switch').addEventListener('click', async () => {
  workflowOpen = true; monitor.hidden = true; workflow.hidden = false;
  await window.relayDesktop.workflow(true); if (workflowOpen) void loadChats();
});
document.querySelector('#back-monitor').addEventListener('click', closeWorkflow);
document.querySelector('#done-switch').addEventListener('click', closeWorkflow);
document.querySelector('#show-handoff-file').addEventListener('click', () => window.relayDesktop.showHandoffFile());
document.querySelector('#refresh-chats').addEventListener('click', loadChats);
document.querySelector('#change-chat').addEventListener('click', loadChats);
document.querySelector('#edit-context').addEventListener('click', () => showStage('review-stage'));
document.querySelector('#prepare-chat').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; status.textContent = 'Saving the reviewed text locally and checking the repository…';
  try {
    const result = await window.relayDesktop.prepareChat(context.value);
    if (!workflowOpen) return;
    draft = result; const evidenceList = document.querySelector('#draft-evidence'); evidenceList.replaceChildren();
    for (const evidence of result.evidence || []) {
      const row = document.createElement('div'); row.className = `evidence-row ${evidence.status === 'conflict' ? 'conflict' : ''}`;
      const label = document.createElement('b'); label.textContent = evidence.status;
      const detail = document.createElement('span'); detail.textContent = evidence.description;
      row.append(label, detail); evidenceList.append(row);
    }
    const conflicts = (result.evidence || []).some(item => item.status === 'conflict');
    document.querySelector('#evidence-meta').textContent = `${result.title} · ${result.verification} verification`;
    document.querySelector('#evidence-note').textContent = conflicts ? 'Resolve the conflicts in the repository and prepare the handoff again.' : 'Repository observations do not verify every chat claim. Approval opens OpenCode, which may send this context to its configured model provider.';
    document.querySelector('#launch-opencode').disabled = conflicts;
    showStage('evidence-stage');
  } catch (error) { if (workflowOpen) status.textContent = errorMessage(error); }
  finally { button.disabled = false; }
});
document.querySelector('#launch-opencode').addEventListener('click', async event => {
  if (!draft) return;
  const button = event.currentTarget; button.disabled = true; status.textContent = 'Approving and opening OpenCode…';
  try { await window.relayDesktop.openOpenCode(draft.id); if (workflowOpen) showStage('opened-stage'); }
  catch (error) { if (workflowOpen) { status.textContent = errorMessage(error); button.disabled = false; } }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') expand(false);
  if (event.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const delta = event.shiftKey ? 36 : 16;
    const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0;
    const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0;
    window.relayDesktop.moveBy(dx, dy);
  }
});

function prettyAgent(value = '') {
  const key = value.toLowerCase();
  return key === 'opencode' ? 'OpenCode' : key === 'codex' ? 'Codex' : value || 'Agent';
}

const iconMarkup = {
  opencode: '<img src="./assets/opencode.svg" alt="">',
  codex: '<img src="./assets/codex.png" alt="">',
  generic: '<svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v9H4z"/><path d="M8 13h8"/></svg>'
};

function setAgentIcon(id, name) {
  const key = name.toLowerCase().includes('opencode') ? 'opencode' : name.toLowerCase().includes('codex') ? 'codex' : 'generic';
  const icon = document.querySelector(`#${id}`);
  icon.className = `agent-icon ${key}`;
  icon.innerHTML = iconMarkup[key];
}

function setStepState(status) {
  const steps = [...document.querySelectorAll('.step')];
  const progress = status === 'loaded' ? 3 : status === 'approved' ? 2 : status === 'draft' ? 1 : 0;
  steps.forEach((step, index) => {
    step.classList.toggle('complete', index < progress);
    step.classList.toggle('current', index === progress - 1 && progress > 0 && progress < 3);
  });
  document.querySelectorAll('.step-line').forEach((line, index) => line.classList.toggle('complete', index < progress - 1));
}

function setHandoff(handoff, isEvent) {
  const route = document.querySelector('#route');
  const stateChip = document.querySelector('#handoff-state');
  if (!handoff) {
    route.classList.remove('route--draft', 'route--approved', 'route--loaded', 'handoff-arrival');
    stateChip.textContent = 'STANDING BY';
    stateChip.className = 'handoff-state';
    document.querySelector('#panel-title').textContent = 'A thread, carried forward.';
    document.querySelector('#panel-subtitle').textContent = 'Relay listens locally and waits for your next approved handoff.';
    document.querySelector('#handoff-title').textContent = 'No handoff in progress';
    document.querySelector('#handoff-meta').textContent = 'When a package is loaded, its route and verification appear here.';
    document.querySelector('#item-count').textContent = '—';
    document.querySelector('#verified-mark').textContent = '?';
    document.querySelector('#verified-mark').className = 'verified';
    document.querySelector('#destination-state').textContent = 'DESTINATION';
    setStepState('');
    return;
  }

  const status = String(handoff.status || '').toLowerCase();
  const verification = String(handoff.verification || '').toLowerCase();
  route.classList.remove('route--draft', 'route--approved', 'route--loaded');
  route.classList.add(`route--${status}`);
  document.querySelector('#source-name').textContent = prettyAgent(handoff.source);
  document.querySelector('#destination-name').textContent = prettyAgent(handoff.destination);
  setAgentIcon('source-icon', handoff.source);
  setAgentIcon('destination-icon', handoff.destination);
  document.querySelector('#handoff-title').textContent = handoff.title || 'Untitled handoff';
  const count = Number(handoff.itemCount) || 0;
  document.querySelector('#item-count').textContent = `${count} ${count === 1 ? 'ITEM' : 'ITEMS'}`;
  const statusLabel = status === 'loaded' ? 'Loaded in destination' : status === 'approved' ? 'Approved · waiting for destination' : 'Draft · review required';
  const verificationLabel = handoff.verification ? `${handoff.verification} verification` : 'verification not recorded';
  document.querySelector('#handoff-meta').textContent = `${statusLabel} · ${verificationLabel}`;
  document.querySelector('#panel-title').textContent = isEvent ? 'Context made the switch.' : status === 'loaded' ? 'Your last handoff landed.' : status === 'approved' ? 'Approved and ready to move.' : 'A handoff is taking shape.';
  document.querySelector('#panel-subtitle').textContent = `${prettyAgent(handoff.source)} → Relay → ${prettyAgent(handoff.destination)}`;
  document.querySelector('#source-state').textContent = `${prettyAgent(handoff.source).toUpperCase()} · SOURCE`;
  document.querySelector('#destination-state').textContent = status === 'loaded' ? 'CONTEXT RECEIVED' : 'DESTINATION';
  stateChip.textContent = `${status.toUpperCase()} · ${verification.toUpperCase() || 'UNVERIFIED'}`;
  stateChip.className = `handoff-state ${verification === 'partial' || verification === 'conflict' || verification === 'stale' ? 'verification-warn' : ''}`;
  const mark = document.querySelector('#verified-mark');
  mark.textContent = verification === 'verified' ? '✓' : verification === 'partial' ? '½' : verification === 'conflict' || verification === 'stale' ? '!' : '?';
  mark.className = `verified ${verification === 'verified' ? 'is-verified' : verification === 'partial' || verification === 'conflict' || verification === 'stale' ? 'is-warning' : ''}`;
  setStepState(status);
}

window.relayDesktop.onState(state => {
  if (firstState) {
    firstState = false;
    expand(true);
  }
  const online = Boolean(state.online);
  document.querySelector('#status-dot').classList.toggle('online', online);
  document.querySelector('#panel-dot').classList.toggle('online', online);
  document.querySelector('#presence-label').textContent = online ? 'RELAY IS LISTENING LOCALLY' : 'LOCAL SERVICE DISCONNECTED';
  const handoff = state.event || state.recent;
  const status = String(handoff?.status || '').toLowerCase();
  const summary = status === 'loaded' ? 'Handoff delivered' : status === 'approved' ? 'Handoff approved' : status === 'draft' ? 'Draft ready for review' : `${state.projectCount} local project${state.projectCount === 1 ? '' : 's'} · listening`;
  document.querySelector('#capsule-status').textContent = online ? summary : state.notice;
  document.querySelector('#local-status').innerHTML = online ? '<i class="status-dot online"></i> Relay service connected · loopback' : '<i class="status-dot"></i> Relay service unavailable';
  setHandoff(handoff, Boolean(state.event));

  if (state.event) {
    const eventId = `${state.event.title}-${state.event.createdAt}`;
    if (eventId !== lastEventId) {
      lastEventId = eventId;
      const route = document.querySelector('#route');
      route.classList.remove('handoff-arrival');
      requestAnimationFrame(() => route.classList.add('handoff-arrival'));
      widget.classList.remove('arrival-pulse');
      requestAnimationFrame(() => widget.classList.add('arrival-pulse'));
      window.setTimeout(() => widget.classList.remove('arrival-pulse'), 800);
      expand(true);
    }
  }
});
