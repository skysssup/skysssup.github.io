/* Load the shipped AirForge app only when requested, then release its GPU on close. */
(function () {
  'use strict';
  var link = document.querySelector('[data-playground-open]');
  if (!link || typeof HTMLDialogElement === 'undefined') return;
  var dialog = document.createElement('dialog');
  dialog.className = 'project-playground';
  dialog.setAttribute('aria-labelledby', 'playground-title');
  var header = document.createElement('header');
  var title = document.createElement('h2');
  title.id = 'playground-title';
  title.textContent = 'AirForge — draw & simulate';
  var external = document.createElement('a');
  external.href = link.href;
  external.target = '_blank';
  external.rel = 'noopener';
  external.textContent = 'Open separately ↗';
  var close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close playground');
  close.textContent = 'Close ×';
  var note = document.createElement('p');
  note.textContent = 'The real AirForge app. Use Save or Copy link inside it to keep your scene before closing.';
  header.append(title, external, close);
  dialog.append(header, note);
  document.body.append(dialog);
  var frame = null;
  function openerVisible(node) {
    if (!node || !node.isConnected) return false;
    if (node.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
    var box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }
  function release() {
    if (frame) {
      frame.src = 'about:blank';
      frame.remove();
      frame = null;
    }
    var back = openerVisible(link) ? link : document.querySelector('#studio-projects [aria-selected="true"]');
    if (openerVisible(back)) back.focus({ preventScroll: true });
  }
  close.addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', release);
  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  window.addEventListener('popstate', function () { if (dialog.open) dialog.close(); });
  link.addEventListener('click', function (event) {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (dialog.open) return;
    if (frame) { frame.src = 'about:blank'; frame.remove(); frame = null; }
    frame = document.createElement('iframe');
    frame.title = 'AirForge interactive physics playground';
    frame.src = link.href;
    frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'");
    dialog.append(frame);
    dialog.showModal();
    close.focus();
  });
})();
