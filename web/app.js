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
const csvPreviewDialog = document.querySelector('#csv-preview-dialog');
const csvPreviewTitle = document.querySelector('#csv-preview-title');
const csvPreviewFormat = document.querySelector('#csv-preview-format');
const csvPreviewMeta = document.querySelector('#csv-preview-meta');
const csvPreviewStatus = document.querySelector('#csv-preview-status');
const csvPreviewContent = document.querySelector('#csv-preview-content');
const csvPreviewClose = document.querySelector('#csv-preview-close');

let viewerToken = '';
let configuredServers = [];

const presentationTabs = [...document.querySelectorAll('.presentation-tab')];
const presentationPanels = [...document.querySelectorAll('.presentation-panel')];
const previousSlideButton = document.querySelector('#previous-slide');
const nextSlideButton = document.querySelector('#next-slide');
const slideCounter = document.querySelector('#slide-counter');
const slideProgress = document.querySelector('#slide-progress');
const fullscreenButton = document.querySelector('#fullscreen-button');

function activatePresentationTab(tab, moveFocus = false) {
  const activeIndex = presentationTabs.indexOf(tab);
  presentationTabs.forEach((item) => {
    const selected = item === tab;
    item.classList.toggle('is-active', selected);
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  presentationPanels.forEach((panel) => {
    const selected = panel.id === tab.getAttribute('aria-controls');
    panel.hidden = !selected;
    panel.classList.toggle('is-active', selected);
  });
  previousSlideButton.disabled = activeIndex === 0;
  nextSlideButton.disabled = activeIndex === presentationTabs.length - 1;
  slideCounter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(presentationTabs.length).padStart(2, '0')}`;
  slideProgress.className = `deck-progress-fill progress-${activeIndex + 1}`;
  if (moveFocus) tab.focus();
}

function movePresentation(direction) {
  const activeIndex = presentationTabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  const nextIndex = Math.min(presentationTabs.length - 1, Math.max(0, activeIndex + direction));
  if (nextIndex !== activeIndex) activatePresentationTab(presentationTabs[nextIndex]);
}

previousSlideButton.addEventListener('click', () => movePresentation(-1));
nextSlideButton.addEventListener('click', () => movePresentation(1));
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    fullscreenButton.textContent = 'Fullscreen unavailable';
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Present fullscreen';
});

document.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(event.key)) return;
  if (event.target.closest('input, textarea, select, button, summary, a, [contenteditable="true"]')) return;
  event.preventDefault();
  movePresentation(event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 1);
});

presentationTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activatePresentationTab(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % presentationTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + presentationTabs.length) % presentationTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = presentationTabs.length - 1;
    else return;
    event.preventDefault();
    activatePresentationTab(presentationTabs[nextIndex], true);
  });
});
activatePresentationTab(presentationTabs[0]);

const mapSvg = document.querySelector('#knowledge-map');
const mapViewport = document.querySelector('#map-viewport');
const mapEdgesLayer = document.querySelector('#map-edges');
const mapNodesLayer = document.querySelector('#map-nodes');
const mapSearch = document.querySelector('#map-search');
const mapFilter = document.querySelector('#map-filter');
const mapEmpty = document.querySelector('#map-empty');
const inspectorTitle = document.querySelector('#inspector-title');
const inspectorStatus = document.querySelector('#inspector-status');
const inspectorSummary = document.querySelector('#inspector-summary');
const inspectorFacts = document.querySelector('#inspector-facts');
const inspectorLinks = document.querySelector('#inspector-links');
const mapModeButtons = [...document.querySelectorAll('.map-mode')];
const tourStartButton = document.querySelector('#tour-start');
const tourNextButton = document.querySelector('#tour-next');
const tourCopy = document.querySelector('#tour-copy');

const graphData = {
  system: {
    title: 'Interactive graph showing the exercise system architecture',
    tour: ['agent', 'api', 'postgres', 'minio', 'integrity', 'reviewer'],
    nodes: [
      { id: 'agent', x: 45, y: 230, w: 185, h: 100, title: 'Linux collector', kind: 'Client · outside Docker', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'Builds one bounded inventory snapshot per run and submits it with the agent bearer token.', facts: ['Collects OS and CPU summary, process names and logged-in usernames.', 'Adds server ID, UUID execution ID, UTC timestamp and agent version.', 'Requires HTTPS for non-loopback API URLs; certificate checks use Requests defaults.'] },
      { id: 'api', x: 320, y: 210, w: 205, h: 115, title: 'FastAPI service', kind: 'Ingestion + reviewer API', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'The trust boundary for validating submissions, persisting records and serving reviewer queries and CSV exports.', facts: ['Separate agent and viewer bearer credentials.', 'Strict Pydantic schema and streamed request-size limit.', 'Parameter-bound PostgreSQL queries; minimal structured audit events.'] },
      { id: 'postgres', x: 635, y: 75, w: 190, h: 95, title: 'PostgreSQL', kind: 'Snapshot metadata + payload', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'Stores the validated snapshot, collection and receipt timestamps, payload digest, CSV digest, object key and export state.', facts: ['Unique server ID + execution ID prevents duplicate records.', 'Export states distinguish pending, available, failed and legacy-unverified.', 'PostgreSQL and MinIO do not share a transaction.'] },
      { id: 'minio', x: 635, y: 315, w: 190, h: 95, title: 'MinIO', kind: 'S3-compatible object storage', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'Stores the sanitized CSV evidence export under a deterministic object key.', facts: ['CSV is written only after the database record is prepared.', 'An identical replay can retry a failed or incomplete export.', 'Storage and database credentials are local demo secrets.'] },
      { id: 'audit', x: 320, y: 475, w: 205, h: 95, title: 'Audit events', kind: 'Structured application logs', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'The API emits minimal structured events for authentication, ingestion, queries, export lifecycle and integrity outcomes.', facts: ['Events avoid logging tokens and submitted snapshot contents.', 'Logs are emitted by the application; durable tamper-resistant retention is not implemented.', 'Monitoring and alerting are follow-up work.'] },
      { id: 'integrity', x: 900, y: 390, w: 205, h: 105, title: 'CSV verification', kind: 'Read-time SHA-256 check', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'Before download, the API reads the CSV from MinIO, recomputes SHA-256 and compares it with the expected digest in PostgreSQL.', facts: ['A mismatch is withheld and audited.', 'This detects object/database mismatch at read time.', 'It is not immutable storage and cannot prove the agent observed the host truthfully.'] },
      { id: 'reviewer', x: 1000, y: 155, w: 190, h: 105, title: 'Reviewer console', kind: 'Browser UI', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'Lets an authenticated reviewer list configured server identities, inspect recent snapshot summaries and download verified CSV evidence.', facts: ['Viewer token is held in page memory and cleared on disconnect.', 'The summary UI omits process names and usernames.', 'Static browser-to-API communication is HTTP on loopback in this local demo.'] },
      { id: 'viewer-token', x: 1000, y: 555, w: 190, h: 90, title: 'Viewer credential', kind: 'Shared bearer token', status: 'open', statusLabel: 'Production gap', summary: 'The demo uses one shared viewer token. It provides access control for the walkthrough but not individual reviewer identity.', facts: ['No SSO, MFA, role-based access or per-user audit attribution.', 'Production should use an identity provider and short-lived authorization.', 'Credential rotation and revocation need an operating process.'] },
    ],
    edges: [
      { from: 'agent', to: 'api', label: 'POST snapshot' },
      { from: 'api', to: 'postgres', label: 'validated payload + digests' },
      { from: 'api', to: 'minio', label: 'CSV export' },
      { from: 'api', to: 'audit', label: 'outcome events' },
      { from: 'reviewer', to: 'api', label: 'viewer-authenticated GET' },
      { from: 'postgres', to: 'integrity', label: 'expected digest' },
      { from: 'minio', to: 'integrity', label: 'CSV bytes' },
      { from: 'integrity', to: 'reviewer', label: 'verified download' },
      { from: 'viewer-token', to: 'reviewer', label: 'authorizes session' },
    ],
  },
  frameworks: {
    title: 'Interactive graph mapping framework scope to demonstrated mechanisms and open gaps',
    tour: ['iso27001', 'management-system', 'iso27701', 'privacy-lifecycle', 'iso42001', 'no-ai', 'soc2', 'soc2-assurance', 'pci', 'pci-scope'],
    nodes: [
      { id: 'iso27001', x: 55, y: 50, w: 250, h: 75, title: 'ISO/IEC 27001', kind: 'ISMS · organization-wide', status: 'open', statusLabel: 'Open gap', summary: 'A few technical mechanisms are present, but the prototype does not establish an Information Security Management System.', facts: ['Scope, risk assessment and treatment are not approved organizationally.', 'Control applicability and a Statement of Applicability are not established.', 'Operating controls, audits and management review remain outside this exercise.'] },
      { id: 'iso27701', x: 55, y: 190, w: 250, h: 75, title: 'ISO/IEC 27701', kind: 'PIMS · privacy lifecycle', status: 'open', statusLabel: 'Open gap', summary: 'Process names and logged-in user names may be personal data. A configured retention value does not implement privacy governance or deletion.', facts: ['Controller/processor roles, purpose, lawful basis and notices need assessment.', 'Retention/deletion across database, objects, logs and backups is not automated.', 'Confirm the edition adopted by the organization.'] },
      { id: 'iso42001', x: 55, y: 330, w: 250, h: 75, title: 'ISO/IEC 42001', kind: 'AIMS · AI management', status: 'conditional', statusLabel: 'Conditional on AI scope', summary: 'There is no AI system or AI decision function in the prototype. This is a scope boundary, not implementation of an AI management system.', facts: ['Record and approve the no-AI determination.', 'Reassess scope before introducing AI into collection, scoring or review.', 'If applicable, add lifecycle, impact, human oversight and monitoring controls.'] },
      { id: 'soc2', x: 55, y: 470, w: 250, h: 75, title: 'SOC 2', kind: 'Trust Services Criteria', status: 'open', statusLabel: 'Open gap', summary: 'The demo shows selected technical behavior at a point in time. It is not a SOC 2 report or evidence of operating effectiveness over a review period.', facts: ['Define the system description, boundaries and selected categories.', 'Assign control owners and retain attributable evidence over time.', 'An independent CPA examination is required for a SOC 2 report.'] },
      { id: 'pci', x: 55, y: 610, w: 250, h: 75, title: 'PCI DSS v4.0.1', kind: 'Conditional · CDE scope', status: 'conditional', statusLabel: 'Conditional scope', summary: 'Applicability depends on the real service boundary and whether it stores, processes, transmits, connects to or can affect the cardholder data environment.', facts: ['Do not submit cardholder or sensitive authentication data to this demo.', 'Map payment data flows and connectivity before deciding scope.', 'No PCI scope reduction is claimed.'] },
      { id: 'technical-controls', x: 610, y: 80, w: 275, h: 90, title: 'Technical mechanisms', kind: 'Implemented in the demo', status: 'implemented', statusLabel: 'Implemented mechanism', summary: 'The project demonstrates scoped security engineering mechanisms that can support a discussion of evidence collection.', facts: ['Token-to-server binding, schema validation and bounded request size.', 'Replay handling, CSV export lifecycle and digest comparison.', 'These mechanisms alone do not establish framework conformity.'] },
      { id: 'management-system', x: 610, y: 205, w: 275, h: 90, title: 'Operating management system', kind: 'Risk · ownership · assurance', status: 'open', statusLabel: 'Open gap', summary: 'The system lacks the organization-level governance, approved scope, risk treatment, ownership, recurring control operation and assurance evidence needed for an ISMS.', facts: ['Applies to ISO/IEC 27001 and supports broader assurance.', 'Includes secure SDLC, suppliers, incidents, resilience, audits and management review.', 'See the full gap register for proposed evidence.'] },
      { id: 'privacy-lifecycle', x: 610, y: 330, w: 275, h: 90, title: 'Privacy roles + lifecycle', kind: 'Purpose · rights · retention', status: 'open', statusLabel: 'Open gap', summary: 'Privacy applicability and the full information lifecycle need organizational decisions and enforceable controls.', facts: ['Purpose, lawful basis, notices and controller/processor roles.', 'Data-subject rights and privacy risk assessment as applicable.', 'Enforce deletion across primary stores, logs and backups.'] },
      { id: 'no-ai', x: 610, y: 455, w: 275, h: 90, title: 'No AI in this prototype', kind: 'Document scope decision', status: 'open', statusLabel: 'Scope rationale to approve', summary: 'The prototype does not use AI. The appropriate immediate action is to document and approve the scope determination, then revisit it if the product changes.', facts: ['Not a claim of ISO/IEC 42001 conformity.', 'If AI is introduced, assess intended use, impacts and lifecycle risks.', 'Add governance, human oversight, transparency and monitoring as applicable.'] },
      { id: 'soc2-assurance', x: 930, y: 455, w: 250, h: 90, title: 'Time-bound assurance', kind: 'Owners · evidence · CPA', status: 'open', statusLabel: 'Open gap', summary: 'SOC 2 requires a defined system and control evidence over a defined period, followed by an independent examination.', facts: ['Select applicable Trust Services Categories.', 'Build dated populations and control evidence with named owners.', 'A walkthrough alone cannot establish operating effectiveness.'] },
      { id: 'pci-scope', x: 930, y: 610, w: 250, h: 90, title: 'CDE scope decision', kind: 'Data flows · connectivity · impact', status: 'conditional', statusLabel: 'Conditional scope', summary: 'PCI DSS work starts by establishing whether the real environment is in scope, including whether it can affect CDE security.', facts: ['Map payment data flows and network connections.', 'Validate scope and assessment approach with the relevant assessor/acquirer.', 'If in scope, map controls and evidence to the current requirements.'] },
    ],
    edges: [
      { from: 'iso27001', to: 'technical-controls', label: 'technical example' },
      { from: 'iso27001', to: 'management-system', label: 'system requirement' },
      { from: 'iso27701', to: 'privacy-lifecycle', label: 'privacy governance' },
      { from: 'iso42001', to: 'no-ai', label: 'current scope boundary' },
      { from: 'soc2', to: 'technical-controls', label: 'sample mechanism' },
      { from: 'soc2', to: 'soc2-assurance', label: 'period evidence + CPA' },
      { from: 'pci', to: 'pci-scope', label: 'determine applicability first' },
    ],
  },
};

let activeMapMode = 'system';
let selectedMapNode = '';
let mapZoom = 1;
let mapOffset = { x: 0, y: 0 };
let activeTour = null;
let tourPosition = 0;
let panStart = null;
let draggingMap = false;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function activeGraph() {
  return graphData[activeMapMode];
}

function nodeCenter(node) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function edgePoints(from, to) {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sourceScale = 1 / Math.max(Math.abs(dx) / (from.w / 2), Math.abs(dy) / (from.h / 2));
  const targetScale = 1 / Math.max(Math.abs(dx) / (to.w / 2), Math.abs(dy) / (to.h / 2));
  return {
    x1: a.x + dx * sourceScale,
    y1: a.y + dy * sourceScale,
    x2: b.x - dx * targetScale,
    y2: b.y - dy * targetScale,
  };
}

function matchesMapFilters(node) {
  const query = mapSearch.value.trim().toLowerCase();
  const statusFilter = mapFilter.value;
  const matchesQuery = !query || `${node.title} ${node.kind} ${node.summary} ${node.facts.join(' ')}`.toLowerCase().includes(query);
  const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
  return matchesQuery && matchesStatus;
}

function renderGraph() {
  const graph = activeGraph();
  const nodeMatches = new Map(graph.nodes.map((node) => [node.id, matchesMapFilters(node)]));
  if (selectedMapNode && !nodeMatches.get(selectedMapNode)) {
    selectedMapNode = '';
    inspectorTitle.textContent = 'Select a node';
    inspectorStatus.textContent = 'Explore the map';
    inspectorStatus.className = 'inspector-status';
    inspectorSummary.textContent = 'Select any visible node to see its role, evidence and relationships.';
    inspectorFacts.replaceChildren();
    inspectorLinks.replaceChildren();
  }
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  mapEdgesLayer.replaceChildren();
  mapNodesLayer.replaceChildren();

  for (const edge of graph.edges) {
    if (!nodeMatches.get(edge.from) || !nodeMatches.get(edge.to)) continue;
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    const points = edgePoints(from, to);
    const group = svgElement('g', { class: 'map-edge' });
    group.append(svgElement('line', { ...points, 'marker-end': 'url(#map-arrow)' }));
    const label = svgElement('text', { x: (points.x1 + points.x2) / 2, y: (points.y1 + points.y2) / 2 - 7, class: 'edge-label' });
    label.textContent = edge.label;
    group.append(label);
    mapEdgesLayer.append(group);
  }

  for (const node of graph.nodes) {
    if (!nodeMatches.get(node.id)) continue;
    const group = svgElement('g', {
      class: `map-node status-${node.status}${selectedMapNode === node.id ? ' is-selected' : ''}`,
      transform: `translate(${node.x} ${node.y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${node.title}. ${node.statusLabel}. Select for details.`,
      'data-node-id': node.id,
    });
    group.append(svgElement('rect', { width: node.w, height: node.h, rx: 3, class: 'node-box' }));
    const kind = svgElement('text', { x: 13, y: 21, class: 'node-kind' });
    kind.textContent = node.kind.toUpperCase();
    const title = svgElement('text', { x: 13, y: 49, class: 'node-title' });
    title.textContent = node.title;
    const status = svgElement('text', { x: 13, y: node.h - 12, class: 'node-status' });
    status.textContent = node.statusLabel.toUpperCase();
    group.append(kind, title, status);
    group.addEventListener('click', () => selectMapNode(node.id));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectMapNode(node.id);
      }
    });
    mapNodesLayer.append(group);
  }
  mapEmpty.hidden = [...nodeMatches.values()].some(Boolean);
  mapSvg.setAttribute('aria-label', graph.title);
}

function selectMapNode(nodeId) {
  const node = activeGraph().nodes.find((item) => item.id === nodeId);
  if (!node) return;
  selectedMapNode = nodeId;
  inspectorTitle.textContent = node.title;
  inspectorStatus.textContent = node.statusLabel;
  inspectorStatus.className = `inspector-status status-${node.status}`;
  inspectorSummary.textContent = node.summary;
  inspectorFacts.replaceChildren();
  inspectorLinks.replaceChildren();
  for (const fact of node.facts) {
    const item = document.createElement('li');
    item.textContent = fact;
    inspectorFacts.append(item);
  }
  const relatedIds = [...new Set(activeGraph().edges.flatMap((edge) => edge.from === nodeId ? [edge.to] : edge.to === nodeId ? [edge.from] : []))]
    .filter((id) => activeGraph().nodes.some((node) => node.id === id && matchesMapFilters(node)));
  if (relatedIds.length) {
    const heading = document.createElement('strong');
    heading.textContent = 'Connected nodes';
    inspectorLinks.append(heading);
    for (const relatedId of relatedIds) {
      const related = activeGraph().nodes.find((item) => item.id === relatedId);
      if (!related) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = related.title;
      button.addEventListener('click', () => selectMapNode(relatedId));
      inspectorLinks.append(button);
    }
  }
  renderGraph();
}

function renderMapTransform() {
  mapViewport.setAttribute('transform', `translate(${mapOffset.x} ${mapOffset.y}) scale(${mapZoom})`);
}

function zoomMap(factor) {
  const nextZoom = Math.max(0.65, Math.min(1.8, mapZoom * factor));
  const centerX = 620;
  const centerY = 380;
  const ratio = nextZoom / mapZoom;
  mapOffset = { x: centerX - (centerX - mapOffset.x) * ratio, y: centerY - (centerY - mapOffset.y) * ratio };
  mapZoom = nextZoom;
  renderMapTransform();
}

function resetMapView() {
  mapZoom = 1;
  mapOffset = { x: 0, y: 0 };
  renderMapTransform();
}

function setMapMode(mode) {
  activeMapMode = mode;
  selectedMapNode = '';
  activeTour = null;
  mapModeButtons.forEach((button) => {
    const selected = button.dataset.mapMode === mode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  mapSearch.value = '';
  mapFilter.value = 'all';
  tourStartButton.hidden = false;
  tourNextButton.hidden = true;
  tourStartButton.textContent = 'Start guided tour';
  tourCopy.textContent = mode === 'system' ? 'Trace one snapshot through the collection and review path.' : 'Trace each framework to the scope decision or gap it exposes.';
  mapSvg.setAttribute('viewBox', mode === 'system' ? '0 0 1240 760' : '0 0 1240 760');
  renderGraph();
  resetMapView();
  selectMapNode(mode === 'system' ? 'agent' : 'iso27001');
}

function startOrAdvanceTour() {
  const tour = activeGraph().tour;
  if (!activeTour || activeTour !== activeMapMode) {
    activeTour = activeMapMode;
    tourPosition = 0;
  } else {
    tourPosition += 1;
  }
  if (tourPosition >= tour.length) {
    activeTour = null;
    tourPosition = 0;
    tourStartButton.hidden = false;
    tourNextButton.hidden = true;
    tourStartButton.textContent = 'Restart guided tour';
    tourCopy.textContent = 'Walkthrough complete. Select any node to keep exploring.';
    return;
  }
  const node = activeGraph().nodes.find((item) => item.id === tour[tourPosition]);
  selectMapNode(node.id);
  tourCopy.textContent = `Step ${tourPosition + 1} of ${tour.length} · ${node.title}`;
  tourStartButton.hidden = true;
  tourNextButton.hidden = false;
  if (tourPosition === tour.length - 1) tourNextButton.textContent = 'Finish tour';
  else tourNextButton.textContent = 'Next node →';
}

mapModeButtons.forEach((button) => button.addEventListener('click', () => setMapMode(button.dataset.mapMode)));
mapSearch.addEventListener('input', renderGraph);
mapFilter.addEventListener('change', renderGraph);
document.querySelector('#zoom-in').addEventListener('click', () => zoomMap(1.15));
document.querySelector('#zoom-out').addEventListener('click', () => zoomMap(1 / 1.15));
document.querySelector('#zoom-reset').addEventListener('click', resetMapView);
tourStartButton.addEventListener('click', startOrAdvanceTour);
tourNextButton.addEventListener('click', startOrAdvanceTour);

mapSvg.addEventListener('pointerdown', (event) => {
  if (event.target.closest('[data-node-id]')) return;
  const point = mapSvg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const location = point.matrixTransform(mapSvg.getScreenCTM().inverse());
  panStart = { pointerId: event.pointerId, x: location.x, y: location.y, offsetX: mapOffset.x, offsetY: mapOffset.y };
  draggingMap = true;
  mapSvg.setPointerCapture(event.pointerId);
});
mapSvg.addEventListener('pointermove', (event) => {
  if (!panStart || panStart.pointerId !== event.pointerId) return;
  const point = mapSvg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const location = point.matrixTransform(mapSvg.getScreenCTM().inverse());
  mapOffset = { x: panStart.offsetX + location.x - panStart.x, y: panStart.offsetY + location.y - panStart.y };
  renderMapTransform();
});
mapSvg.addEventListener('pointerup', () => {
  panStart = null;
  window.setTimeout(() => { draggingMap = false; }, 0);
});
mapSvg.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoomMap(event.deltaY < 0 ? 1.08 : 1 / 1.08);
}, { passive: false });
renderGraph();
selectMapNode('agent');

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
  const ingestionFormat = document.createElement('small');
  ingestionFormat.className = 'ingestion-format';
  ingestionFormat.textContent = snapshot.ingestion_format
    ? `Submitted as ${snapshot.ingestion_format.toUpperCase()}`
    : 'Submitted format unavailable (legacy record)';
  const agentVersion = document.createElement('small');
  agentVersion.className = 'agent-version';
  agentVersion.textContent = `Agent ${snapshot.agent_version || 'version unavailable'}`;
  profileCell.append(operatingSystem, hostDetails, ingestionFormat, agentVersion);

  const evidenceCell = makeCell();
  evidenceCell.append(makeStatusPill(snapshot.evidence_status));

  const digestCell = makeCell();
  digestCell.append(makeDigestDetails(snapshot.sha256));

  const actionCell = makeCell('action-cell');
  const actions = document.createElement('div');
  actions.className = 'evidence-actions';
  const jsonPreview = document.createElement('button');
  jsonPreview.className = 'download-button json-preview-button';
  jsonPreview.type = 'button';
  jsonPreview.textContent = snapshot.json_available ? 'View JSON' : 'JSON unavailable';
  jsonPreview.disabled = !snapshot.json_available;
  jsonPreview.setAttribute('aria-label', `View formatted JSON for execution ${snapshot.execution_id}`);
  if (snapshot.json_available) {
    jsonPreview.addEventListener('click', () => previewJson(serverId, snapshot.execution_id, snapshot, jsonPreview));
  } else {
    jsonPreview.title = 'A stored JSON payload and digest are not available for this record';
  }
  const preview = document.createElement('button');
  preview.className = 'download-button preview-button';
  preview.type = 'button';
  preview.textContent = snapshot.csv_available ? 'View CSV' : 'CSV unavailable';
  preview.disabled = !snapshot.csv_available;
  const download = document.createElement('button');
  download.className = 'download-button';
  download.type = 'button';
  download.textContent = snapshot.csv_available ? '↓ Download' : '—';
  download.disabled = !snapshot.csv_available;
  if (snapshot.csv_available) {
    preview.setAttribute('aria-label', `Preview CSV for execution ${snapshot.execution_id}`);
    preview.addEventListener('click', () => previewCsv(serverId, snapshot.execution_id, snapshot, preview));
    download.setAttribute('aria-label', `Download CSV for execution ${snapshot.execution_id}`);
    download.addEventListener('click', () => downloadCsv(serverId, snapshot.execution_id, download));
  } else {
    download.title = 'Evidence is not currently available or verified';
    preview.title = 'Evidence is not currently available or verified';
  }
  actions.append(jsonPreview, preview, download);
  actionCell.append(actions);

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
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    anchor.download = filename || `${executionId}.csv`;
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

async function previewCsv(serverId, executionId, snapshot, button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Loading…';
  const requestPath = `/v1/servers/${encodeURIComponent(serverId)}/snapshots/${encodeURIComponent(executionId)}/csv`;
  const collectedDate = snapshot.collected_at?.slice(0, 10) || 'unknown-date';
  csvPreviewFormat.textContent = 'VERIFIED EVIDENCE · CSV PREVIEW';
  csvPreviewTitle.textContent = `${serverId}_${collectedDate}_${executionId}.csv`;
  csvPreviewMeta.textContent = 'CSV export · the API verifies its stored SHA-256 digest before returning this content.';
  csvPreviewStatus.textContent = 'Loading verified CSV…';
  csvPreviewStatus.className = 'csv-preview-status';
  csvPreviewContent.textContent = '';
  if (!csvPreviewDialog.open) csvPreviewDialog.showModal();
  try {
    const response = await apiGet(requestPath);
    csvPreviewContent.textContent = await response.text() || '(The CSV file is empty.)';
    csvPreviewStatus.textContent = 'Integrity check passed · content served by the API';
    csvPreviewStatus.className = 'csv-preview-status is-success';
    csvPreviewContent.focus();
  } catch (error) {
    csvPreviewStatus.textContent = friendlyError(error);
    csvPreviewStatus.className = 'csv-preview-status is-error';
    csvPreviewContent.textContent = 'The evidence could not be loaded.';
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function previewJson(serverId, executionId, snapshot, button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Loading…';
  const requestPath = `/v1/servers/${encodeURIComponent(serverId)}/snapshots/${encodeURIComponent(executionId)}/json`;
  const collectedDate = snapshot.collected_at?.slice(0, 10) || 'unknown-date';
  csvPreviewFormat.textContent = 'VERIFIED EVIDENCE · JSON VIEW';
  csvPreviewTitle.textContent = `${serverId}_${collectedDate}_${executionId}.json`;
  csvPreviewMeta.textContent = 'Stored JSON snapshot · the API verifies its SHA-256 digest before returning this content.';
  csvPreviewStatus.textContent = 'Loading and verifying snapshot…';
  csvPreviewStatus.className = 'csv-preview-status';
  csvPreviewContent.textContent = '';
  if (!csvPreviewDialog.open) csvPreviewDialog.showModal();
  try {
    const response = await apiGet(requestPath);
    const snapshotJson = await response.json();
    csvPreviewContent.textContent = JSON.stringify(snapshotJson, null, 2);
    csvPreviewStatus.textContent = 'Integrity check passed · formatted JSON served by the API';
    csvPreviewStatus.className = 'csv-preview-status is-success';
    csvPreviewContent.focus();
  } catch (error) {
    csvPreviewStatus.textContent = friendlyError(error);
    csvPreviewStatus.className = 'csv-preview-status is-error';
    csvPreviewContent.textContent = 'The snapshot could not be loaded.';
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

csvPreviewClose.addEventListener('click', () => csvPreviewDialog.close());
csvPreviewDialog.addEventListener('click', (event) => {
  if (event.target === csvPreviewDialog) csvPreviewDialog.close();
});

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
