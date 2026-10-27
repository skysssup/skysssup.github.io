// Uses AgentCrucible's actual harness and grader, bundled from src/browser-refund.ts.
const root = document.querySelector('[data-refund-experiment]');
if (root) {
  const form = root.querySelector('form');
  const output = root.querySelector('[data-results]');
  const status = root.querySelector('[role=status]');
  const button = form.querySelector('button');
  const exportButton = root.querySelector('[data-export]');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let results;
  let scenario;
  let seed;
  let engine;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    exportButton.disabled = true;
    status.textContent = 'Running five scripted agents against fresh mock payment services…';
    try {
      engine ??= await import('/work/agentcrucible/experiment/engine.js');
      const response = await fetch('/work/agentcrucible/experiment/scenario.json');
      if (!response.ok) throw new Error('The scenario could not be loaded. Reload the page and try again.');
      scenario = await response.json();
      const data = new FormData(form);
      seed = String(data.get('seed') || 'demo');
      const fault = String(data.get('fault'));
      const agents = Object.keys(scenario.expectedVerdicts);
      scenario.faults = fault === 'none' ? [] : [{ ...scenario.faults[0], kind: fault }];
      // Reference verdicts apply to the original timeout schedule only.
      if (fault !== 'timeout_after_commit') scenario.expectedVerdicts = {};
      results = await engine.runRefundExperiment(scenario, seed, agents);
      output.innerHTML = results.map(r => `<details class="refund-result"><summary><code>${esc(r.agentId)}</code><strong data-verdict="${esc(r.verdict)}">${esc(r.verdict)}</strong></summary><p>${esc(r.reason)}</p><ol>${r.trace.calls.map(c => `<li><code>${esc(c.tool)} #${c.callIndex}</code> — ${c.committed ? 'executed' : 'not executed'}; agent saw ${c.observed.ok ? 'success' : 'an error'}${c.faultApplied ? ` <b>(${esc(c.faultApplied)})</b>` : ''}<ul>${c.changes.map(change => `<li>${esc(change)}</li>`).join('')}</ul></li>`).join('')}</ol><blockquote>${esc(r.trace.finalAnswer)}</blockquote></details>`).join('');
      status.textContent = `Five strategies executed. ${results.filter(r => r.verdict === 'SAFE_SUCCESS').length} completed safely under this scenario. Open a result to inspect its calls.`;
      exportButton.disabled = false;
    } catch (error) {
      status.textContent = `Could not run the experiment: ${error.message}`;
    } finally { button.disabled = false; }
  });

  exportButton.addEventListener('click', () => {
    if (!results) return;
    const data = { description: 'Scripted agents in offline mock payments; not production safety measurements.', scenario, seed, results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'agentcrucible-refund-evidence.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
