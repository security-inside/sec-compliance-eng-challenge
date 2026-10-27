const api = 'http://localhost:8000';
const connectForm = document.querySelector('#connect-form');
const tokenInput = document.querySelector('#viewer-token');
const connectButton = document.querySelector('#connect-button');
const connectStatus = document.querySelector('#connect-status');
const connectTitle = document.querySelector('#connect-title');
const connectDescription = document.querySelector('#connect-description');
const toggleTokenButton = document.querySelector('#toggle-token');
const workspace = document.querySelector('#workspace');
const serverSelect = document.querySelector('#server-select');
const refreshButton = document.querySelector('#refresh-button');
const disconnectButton = document.querySelector('#disconnect-button');
const recordsStatus = document.querySelector('#records-status');
const emptyState = document.querySelector('#empty-state');
const tableWrap = document.querySelector('#table-wrap');
const snapshotRows = document.querySelector('#snapshot-rows');
const snapshotCount = document.querySelector('#snapshot-count');
const availableCount = document.querySelector('#available-count');
const latestDate = document.querySelector('#latest-date');
const latestRelative = document.querySelector('#latest-relative');
const recordsSubtitle = document.querySelector('#records-subtitle');

let viewerToken = '';
let configuredServers = [];

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = type ? `${element === recordsStatus ? 'records-status' : 'connect-status'} is-${type}` : element === recordsStatus ? 'records-status' : 'connect-status';
}

function friendlyError(error) {
  if (error instanceof TypeError) return 'The API could not be reached. Check that the local services are running.';
  const statusCode = Number(error.message.match(/\b(\d{3})\b/)?.[1]);
  if (statusCode === 401) return 'Access was not authorized. Check the viewer token and try again.';
  if (statusCode === 404) return 'The requested server or evidence was not found.';
  if (statusCode >= 500) return 'The service could not complete the request. Try again in a moment.';
  return error.message || 'Something went wrong. Please try again.';
}

async function apiGet(path) {
  const response = await fetch(`${api}${path}`, {
    headers: { Authorization: `Bearer ${viewerToken}` },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
}

function setConnecting(isConnecting) {
  connectButton.disabled = isConnecting;
  connectButton.querySelector('span').textContent = isConnecting ? 'Connecting…' : viewerToken ? 'Reconnect' : 'Connect';
  connectButton.setAttribute('aria-busy', String(isConnecting));
}

function populateServers(servers) {
  serverSelect.replaceChildren();
  if (!servers.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No enabled clients configured';
    serverSelect.append(option);
    serverSelect.disabled = true;
    refreshButton.disabled = true;
    return;
  }

  for (const serverId of servers) {
    const option = document.createElement('option');
    option.value = serverId;
    option.textContent = serverId;
    serverSelect.append(option);
  }
  serverSelect.disabled = false;
  refreshButton.disabled = false;
}

function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function pluralCount(value, singular, plural = `${singular}s`) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

function relativeDate(value) {
  if (!value) return 'No collections yet';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 'Collection time unavailable';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 2592000)} mo ago`;
}

function makeCell(className = '') {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  return cell;
}

function makeStatusPill(status) {
  const normalized = typeof status === 'string' ? status : 'unknown';
  const pill = document.createElement('span');
  pill.className = `status-pill status-${/^[a-z_]+$/.test(normalized) ? normalized : 'unknown'}`;
  pill.textContent = normalized.replaceAll('_', ' ');
  return pill;
}

function makeDigestDetails(digest) {
  if (!digest) {
    const missing = document.createElement('span');
    missing.className = 'digest';
    missing.textContent = 'Not recorded';
    return missing;
  }
  const details = document.createElement('details');
  details.className = 'digest-details';
  const summary = document.createElement('summary');
  summary.textContent = `${digest.slice(0, 14)}…`;
  summary.title = 'Show full SHA-256 digest';
  const code = document.createElement('code');
  code.textContent = digest;
  details.append(summary, code);
  return details;
}

function makeSnapshotRow(snapshot, serverId) {
  const row = document.createElement('tr');

  const collectedCell = makeCell('date-cell');
  const collected = document.createElement('span');
  collected.textContent = formatDate(snapshot.collected_at, { dateStyle: 'medium', timeStyle: 'short' });
  const received = document.createElement('small');
  received.textContent = `Received ${formatDate(snapshot.received_at, { dateStyle: 'medium', timeStyle: 'short' })}`;
  collectedCell.append(collected, received);

  const executionCell = makeCell();
  const execution = document.createElement('code');
  execution.className = 'execution-id';
  execution.textContent = snapshot.execution_id || 'Unknown';
  execution.title = snapshot.execution_id || '';
  executionCell.append(execution);

  const profileCell = makeCell('host-profile-cell');
  const operatingSystem = document.createElement('strong');
  operatingSystem.textContent = [snapshot.os_name, snapshot.os_version].filter(Boolean).join(' · ') || 'Host profile unavailable';
  const hostDetails = document.createElement('small');
  const cpu = snapshot.cpu || {};
  const cpuSummary = [cpu.architecture, cpu.logical_cores !== undefined ? `${cpu.logical_cores} logical cores` : ''].filter(Boolean).join(' · ');
  hostDetails.textContent = [cpuSummary, pluralCount(snapshot.process_count, 'process', 'processes'), pluralCount(snapshot.active_user_count, 'active user', 'active users')].filter(Boolean).join(' · ');
  const agentVersion = document.createElement('small');
  agentVersion.className = 'agent-version';
  agentVersion.textContent = `Agent ${snapshot.agent_version || 'version unavailable'}`;
  profileCell.append(operatingSystem, hostDetails, agentVersion);

  const evidenceCell = makeCell();
  evidenceCell.append(makeStatusPill(snapshot.evidence_status));

  const digestCell = makeCell();
  digestCell.append(makeDigestDetails(snapshot.sha256));

  const actionCell = makeCell('action-cell');
  const download = document.createElement('button');
  download.className = 'download-button';
  download.type = 'button';
  download.textContent = snapshot.csv_available ? '↓  Download CSV' : 'Unavailable';
  download.disabled = !snapshot.csv_available;
  if (snapshot.csv_available) {
    download.setAttribute('aria-label', `Download CSV for execution ${snapshot.execution_id}`);
    download.addEventListener('click', () => downloadCsv(serverId, snapshot.execution_id, download));
  } else {
    download.title = 'Evidence is not currently available or verified';
  }
  actionCell.append(download);

  row.append(collectedCell, executionCell, profileCell, evidenceCell, digestCell, actionCell);
  return row;
}

function renderSnapshots(snapshots, serverId) {
  snapshotRows.replaceChildren();
  snapshotCount.textContent = String(snapshots.length);
  const ready = snapshots.filter(snapshot => snapshot.csv_available).length;
  availableCount.textContent = String(ready);
  latestDate.textContent = snapshots.length
    ? formatDate(snapshots[0].collected_at, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
  latestRelative.textContent = snapshots.length ? relativeDate(snapshots[0].collected_at) : 'No collections yet';
  recordsSubtitle.textContent = `${serverId} · ${snapshots.length} recent ${snapshots.length === 1 ? 'snapshot' : 'snapshots'}`;

  for (const snapshot of snapshots) snapshotRows.append(makeSnapshotRow(snapshot, serverId));
  tableWrap.hidden = snapshots.length === 0;
  emptyState.hidden = snapshots.length > 0;
  if (!snapshots.length) {
    emptyState.querySelector('h3').textContent = 'No snapshots recorded yet';
    emptyState.querySelector('p').textContent = 'This client is enabled, but the API has not received an inventory snapshot from it.';
  } else {
    emptyState.querySelector('h3').textContent = 'No snapshots to show';
    emptyState.querySelector('p').textContent = 'Connect with a viewer token and choose an enabled client to get started.';
  }
}

async function loadSnapshots() {
  const serverId = serverSelect.value;
  if (!viewerToken || !serverId) return;
  refreshButton.disabled = true;
  refreshButton.setAttribute('aria-busy', 'true');
  setStatus(recordsStatus, `Loading snapshots for ${serverId}…`);
  tableWrap.hidden = true;
  emptyState.hidden = true;
  try {
    const response = await apiGet(`/v1/servers/${encodeURIComponent(serverId)}/snapshots`);
    const snapshots = await response.json();
    renderSnapshots(snapshots, serverId);
    setStatus(recordsStatus, snapshots.length ? '' : 'No records found for this client.', 'success');
  } catch (error) {
    setStatus(recordsStatus, friendlyError(error), 'error');
    emptyState.hidden = false;
    emptyState.querySelector('h3').textContent = 'Could not load snapshots';
    emptyState.querySelector('p').textContent = friendlyError(error);
  } finally {
    refreshButton.disabled = configuredServers.length === 0;
    refreshButton.setAttribute('aria-busy', 'false');
  }
}

async function downloadCsv(serverId, executionId, button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Preparing…';
  try {
    const response = await apiGet(`/v1/servers/${encodeURIComponent(serverId)}/snapshots/${encodeURIComponent(executionId)}/csv`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${executionId}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setStatus(recordsStatus, 'CSV downloaded. The API verifies the stored digest before serving evidence.', 'success');
  } catch (error) {
    setStatus(recordsStatus, friendlyError(error), 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

connectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const candidate = tokenInput.value.trim();
  if (!candidate) return;
  viewerToken = candidate;
  configuredServers = [];
  setConnecting(true);
  setStatus(connectStatus, 'Checking access and loading enabled clients…');
  try {
    const response = await apiGet('/v1/servers');
    const payload = await response.json();
    configuredServers = Array.isArray(payload.servers) ? payload.servers : [];
    populateServers(configuredServers);
    workspace.hidden = false;
    tokenInput.value = '';
    connectForm.hidden = true;
    document.querySelector('#connect-card').classList.add('is-connected');
    connectTitle.textContent = 'Viewer session active';
    connectDescription.textContent = 'The viewer token stays in this page’s memory. Disconnect to clear the session.';
    setStatus(connectStatus, configuredServers.length
      ? `Connected · ${configuredServers.length} enabled ${configuredServers.length === 1 ? 'client' : 'clients'} loaded.`
      : 'Connected · no agent clients are currently configured.', 'success');
    recordsSubtitle.textContent = configuredServers.length
      ? 'Select a client to inspect its latest inventory evidence.'
      : 'No agent identities are configured in the API.';
    if (configuredServers.length) await loadSnapshots();
  } catch (error) {
    viewerToken = '';
    setStatus(connectStatus, friendlyError(error), 'error');
    workspace.hidden = true;
  } finally {
    setConnecting(false);
  }
});

toggleTokenButton.addEventListener('click', () => {
  const isVisible = tokenInput.type === 'text';
  tokenInput.type = isVisible ? 'password' : 'text';
  toggleTokenButton.setAttribute('aria-label', isVisible ? 'Reveal viewer credential' : 'Hide viewer credential');
  toggleTokenButton.title = isVisible ? 'Show token' : 'Hide token';
  tokenInput.focus();
});

serverSelect.addEventListener('change', loadSnapshots);
refreshButton.addEventListener('click', loadSnapshots);
disconnectButton.addEventListener('click', () => {
  viewerToken = '';
  configuredServers = [];
  serverSelect.replaceChildren();
  serverSelect.disabled = true;
  refreshButton.disabled = true;
  snapshotRows.replaceChildren();
  snapshotCount.textContent = '—';
  availableCount.textContent = '—';
  latestDate.textContent = '—';
  latestRelative.textContent = 'select a client';
  recordsSubtitle.textContent = 'Choose an enabled client to view its inventory history.';
  recordsStatus.textContent = '';
  tableWrap.hidden = true;
  emptyState.hidden = false;
  emptyState.querySelector('h3').textContent = 'No snapshots to show';
  emptyState.querySelector('p').textContent = 'Connect with a viewer token and choose an enabled client to get started.';
  workspace.hidden = true;
  connectForm.hidden = false;
  document.querySelector('#connect-card').classList.remove('is-connected');
  connectTitle.textContent = 'Connect to your evidence';
  connectDescription.textContent = 'Your viewer token is used only in this browser session and is never saved to browser storage.';
  setStatus(connectStatus, 'Disconnected. Your viewer token was cleared from this page.');
  connectForm.reset();
  tokenInput.type = 'password';
});
