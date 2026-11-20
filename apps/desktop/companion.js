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
let activeHandoffId = '';
let handoffProgress = null;
let launchMode = 'terminal';

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
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
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
  document.querySelector('#dashboard').addEventListener('click', () => {
    void window.relayDesktop.openDashboard().catch(error => {
      document.querySelector('#local-status').textContent = errorMessage(error);
    });
  });

const workflow = document.querySelector('#switch-workflow');
const monitor = document.querySelector('#monitor-view');
const status = document.querySelector('#workflow-status');
const chatList = document.querySelector('#chat-list');
const chatSearch = document.querySelector('#chat-search');
const context = document.querySelector('#chat-context');
const stages = ['chat-stage', 'review-stage', 'evidence-stage', 'opened-stage'];
const stepLabels = document.querySelectorAll('.workflow-steps li');
const retryOpenCode = document.querySelector('#retry-opencode');
const reviewReceipt = document.querySelector('#review-receipt');
function showStage(id) {
  const index = stages.indexOf(id);
  stages.forEach((stage, position) => {
    document.querySelector(`#${stage}`).hidden = position !== index;
    stepLabels[position].toggleAttribute('data-complete', position < index);
    if (position === index) stepLabels[position].setAttribute('aria-current', 'step');
    else stepLabels[position].removeAttribute('aria-current');
  });
  status.textContent = '';
}

function renderHandoffProgress(progress) {
  if (!progress) return;
  const retrieved = progress.phase === 'retrieved' && progress.status === 'loaded';
  const title = document.querySelector('#retrieval-title');
  const copy = document.querySelector('#retrieval-copy');
  const opened = document.querySelector('#opened-stage');
  opened.classList.toggle('retrieved', retrieved);
  retryOpenCode.hidden = !(progress.phase === 'error' && progress.retryAvailable);
  retryOpenCode.disabled = false;
  reviewReceipt.hidden = !retrieved && !(progress.phase === 'error' && !progress.retryAvailable);
  reviewReceipt.textContent = retrieved ? 'Open handoff receipt' : 'Open Relay dashboard for recovery';
  if (retrieved) {
    title.textContent = 'Context retrieved';
    copy.textContent = 'OpenCode retrieved the approved package. You can inspect Relay’s receipt in the dashboard.';
  } else if (progress.phase === 'error') {
    title.textContent = progress.retryAvailable ? 'OpenCode needs another attempt' : 'Handoff could not continue';
    copy.textContent = progress.error || (progress.retryAvailable
      ? 'Relay could not complete the connection. Retry to open OpenCode again.'
      : 'Relay could not continue this handoff. Open the dashboard for recovery guidance.');
  } else if (progress.phase === 'starting') {
    title.textContent = 'Starting OpenCode';
    copy.textContent = 'Relay is preparing the approved handoff and opening the project.';
  } else if (progress.phase === 'server-ready') {
    title.textContent = 'OpenCode is ready';
    copy.textContent = 'Relay is registering the approved handoff tool for this project.';
  } else if (progress.phase === 'connecting' || progress.connection === 'connecting' || progress.connection === 'pending') {
    title.textContent = 'Connecting the handoff';
    copy.textContent = 'OpenCode is connecting to Relay’s local handoff tool. No context is marked received yet.';
  } else {
    title.textContent = 'Waiting for OpenCode';
    copy.textContent = progress.launchMode === 'desktop'
      ? 'OpenCode Desktop opened at the project. Start a session and ask: “Load my approved Relay handoff.” Relay will confirm only after retrieval.'
      : progress.connection === 'connected'
        ? 'The Relay tool is connected. Allow it if prompted, then ask OpenCode to retrieve the approved context.'
        : 'OpenCode launched. Waiting for Relay to confirm its local connection and context retrieval.';
  }
  if (retrieved) stepLabels[3].setAttribute('data-complete', '');
}

retryOpenCode.addEventListener('click', async () => {
  const handoffId = activeHandoffId;
  if (!handoffId || !handoffProgress?.retryAvailable) return;
  retryOpenCode.disabled = true;
  document.querySelector('#retrieval-title').textContent = 'Retrying OpenCode';
  document.querySelector('#retrieval-copy').textContent = 'Relay is reopening the same approved handoff.';
  try {
    const result = await window.relayDesktop.openOpenCode(handoffId, handoffProgress.launchMode || launchMode);
    if (!result.opened) {
      retryOpenCode.disabled = false;
      document.querySelector('#retrieval-copy').textContent = 'Retry canceled. The approved package is still available in Relay.';
    } else document.querySelector('#retrieval-copy').textContent = 'OpenCode relaunched. Waiting for Relay to confirm the connection and context retrieval.';
  } catch (error) {
    retryOpenCode.disabled = false;
    document.querySelector('#retrieval-title').textContent = 'OpenCode needs another attempt';
    document.querySelector('#retrieval-copy').textContent = errorMessage(error);
  }
});

reviewReceipt.addEventListener('click', () => {
  void window.relayDesktop.openDashboard().catch(error => {
    document.querySelector('#retrieval-copy').textContent = errorMessage(error);
  });
});

chatSearch.addEventListener('input', () => {
  const query = chatSearch.value.trim().toLocaleLowerCase();
  let matches = 0;
  for (const row of chatList.children) {
    const visible = row.dataset.search.includes(query);
    row.hidden = !visible;
    if (visible) matches++;
  }
  status.textContent = matches ? `${matches} chat${matches === 1 ? '' : 's'} available.` : 'No chats match your search.';
});
function errorMessage(error) { return (error?.message || 'Something went wrong. Please try again.').replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, ''); }
function closeWorkflow() {
  workflowOpen = false; workflowGeneration++;
  workflow.hidden = true; monitor.hidden = false;
  window.relayDesktop.workflow(false);
  if (expanded) document.querySelector('#start-switch').focus();
}
async function loadChats() {
  const generation = ++workflowGeneration;
  showStage('chat-stage'); chatList.replaceChildren();
  chatSearch.value = ''; chatSearch.disabled = true; chatList.setAttribute('aria-busy', 'true');
  status.textContent = 'Finding local Codex chats…';
  try {
    const result = await window.relayDesktop.listChats();
    if (!workflowOpen || generation !== workflowGeneration) return;
    chatSearch.disabled = !result.sessions.length;
    status.textContent = result.hasMore ? 'Showing the first 500 chats.' : result.sessions.length ? '' : 'No local Codex chats found. Start a chat in Codex, then refresh here.';
    for (const chat of result.sessions) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'chat-row';
      const symbol = document.createElement('span'); symbol.className = 'chat-symbol'; symbol.textContent = 'C';
      const copy = document.createElement('span'); copy.className = 'chat-copy';
      const title = document.createElement('strong'); title.textContent = chat.title;
      const location = document.createElement('small'); location.textContent = chat.cwd;
      const arrow = document.createElement('span'); arrow.className = 'chat-arrow'; arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
      copy.append(title, location); row.append(symbol, copy, arrow);
      const listItem = document.createElement('div'); listItem.setAttribute('role', 'listitem');
      listItem.dataset.search = `${chat.title} ${chat.cwd}`.toLocaleLowerCase();
      row.addEventListener('click', () => readChat(chat.id)); listItem.append(row); chatList.append(listItem);
    }
  } catch (error) { if (workflowOpen && generation === workflowGeneration) status.textContent = errorMessage(error); }
  finally { if (generation === workflowGeneration) chatList.removeAttribute('aria-busy'); }
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
document.querySelector('#all-agents').addEventListener('click', () => {
  void window.relayDesktop.openDashboard(true).catch(error => {
    document.querySelector('#local-status').textContent = errorMessage(error);
  });
});
document.querySelector('#start-switch').addEventListener('click', async () => {
  workflowOpen = true; monitor.hidden = true; workflow.hidden = false;
  document.querySelector('#back-monitor').focus();
  await window.relayDesktop.workflow(true); if (workflowOpen) void loadChats();
});
document.querySelector('#back-monitor').addEventListener('click', closeWorkflow);
document.querySelector('#done-switch').addEventListener('click', closeWorkflow);
document.querySelector('#refresh-chats').addEventListener('click', loadChats);
document.querySelector('#change-chat').addEventListener('click', loadChats);
document.querySelector('#edit-context').addEventListener('click', () => { showStage('review-stage'); context.focus(); });
document.querySelector('#prepare-chat').addEventListener('click', async event => {
  const generation = workflowGeneration;
  const button = event.currentTarget; button.disabled = true; status.textContent = 'Saving the reviewed text locally and checking the repository…';
  try {
    const result = await window.relayDesktop.prepareChat(context.value);
    if (!workflowOpen || generation !== workflowGeneration) return;
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
    document.querySelector(conflicts ? '#edit-context' : '#launch-opencode').focus();
  } catch (error) { if (workflowOpen && generation === workflowGeneration) status.textContent = errorMessage(error); }
  finally { button.disabled = false; }
});
document.querySelectorAll('input[name="launch-mode"]').forEach(input => input.addEventListener('change', event => {
  launchMode = event.currentTarget.value;
  document.querySelector('#launch-opencode').innerHTML = `${launchMode === 'desktop' ? 'Approve and open Desktop app' : 'Approve and open Terminal'} <span aria-hidden="true">→</span>`;
}));
document.querySelector('#launch-opencode').addEventListener('click', async event => {
  if (!draft) return;
  const generation = workflowGeneration;
  const button = event.currentTarget; button.disabled = true; status.textContent = `Approving and opening OpenCode ${launchMode === 'desktop' ? 'Desktop app' : 'in Terminal'}…`;
    try {
      activeHandoffId = draft.id;
      handoffProgress = null;
      const result = await window.relayDesktop.openOpenCode(draft.id, launchMode);
      if (!workflowOpen || generation !== workflowGeneration) return;
      if (result.opened) {
        showStage('opened-stage');
        document.querySelector('#retrieval-title').focus();
        if (handoffProgress?.handoffId === activeHandoffId) renderHandoffProgress(handoffProgress);
        else {
          document.querySelector('#retrieval-title').textContent = 'OpenCode launched';
          document.querySelector('#retrieval-copy').textContent = launchMode === 'desktop'
            ? 'OpenCode Desktop opened at the project. Start a session and ask: “Load my approved Relay handoff.” Relay confirms only after retrieval.'
            : 'Waiting for Relay to confirm the connection and context retrieval.';
        }
      } else { activeHandoffId = ''; status.textContent = 'Approval canceled. Your draft is still available.'; button.disabled = false; }
    }
  catch (error) {
    if (workflowOpen && generation === workflowGeneration) {
      if (handoffProgress?.handoffId === activeHandoffId && handoffProgress.phase === 'error') {
        showStage('opened-stage');
        renderHandoffProgress(handoffProgress);
      } else status.textContent = errorMessage(error);
      button.disabled = false;
    }
  }
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

function setAgentRoute(source, destination) {
  const sourceName = prettyAgent(source);
  const destinationName = prettyAgent(destination);
  document.querySelector('#source-name').textContent = sourceName;
  document.querySelector('#destination-name').textContent = destinationName;
  document.querySelector('#source-state').textContent = `${sourceName.toUpperCase()} · SOURCE`;
  document.querySelector('#destination-state').textContent = 'DESTINATION';
  document.querySelector('#route').setAttribute('aria-label', `Handoff route from ${sourceName} through Relay to ${destinationName}`);
  setAgentIcon('source-icon', sourceName);
  setAgentIcon('destination-icon', destinationName);
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
    setAgentRoute('codex', 'opencode');
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
    setStepState('');
    return;
  }

  const status = String(handoff.status || '').toLowerCase();
  const verification = String(handoff.verification || '').toLowerCase();
  route.classList.remove('route--draft', 'route--approved', 'route--loaded');
  route.classList.add(`route--${status}`);
  setAgentRoute(handoff.source, handoff.destination);
  document.querySelector('#handoff-title').textContent = handoff.title || 'Untitled handoff';
  const count = Number(handoff.itemCount) || 0;
  document.querySelector('#item-count').textContent = `${count} ${count === 1 ? 'ITEM' : 'ITEMS'}`;
  const statusLabel = status === 'loaded' ? 'Retrieved by destination' : status === 'approved' ? 'Approved · waiting for destination' : 'Draft · review required';
  const verificationLabel = handoff.verification ? `${handoff.verification} verification` : 'verification not recorded';
  document.querySelector('#handoff-meta').textContent = `${statusLabel} · ${verificationLabel}`;
  document.querySelector('#panel-title').textContent = isEvent ? 'Handoff retrieved.' : status === 'loaded' ? 'Your last handoff was retrieved.' : status === 'approved' ? 'Approved and ready to move.' : 'A handoff is taking shape.';
  document.querySelector('#panel-subtitle').textContent = `${prettyAgent(handoff.source)} → Relay → ${prettyAgent(handoff.destination)}`;
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
  widget.classList.toggle('connected', online);
  document.querySelector('#status-dot').classList.toggle('online', online);
  document.querySelector('#panel-dot').classList.toggle('online', online);
  document.querySelector('#presence-label').textContent = online ? 'RELAY IS LISTENING LOCALLY' : 'LOCAL SERVICE DISCONNECTED';
  const handoff = state.event || state.recent;
  const opened = document.querySelector('#opened-stage');
  const progress = state.handoffProgress;
  if (progress && (!activeHandoffId || progress.handoffId === activeHandoffId)) {
    activeHandoffId = progress.handoffId;
    handoffProgress = progress;
    if (!opened.hidden) renderHandoffProgress(progress);
    else if (workflowOpen && (progress.status === 'approved' || progress.status === 'loaded')) {
      showStage('opened-stage');
      renderHandoffProgress(progress);
    }
  }
  if (handoff?.id && handoff.id === activeHandoffId && handoff.status === 'loaded' && !opened.hidden) {
    renderHandoffProgress({ handoffId: handoff.id, status: 'loaded', phase: 'retrieved', connection: 'connected', retryAvailable: false });
  }
  const status = String(handoff?.status || '').toLowerCase();
  const summary = status === 'loaded' ? 'Handoff retrieved' : status === 'approved' ? 'Handoff approved' : status === 'draft' ? 'Draft ready for review' : `${state.projectCount} local project${state.projectCount === 1 ? '' : 's'} · listening`;
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
