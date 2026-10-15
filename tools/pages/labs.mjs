// Compact illustration controls. These drive the existing scene drawings.
// They are not product sessions, metrics, scanners, or customer data.
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

function group(slug, label, body) {
  return `<div class="lab-controls" data-lab-controls data-lab-slug="${esc(slug)}" role="group" aria-label="${esc(label)}">${body}<output class="lab-output" aria-live="polite"></output></div>`;
}

function field(inner) {
  return `<div class="lab-field">${inner}</div>`;
}

const labs = {
  agentcrucible: () => group('agentcrucible', 'AgentCrucible fault illustration, not a live agent run', [
    field(`<label class="lab-label" for="lab-agentcrucible-fault">Fault</label><select id="lab-agentcrucible-fault" data-lab-control="fault"><option value="timeout" selected>Timeout</option><option value="duplicate">Duplicate call</option><option value="none">None</option></select>`),
    `<div class="lab-actions"><button type="button" data-lab-action="run">Run check</button></div>`,
  ].join('')),

  airforge: () => group('airforge', 'AirForge ramp illustration, not a live physics session', [
    field(`<label class="lab-label" for="lab-airforge-incline">Ramp incline</label><input id="lab-airforge-incline" type="range" min="10" max="50" step="1" value="30" data-lab-control="incline" aria-describedby="lab-airforge-incline-value"><span class="lab-value" id="lab-airforge-incline-value">30°</span>`),
    `<div class="lab-actions"><button type="button" data-lab-action="drop">Drop</button></div>`,
  ].join('')),

  shipgate: () => group('shipgate', 'Shipgate staged-diff illustration, not a complete safety scanner', [
    field(`<label class="lab-label" for="lab-shipgate-diff">Staged diff</label><textarea id="lab-shipgate-diff" rows="2" maxlength="400" spellcheck="false" data-lab-control="diff">+ AWS_SECRET_ACCESS_KEY=AKIAEXAMPLE</textarea>`),
    `<p class="lab-label">Illustration preview. Blocks a cloud secret, a private key, or a password assignment.</p>`,
    `<div class="lab-actions"><button type="button" data-lab-action="preview">Preview</button></div>`,
  ].join('')),
};

export function labControls(slug) {
  const build = labs[slug];
  return build ? build() : '';
}

export const labSlugs = Object.keys(labs);
