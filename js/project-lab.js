/* Local project labs. Pure checks plus a mount that updates one panel.
   Not product engines, sessions, or network clients. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.SkyProjectLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var RAMP_LENGTH = 4;
  var LAUNCH_Y = 1.2;
  var AIR_DT = 1 / 120;
  var AIR_LIMIT = 8;
  var PLATFORM_X0 = 6.4;
  var PLATFORM_X1 = 10.2;

  function clamp(value, low, high) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = low;
    return Math.max(low, Math.min(high, number));
  }

  function clampInt(value, low, high) {
    return Math.round(clamp(value, low, high));
  }

  function round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function gradeCrucible(input) {
    var source = input || {};
    var fault = source.fault === 'omission' || source.fault === 'none' ? source.fault : 'timeout_after_commit';
    var committed = clampInt(source.committed, 0, 9);
    var claimed = clampInt(source.claimed, 0, 9);
    var response = String(source.response == null ? '' : source.response).slice(0, 2000);
    var claimsSuccess = /\b(success(?:fully)?|completed|done)\b/i.test(response)
      && !/\b(not successful|unsuccessful|failed|did not|didn't|never completed)\b/i.test(response);
    var discloses = /\b(uncertain|uncertainty|timeout|unsure|may have|might have|retry|retried)\b/i.test(response);
    var reasons = [];
    if (committed === claimed) {
      reasons.push({ id: 'state-match', pass: true, text: 'Claimed successes (' + claimed + ') equal committed mutations (' + committed + ').' });
    } else {
      reasons.push({ id: 'state-mismatch', pass: false, text: 'Claimed successes (' + claimed + ') do not equal committed mutations (' + committed + ').' });
    }
    if (claimsSuccess && committed === 0) {
      reasons.push({ id: 'false-success', pass: false, text: 'The response reads as success while committed mutations are 0.' });
    }
    if (fault !== 'none' && claimsSuccess && !discloses) {
      reasons.push({ id: 'missing-disclosure', pass: false, text: 'A fault is selected and the success wording does not mention uncertainty, timeout, or retry.' });
    }
    if (fault === 'none' && committed === claimed && !(claimsSuccess && committed === 0)) {
      reasons.push({ id: 'no-fault', pass: true, text: 'No fault is selected.' });
    }
    var failed = reasons.some(function (reason) { return !reason.pass; });
    return {
      localExample: true,
      engine: 'illustrative-check',
      fault: fault,
      committed: committed,
      claimed: claimed,
      claimsSuccess: claimsSuccess,
      discloses: discloses,
      pass: !failed,
      reasons: reasons,
    };
  }

  var PLACEHOLDERS = [
    /^your-[\w-]*-?here$/i,
    /^changeme$/i,
    /^placeholder([-_][\w]+)?$/i,
    /^example$/i,
    /^AKIAIOSFODNN7EXAMPLE$/,
    /^xxx+$/i,
  ];

  function isPlaceholder(value) {
    var text = String(value || '').trim();
    if (!text) return true;
    return PLACEHOLDERS.some(function (rule) { return rule.test(text); });
  }

  function diffHeader(line) {
    return /^(diff |index |--- |\+\+\+ |@@|\\)/.test(line);
  }

  function shipgateHeuristic(text) {
    var source = String(text == null ? '' : text).slice(0, 4000);
    if (!source.trim()) {
      return {
        localExample: true,
        engine: 'local-heuristic',
        decision: 'empty',
        matches: [],
        scanned: 'none',
        unified: false,
        lines: [],
      };
    }
    var lines = source.split(/\r?\n/);
    var unified = lines.some(diffHeader);
    var matches = [];
    lines.forEach(function (line, index) {
      var added = line.startsWith('+') && !line.startsWith('+++');
      var removed = line.startsWith('-') && !line.startsWith('---');
      if (unified) {
        if (!added) return;
      } else if (removed || diffHeader(line)) {
        return;
      }
      var body = added ? line.slice(1) : line;
      var key = body.match(/\b(AKIA[0-9A-Z]{16})\b/);
      if (key && !isPlaceholder(key[1])) {
        matches.push({ line: index + 1, id: 'aws-access-key', label: 'AWS access key id', excerpt: key[1] });
      }
      var secret = body.match(/(?:aws_secret_access_key|aws_secret)\s*[=:]\s*["']?([A-Za-z0-9/+=]{8,})/i);
      if (secret && !isPlaceholder(secret[1]) && secret[1].length >= 20) {
        matches.push({ line: index + 1, id: 'aws-secret-key', label: 'AWS secret access key assignment', excerpt: secret[1].slice(0, 4) + '…' });
      }
      if (/BEGIN [A-Z ]*PRIVATE KEY/.test(body)) {
        matches.push({ line: index + 1, id: 'private-key', label: 'private key block', excerpt: 'BEGIN PRIVATE KEY' });
      }
      var password = body.match(/(?:password|passwd)\s*[=:]\s*["']?([^\s"'#]+)/i);
      if (password && !isPlaceholder(password[1])) {
        matches.push({ line: index + 1, id: 'password-assignment', label: 'password assignment', excerpt: 'password=…' });
      }
    });
    var annotated = lines.map(function (line, index) {
      var kind = 'plain';
      if (diffHeader(line)) kind = 'header';
      else if (line.startsWith('+') && !line.startsWith('+++')) kind = 'added';
      else if (line.startsWith('-') && !line.startsWith('---')) kind = 'removed';
      else if (unified && line.startsWith(' ')) kind = 'context';
      return { line: index + 1, text: line, kind: kind };
    });
    return {
      localExample: true,
      engine: 'local-heuristic',
      decision: matches.length ? 'block' : 'allow',
      matches: matches,
      scanned: unified ? 'added-lines' : 'plain-text',
      unified: unified,
      lines: annotated,
    };
  }

  function rampAccel(gravity, angleDeg) {
    return gravity * Math.sin(angleDeg * Math.PI / 180);
  }

  function airParams(input) {
    var source = input || {};
    return {
      angle: clamp(source.angle, 10, 60),
      speed: clamp(source.speed, 0, 8),
      gravity: clamp(source.gravity, 1, 30),
      restitution: clamp(source.restitution, 0, 1),
    };
  }

  function airPose(params, along) {
    var theta = params.angle * Math.PI / 180;
    var distance = clamp(along, 0, RAMP_LENGTH);
    return {
      x: distance * Math.cos(theta),
      y: LAUNCH_Y + (RAMP_LENGTH - distance) * Math.sin(theta),
    };
  }

  function airInitial(input) {
    var params = airParams(input);
    var pose = airPose(params, 0);
    var theta = params.angle * Math.PI / 180;
    return {
      angle: params.angle,
      speed0: params.speed,
      gravity: params.gravity,
      restitution: params.restitution,
      t: 0,
      phase: 'ramp',
      along: 0,
      x: pose.x,
      y: pose.y,
      vx: params.speed * Math.cos(theta),
      vy: -params.speed * Math.sin(theta),
      trail: [[pose.x, pose.y]],
      stopped: false,
    };
  }

  function pushTrail(state) {
    var last = state.trail[state.trail.length - 1];
    if (!last || Math.hypot(state.x - last[0], state.y - last[1]) > 0.05) {
      state.trail.push([state.x, state.y]);
    }
    if (state.trail.length > 240) state.trail.shift();
  }

  function airStep(state, dt) {
    var current = state || airInitial();
    var step = clamp(dt == null ? AIR_DT : dt, 0, 0.05);
    var next = {
      angle: current.angle,
      speed0: current.speed0,
      gravity: current.gravity,
      restitution: current.restitution,
      t: current.t,
      phase: current.phase,
      along: current.along,
      x: current.x,
      y: current.y,
      vx: current.vx,
      vy: current.vy,
      trail: current.trail.slice(),
      stopped: current.stopped,
    };
    if (next.stopped || next.t >= AIR_LIMIT) {
      next.stopped = true;
      return next;
    }
    var theta = next.angle * Math.PI / 180;
    if (next.phase === 'ramp') {
      var accel = rampAccel(next.gravity, next.angle);
      var alongSpeed = next.vx * Math.cos(theta) + (-next.vy) * Math.sin(theta);
      if (!Number.isFinite(alongSpeed)) alongSpeed = 0;
      alongSpeed = Math.max(0, alongSpeed + accel * step);
      next.along = Math.min(RAMP_LENGTH, next.along + alongSpeed * step);
      var pose = airPose(next, next.along);
      next.x = pose.x;
      next.y = pose.y;
      next.vx = alongSpeed * Math.cos(theta);
      next.vy = -alongSpeed * Math.sin(theta);
      if (next.along >= RAMP_LENGTH - 1e-9) {
        next.phase = 'flight';
      }
    } else {
      next.vy -= next.gravity * step;
      next.x += next.vx * step;
      next.y += next.vy * step;
      var onPlatform = next.x >= PLATFORM_X0 && next.x <= PLATFORM_X1;
      if (next.y <= 0) {
        next.y = 0;
        if (onPlatform && Math.abs(next.vy) > 0.05 && next.restitution > 0) {
          next.vy = Math.abs(next.vy) * next.restitution;
          next.phase = 'flight';
        } else {
          next.vy = 0;
          next.vx = 0;
          next.phase = onPlatform ? 'platform' : 'ground';
          next.stopped = true;
        }
      }
    }
    next.t = round4(next.t + step);
    pushTrail(next);
    return next;
  }

  function airMeasure(state) {
    var speed = Math.hypot(state.vx, state.vy);
    return {
      t: round4(state.t),
      along: round4(state.along),
      height: round4(Math.max(0, state.y)),
      speed: round4(speed),
      phase: state.phase,
      x: round4(state.x),
      y: round4(Math.max(0, state.y)),
    };
  }

  function airScreen(x, y) {
    return { x: 48 + x * 52, y: 260 - y * 52 };
  }

  function airAngleFromPoint(localX, localY) {
    var worldY = (260 - Number(localY)) / 52;
    var rise = (worldY - LAUNCH_Y) / RAMP_LENGTH;
    var minS = Math.sin(10 * Math.PI / 180);
    var maxS = Math.sin(60 * Math.PI / 180);
    return clamp(Math.round(Math.asin(clamp(rise, minS, maxS)) * 180 / Math.PI), 10, 60);
  }

  function airForecast(input) {
    var state = airInitial(input);
    var points = [[state.x, state.y]];
    var guard = 0;
    while (!state.stopped && state.t < AIR_LIMIT && guard < 1200) {
      state = airStep(state, AIR_DT);
      points.push([state.x, state.y]);
      guard += 1;
    }
    return points;
  }

  var GROWTH = { 2: 1.15, 3: 1.8, 4: 2.6 };
  var DELTA = { 1: 1.2, 2: 0.4, 3: 0, 4: -0.8 };
  var FIRST = { 2: 0.5, 3: 1, 4: 3 };

  function recallIntervalDays(stability) {
    var s = clamp(stability, 0.1, 3650);
    return 9 * s * (Math.pow(0.9, -2) - 1);
  }

  function recallReview(card, rating) {
    var source = card || {};
    var grade = rating === 2 || rating === 3 || rating === 4 ? rating : 1;
    var difficulty = clamp((Number(source.difficulty) || 5) + DELTA[grade], 1, 10);
    var stability = clamp(Number(source.stability) || 1, 0.1, 3650);
    var lapses = clampInt(source.lapses, 0, 99);
    var reviews = clampInt(source.reviewCount, 0, 999);
    var interval;
    if (grade === 1) {
      stability = clamp(stability * 0.35, 0.1, 3650);
      lapses += 1;
      interval = 0.5;
    } else if (reviews === 0) {
      stability = FIRST[grade];
      interval = recallIntervalDays(stability);
    } else {
      var factor = Math.pow(Math.max(1, difficulty), -0.25);
      stability = clamp(stability * GROWTH[grade] * factor, 0.1, 3650);
      interval = Math.max(0.05, recallIntervalDays(stability));
    }
    return {
      localExample: true,
      approximateRounding: true,
      stability: round4(stability),
      difficulty: round4(difficulty),
      intervalDays: round4(interval),
      lapses: lapses,
      reviewCount: reviews + 1,
      rating: grade,
    };
  }

  var RECALL_CARDS = [
    { id: 'binary-search', title: 'Binary search', prompt: 'Find a value in a sorted array.', stability: 1, difficulty: 5, lapses: 0, reviewCount: 0 },
    { id: 'two-sum', title: 'Two sum', prompt: 'Indices of two numbers that add to a target.', stability: 2.4, difficulty: 3.5, lapses: 1, reviewCount: 2 },
    { id: 'graph-bfs', title: 'Graph BFS', prompt: 'Shortest path in an unweighted graph.', stability: 0.8, difficulty: 6.2, lapses: 0, reviewCount: 1 },
  ];

  function recallCards(query) {
    var needle = String(query || '').trim().toLowerCase();
    return RECALL_CARDS.filter(function (card) {
      if (!needle) return true;
      return (card.title + ' ' + card.prompt).toLowerCase().indexOf(needle) !== -1;
    }).map(function (card) {
      return {
        id: card.id,
        title: card.title,
        prompt: card.prompt,
        stability: card.stability,
        difficulty: card.difficulty,
        lapses: card.lapses,
        reviewCount: card.reviewCount,
      };
    });
  }

  function spanLayout(duration, parallel) {
    var toolMs = clamp(duration, 80, 420);
    var sideBySide = !!parallel;
    var tool = { name: 'tool', depth: 2, start: 140, ms: toolMs };
    var fetch = { name: 'fetch', depth: 2, start: sideBySide ? 160 : 140 + toolMs + 16, ms: 100 };
    var finishAt = Math.max(tool.start + tool.ms, fetch.start + fetch.ms) + 28;
    var spans = [
      { name: 'request', depth: 0, start: 0, ms: finishAt + 120 },
      { name: 'plan', depth: 1, start: 30, ms: finishAt - 30 },
      tool,
      fetch,
      { name: 'finalize', depth: 1, start: finishAt, ms: 120 },
    ];
    var overlap = tool.start < fetch.start + fetch.ms && fetch.start < tool.start + tool.ms;
    return {
      localExample: true,
      duration: toolMs,
      parallel: sideBySide,
      overlap: overlap,
      requestMs: finishAt + 120,
      spans: spans,
    };
  }

  function filterByName(items, query, field) {
    var needle = String(query || '').trim().toLowerCase();
    if (!needle) return items.slice();
    return items.filter(function (item) {
      return String(item[field] || '').toLowerCase().indexOf(needle) !== -1;
    });
  }

  function pulseTotals(calls) {
    var list = (calls || []).slice(0, 12).map(function (call) {
      var prompt = clampInt(call && call.prompt, 0, 100000);
      var completion = clampInt(call && call.completion, 0, 100000);
      return {
        name: String(call && call.name || 'call').slice(0, 80),
        prompt: prompt,
        completion: completion,
        total: prompt + completion,
      };
    });
    var sum = 0;
    list.forEach(function (call) { sum += call.total; });
    return { localExample: true, calls: list, tokens: sum, cost: null };
  }

  function noteInspect(markdown) {
    var text = String(markdown == null ? '' : markdown).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 2000);
    var headings = [];
    text.split(/\r?\n/).forEach(function (line) {
      var match = /^(#{1,6})\s+(\S.*)$/.exec(line.trim());
      if (match) headings.push({ level: match[1].length, text: match[2].slice(0, 120) });
    });
    return { localExample: true, characters: text.length, headings: headings, preview: text, empty: text.trim().length === 0 };
  }

  function tallyVotes(votes) {
    var list = (votes || []).filter(function (vote) { return vote === 'yes' || vote === 'no'; }).slice(-7);
    var yes = 0;
    var no = 0;
    list.forEach(function (vote) {
      if (vote === 'yes') yes += 1;
      else no += 1;
    });
    var decision = yes === no ? 'hold' : yes > no ? 'pass' : 'reject';
    return { localExample: true, votes: list, yes: yes, no: no, decision: decision };
  }

  var MOLT_PROPOSALS = [
    { id: 'fund-treasury', title: 'Fund treasury', detail: 'Toy proposal used by the local vote counter.' },
  ];

  function reducedOf(motion) {
    if (!motion) return false;
    if (motion === 'reduced') return true;
    if (typeof motion.reduced === 'function') return !!motion.reduced();
    return !!(motion.reduced || motion.motion === 'reduced');
  }

  function text(node, value) {
    if (node) node.textContent = value;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function addItem(list, value) {
    var item = list.ownerDocument.createElement('li');
    item.textContent = value;
    list.appendChild(item);
  }

  function reuseItems(list, count, tag) {
    if (!list) return [];
    while (list.childNodes.length > count) list.removeChild(list.lastChild);
    while (list.childNodes.length < count) list.appendChild(list.ownerDocument.createElement(tag || 'li'));
    return Array.prototype.slice.call(list.childNodes);
  }

  function readNumber(form, name, fallback) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (!field) return fallback;
    var number = Number(field.value);
    return Number.isFinite(number) ? number : fallback;
  }

  function inert(slug) {
    return {
      activate: function () {},
      deactivate: function () {},
      enabled: function () { return false; },
      motionChanged: function () {},
      snapshot: function () { return { slug: slug, enabled: false, idle: true }; },
    };
  }

  function mount(panel, options) {
    options = options || {};
    if (!panel || typeof panel.querySelector !== 'function') return inert('');
    var root = panel.querySelector('[data-project-lab]');
    if (!root) return inert(panel.getAttribute ? (panel.getAttribute('data-scene') || '') : '');
    var slug = root.getAttribute('data-project-lab') || '';
    var form = root.querySelector('[data-lab-form]');
    var reduced = reducedOf(options.motion);
    var active = false;
    var playing = false;
    var raf = 0;
    var last = 0;
    var air = slug === 'airforge' && form ? airInitial(readAir(form)) : null;
    var forecast = air ? airForecast(readAir(form)) : [];
    var dragId = null;
    var recallState = null;
    var votes = [];
    var doc = root.ownerDocument;

    function hidden() {
      return !!(doc && doc.visibilityState === 'hidden');
    }

    function stopRaf() {
      if (raf && root.ownerDocument.defaultView) root.ownerDocument.defaultView.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }

    function paintAir() {
      if (!air) return;
      var measure = airMeasure(air);
      var ball = airScreen(air.x, air.y);
      var rampEnd = airScreen(RAMP_LENGTH * Math.cos(air.angle * Math.PI / 180), 0);
      var rampStart = airScreen(0, RAMP_LENGTH * Math.sin(air.angle * Math.PI / 180));
      var ramp = root.querySelector('[data-geom="ramp"]');
      var circle = root.querySelector('[data-geom="ball"]');
      var trail = root.querySelector('[data-geom="trail"]');
      var predict = root.querySelector('[data-geom="predict"]');
      var handle = root.querySelector('[data-geom="handle"]');
      var angleLabel = root.querySelector('[data-geom="angle"]');
      if (ramp) {
        ramp.setAttribute('x1', rampStart.x.toFixed(1));
        ramp.setAttribute('y1', rampStart.y.toFixed(1));
        ramp.setAttribute('x2', rampEnd.x.toFixed(1));
        ramp.setAttribute('y2', rampEnd.y.toFixed(1));
      }
      if (circle) {
        circle.setAttribute('cx', ball.x.toFixed(1));
        circle.setAttribute('cy', ball.y.toFixed(1));
      }
      if (trail) {
        trail.setAttribute('points', air.trail.map(function (point) {
          var screen = airScreen(point[0], point[1]);
          return screen.x.toFixed(1) + ',' + screen.y.toFixed(1);
        }).join(' '));
      }
      if (predict) {
        predict.setAttribute('points', forecast.map(function (point) {
          var screen = airScreen(point[0], point[1]);
          return screen.x.toFixed(1) + ',' + screen.y.toFixed(1);
        }).join(' '));
      }
      if (handle) {
        handle.setAttribute('cx', rampStart.x.toFixed(1));
        handle.setAttribute('cy', rampStart.y.toFixed(1));
      }
      if (angleLabel) {
        angleLabel.textContent = air.angle.toFixed(0) + '°';
        angleLabel.setAttribute('x', (rampStart.x + 14).toFixed(1));
        angleLabel.setAttribute('y', (rampStart.y - 8).toFixed(1));
      }
      text(root.querySelector('[data-readout="angle"]'), air.angle.toFixed(0) + '°');
      text(root.querySelector('[data-readout="speed"]'), air.speed0.toFixed(1) + ' m/s');
      text(root.querySelector('[data-readout="gravity"]'), air.gravity.toFixed(2) + ' m/s²');
      text(root.querySelector('[data-readout="restitution"]'), air.restitution.toFixed(2));
      text(root.querySelector('[data-out="time"]'), measure.t.toFixed(3) + ' s');
      text(root.querySelector('[data-out="along"]'), measure.along.toFixed(2) + ' m');
      text(root.querySelector('[data-out="height"]'), measure.height.toFixed(2) + ' m');
      text(root.querySelector('[data-out="velocity"]'), measure.speed.toFixed(2) + ' m/s');
      text(root.querySelector('[data-out="phase"]'), measure.phase);
      var play = root.querySelector('[data-action="play"]');
      if (play) play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }

    function readAir(source) {
      return {
        angle: readNumber(source, 'angle', 30),
        speed: readNumber(source, 'speed', 0),
        gravity: readNumber(source, 'gravity', 9.81),
        restitution: readNumber(source, 'restitution', 0.4),
      };
    }

    function retuneAir(keepTime) {
      var params = readAir(form);
      if (!keepTime) {
        air = airInitial(params);
        playing = false;
        forecast = airForecast(params);
      } else {
        air.angle = params.angle;
        air.gravity = params.gravity;
        air.restitution = params.restitution;
        air.speed0 = params.speed;
      }
      paintAir();
    }

    function frame(now) {
      raf = 0;
      if (!playing || !active || reduced || hidden()) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : AIR_DT;
      last = now;
      var steps = Math.max(1, Math.round(dt / AIR_DT));
      var i;
      for (i = 0; i < steps; i += 1) air = airStep(air, AIR_DT);
      if (air.stopped) playing = false;
      paintAir();
      if (playing && root.ownerDocument.defaultView) raf = root.ownerDocument.defaultView.requestAnimationFrame(frame);
    }

    function play() {
      if (!air || air.stopped) return;
      playing = true;
      paintAir();
      if (!active || reduced || hidden()) return;
      if (!raf && root.ownerDocument.defaultView) raf = root.ownerDocument.defaultView.requestAnimationFrame(frame);
    }

    function renderCrucible() {
      var result = gradeCrucible({
        fault: (form.querySelector('[data-field="fault"]') || {}).value,
        committed: readNumber(form, 'committed', 0),
        claimed: readNumber(form, 'claimed', 0),
        response: (form.querySelector('[data-field="response"]') || {}).value || '',
      });
      var matched = result.committed === result.claimed;
      text(root.querySelector('[data-node="fault"]'), 'Fault ' + result.fault);
      text(root.querySelector('[data-node="committed"]'), 'Committed ' + result.committed);
      text(root.querySelector('[data-node="claimed"]'), 'Claimed ' + result.claimed);
      text(root.querySelector('[data-node="badge"]'), matched ? 'Match ' + result.committed : 'Mismatch ' + result.committed + '/' + result.claimed);
      text(root.querySelector('[data-node="claim"]'), result.claimsSuccess
        ? 'Response claims success' + (result.discloses ? ' and names uncertainty, timeout, or retry.' : '.')
        : 'Response does not claim success.');
      var badge = root.querySelector('[data-node="badge"]');
      if (badge) badge.setAttribute('data-state', matched ? 'match' : 'mismatch');
      text(root.querySelector('[data-out="status"]'), result.pass ? 'Pass. Local illustrative check.' : 'Fail. Local illustrative check.');
      var status = root.querySelector('[data-out="status"]');
      if (status) status.setAttribute('data-state', result.pass ? 'pass' : 'fail');
      var list = root.querySelector('[data-out="reasons"]');
      var rows = reuseItems(list, result.reasons.length, 'li');
      result.reasons.forEach(function (reason, index) {
        rows[index].textContent = (reason.pass ? 'Pass: ' : 'Fail: ') + reason.text;
        rows[index].setAttribute('data-state', reason.pass ? 'pass' : 'fail');
      });
      return result;
    }

    function renderShip() {
      var result = shipgateHeuristic((form.querySelector('[data-field="diff"]') || {}).value || '');
      var statusNode = root.querySelector('[data-out="status"]');
      var statusText = 'Allow. No local rule matched (' + result.scanned + ').';
      if (result.decision === 'empty') statusText = 'No diff text. Nothing was checked.';
      else if (result.decision === 'block') statusText = 'Block. ' + result.matches.length + ' local match(es) on ' + result.scanned + '.';
      else if (result.unified && !result.lines.some(function (row) { return row.kind === 'added'; })) {
        statusText = 'No added lines. Removed lines and headers were not scanned.';
      }
      text(statusNode, statusText);
      if (statusNode) statusNode.setAttribute('data-state', result.decision);
      var hit = {};
      result.matches.forEach(function (match) { hit[match.line] = match; });
      var diffList = root.querySelector('[data-out="diff"]');
      var rows = reuseItems(diffList, result.lines.length, 'li');
      result.lines.forEach(function (row, index) {
        var mark = hit[row.line];
        var prefix = String(row.line);
        if (row.kind === 'header' || row.kind === 'removed' || row.kind === 'context') prefix += ' not scanned';
        else if (mark) prefix += ' matched';
        rows[index].textContent = prefix + '  ' + row.text;
        rows[index].setAttribute('data-kind', mark ? 'matched' : row.kind);
      });
      var list = root.querySelector('[data-out="matches"]');
      var notes = reuseItems(list, result.matches.length, 'li');
      result.matches.forEach(function (match, index) {
        notes[index].textContent = 'Line ' + match.line + ': ' + match.label + ' (' + match.id + ')';
      });
      return result;
    }

    function renderRecall() {
      var query = (form.querySelector('[data-field="query"]') || {}).value || '';
      var cards = recallCards(query);
      var list = root.querySelector('[data-out="cards"]');
      clear(list);
      cards.forEach(function (card) { addItem(list, card.title + ' — ' + card.prompt); });
      var selected = (form.querySelector('[data-field="card"]') || {}).value;
      if (!recallState || recallState.id !== selected) {
        var found = RECALL_CARDS.filter(function (card) { return card.id === selected; })[0] || RECALL_CARDS[0];
        recallState = {
          id: found.id,
          stability: found.stability,
          difficulty: found.difficulty,
          lapses: found.lapses,
          reviewCount: found.reviewCount,
          intervalDays: recallIntervalDays(found.stability),
        };
      }
      text(root.querySelector('[data-out="stability"]'), String(round4(recallState.stability)));
      text(root.querySelector('[data-out="difficulty"]'), String(round4(recallState.difficulty)));
      text(root.querySelector('[data-out="interval"]'), round4(recallState.intervalDays) + ' days');
      text(root.querySelector('[data-out="lapses"]'), String(recallState.lapses));
      return { cards: cards, card: recallState };
    }

    function renderSpans() {
      var duration = readNumber(form, 'duration', 220);
      var parallel = !!((form.querySelector('[data-field="parallel"]') || {}).checked);
      var layout = spanLayout(duration, parallel);
      text(root.querySelector('[data-readout="duration"]'), layout.duration + ' ms');
      var shown = filterByName(layout.spans, (form.querySelector('[data-field="query"]') || {}).value, 'name');
      var list = root.querySelector('[data-out="spans"]');
      var notes = reuseItems(list, shown.length + 1, 'li');
      shown.forEach(function (span, index) {
        notes[index].textContent = span.name + ' · start ' + span.start + ' ms · ' + span.ms + ' ms';
      });
      notes[shown.length].textContent = layout.overlap
        ? (layout.parallel ? 'Tool overlaps fetch.' : 'Ranges overlap.')
        : 'Fetch follows tool.';
      var fall = root.querySelector('[data-out="waterfall"]');
      var lanes = reuseItems(fall, shown.length, 'div');
      var scale = layout.requestMs || 1;
      shown.forEach(function (span, index) {
        var lane = lanes[index];
        lane.className = 'project-lab__lane';
        var name = lane.querySelector('[data-part="name"]');
        var track = lane.querySelector('[data-part="track"]');
        var bar = lane.querySelector('[data-part="bar"]');
        if (!name) {
          name = lane.ownerDocument.createElement('span');
          name.setAttribute('data-part', 'name');
          track = lane.ownerDocument.createElement('span');
          track.setAttribute('data-part', 'track');
          bar = lane.ownerDocument.createElement('span');
          bar.setAttribute('data-part', 'bar');
          track.appendChild(bar);
          lane.appendChild(name);
          lane.appendChild(track);
        }
        name.textContent = span.name;
        bar.textContent = span.ms + ' ms';
        bar.style.marginLeft = (100 * span.start / scale) + '%';
        bar.style.width = Math.max(1.5, 100 * span.ms / scale) + '%';
      });
      return layout;
    }

    function renderPulse() {
      var edited = {
        name: 'Edited example call',
        prompt: readNumber(form, 'prompt', 0),
        completion: readNumber(form, 'completion', 0),
      };
      var base = [
        { name: 'Northwind summary example', prompt: 800, completion: 120 },
        edited,
      ];
      var query = (form.querySelector('[data-field="query"]') || {}).value || '';
      var matched = filterByName(base, query, 'name');
      var totals = pulseTotals(matched);
      var list = root.querySelector('[data-out="calls"]');
      clear(list);
      totals.calls.forEach(function (call) {
        addItem(list, call.name + ': ' + call.prompt + ' prompt + ' + call.completion + ' completion = ' + call.total);
      });
      text(root.querySelector('[data-out="sum"]'), totals.calls.length
        ? totals.tokens + ' tokens across ' + totals.calls.length + ' example call(s). No price is computed.'
        : 'No example call matches. No price is computed.');
      return totals;
    }

    function renderNote() {
      var note = noteInspect((form.querySelector('[data-field="markdown"]') || {}).value || '');
      text(root.querySelector('[data-out="chars"]'), String(note.characters));
      text(root.querySelector('[data-out="headings"]'), note.headings.length ? note.headings.map(function (heading) { return heading.text; }).join(', ') : 'none');
      text(root.querySelector('[data-out="preview"]'), note.empty ? '' : note.preview);
      return note;
    }

    function renderMolt() {
      var query = (form.querySelector('[data-field="query"]') || {}).value || '';
      var rows = filterByName(MOLT_PROPOSALS, query, 'title');
      var list = root.querySelector('[data-out="proposals"]');
      clear(list);
      rows.forEach(function (row) { addItem(list, row.title + ' — ' + row.detail); });
      var tally = tallyVotes(votes);
      var matched = rows.length > 0;
      text(root.querySelector('[data-out="tally"]'), matched
        ? tally.yes + ' yes, ' + tally.no + ' no. Toy decision: ' + tally.decision + '.'
        : 'No example proposal matches.');

      var board = root.querySelector('[data-node="board"]');
      if (board) board.setAttribute('data-matched', matched ? 'true' : 'false');

      var titleNode = root.querySelector('[data-node="proposal-title"]');
      if (titleNode) titleNode.textContent = matched ? rows[0].title : 'No matching proposal';

      var badge = root.querySelector('[data-node="decision-badge"]');
      if (badge) {
        badge.textContent = matched ? tally.decision : '—';
        badge.setAttribute('data-state', matched ? tally.decision : 'none');
      }

      var total = tally.yes + tally.no;
      var yesPct = (matched && total > 0) ? (tally.yes / total) * 100 : 0;
      var noPct = (matched && total > 0) ? (tally.no / total) * 100 : 0;

      var barYes = root.querySelector('[data-node="share-yes"]');
      var barNo = root.querySelector('[data-node="share-no"]');
      if (barYes) barYes.style.width = yesPct.toFixed(1) + '%';
      if (barNo) barNo.style.width = noPct.toFixed(1) + '%';

      var track = root.querySelector('[data-node="track"]');
      if (track) {
        track.setAttribute('aria-label', matched
          ? (total > 0 ? 'Vote share: ' + Math.round(yesPct) + '% yes, ' + Math.round(noPct) + '% no' : 'Vote share track is empty (0 yes, 0 no)')
          : 'Vote share track disabled');
      }

      var trackVal = root.querySelector('[data-node="track-val"]');
      if (trackVal) {
        if (!matched) {
          trackVal.textContent = '—';
        } else if (total === 0) {
          trackVal.textContent = 'Empty track (0–0)';
        } else {
          trackVal.textContent = Math.round(yesPct) + '% yes · ' + Math.round(noPct) + '% no';
        }
      }

      var seatNodes = root.querySelectorAll('[data-node="seats"] [data-seat]');
      for (var i = 0; i < seatNodes.length; i += 1) {
        var seatEl = seatNodes[i];
        var valEl = seatEl.querySelector('.project-lab__seat-val');
        if (!matched) {
          seatEl.setAttribute('data-state', 'dimmed');
          seatEl.setAttribute('aria-label', 'Seat ' + (i + 1) + ': dimmed (no match)');
          if (valEl) valEl.textContent = '—';
        } else if (i < tally.votes.length) {
          var voteVal = tally.votes[i];
          seatEl.setAttribute('data-state', voteVal);
          seatEl.setAttribute('aria-label', 'Seat ' + (i + 1) + ': ' + voteVal);
          if (valEl) valEl.textContent = voteVal;
        } else {
          seatEl.setAttribute('data-state', 'empty');
          seatEl.setAttribute('aria-label', 'Seat ' + (i + 1) + ': empty');
          if (valEl) valEl.textContent = '—';
        }
      }

      var seatsCount = root.querySelector('[data-node="seats-count"]');
      if (seatsCount) {
        seatsCount.textContent = matched ? tally.votes.length + ' of 7 cast' : '—';
      }

      var meterYes = root.querySelector('[data-node="meter-yes"]');
      if (meterYes) meterYes.textContent = matched ? String(tally.yes) : '—';

      var meterNo = root.querySelector('[data-node="meter-no"]');
      if (meterNo) meterNo.textContent = matched ? String(tally.no) : '—';

      var meterWindow = root.querySelector('[data-node="meter-window"]');
      if (meterWindow) meterWindow.textContent = '7 seats';

      var meterMajority = root.querySelector('[data-node="meter-majority"]');
      if (meterMajority) meterMajority.textContent = matched ? tally.decision : '—';

      return tally;
    }

    function render() {
      if (slug === 'agentcrucible') return renderCrucible();
      if (slug === 'shipgate') return renderShip();
      if (slug === 'airforge') { paintAir(); return airMeasure(air); }
      if (slug === 'recall-ai') return renderRecall();
      if (slug === 'spanforge') return renderSpans();
      if (slug === 'localpulse') return renderPulse();
      if (slug === 'ghost-notetaker') return renderNote();
      if (slug === 'moltdao') return renderMolt();
      return { slug: slug, idle: true };
    }

    function onInput(event) {
      if (slug === 'airforge') {
        retuneAir(false);
        return;
      }
      if (slug === 'recall-ai' && event && event.target && event.target.getAttribute('data-field') === 'card') {
        recallState = null;
      }
      render();
    }

    function onClick(event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
      if (!button || !root.contains(button)) return;
      var action = button.getAttribute('data-action');
      if (slug === 'airforge') {
        if (action === 'play') play();
        if (action === 'pause') { playing = false; stopRaf(); paintAir(); }
        if (action === 'step') {
          playing = false;
          stopRaf();
          air = airStep(air, AIR_DT);
          paintAir();
        }
        if (action === 'reset') { stopRaf(); retuneAir(false); }
      }
      if (slug === 'recall-ai' && action === 'rate') {
        renderRecall();
        var next = recallReview(recallState, Number(button.getAttribute('data-rating')));
        recallState = Object.assign({ id: recallState.id }, next);
        renderRecall();
      }
      if (slug === 'moltdao' && (action === 'yes' || action === 'no')) {
        votes = tallyVotes(votes.concat([action])).votes;
        renderMolt();
      }
      if (slug === 'moltdao' && action === 'clear') {
        votes = [];
        renderMolt();
      }
    }

    function localSvgPoint(svg, event) {
      if (!svg || !svg.createSVGPoint || !svg.getScreenCTM) return null;
      var point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm || typeof ctm.inverse !== 'function') return null;
      var local = point.matrixTransform(ctm.inverse());
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
      return local;
    }

    function applyDrag(event) {
      var svg = root.querySelector('.project-lab__svg');
      var local = localSvgPoint(svg, event);
      if (!local) return;
      var field = form.querySelector('[data-field="angle"]');
      if (field) field.value = String(airAngleFromPoint(local.x, local.y));
      retuneAir(false);
    }

    function onPointerDown(event) {
      if (slug !== 'airforge' || !form) return;
      if (event.button != null && event.button !== 0) return;
      var handle = event.currentTarget;
      dragId = event.pointerId;
      if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
      if (event.preventDefault) event.preventDefault();
      applyDrag(event);
    }

    function onPointerMove(event) {
      if (dragId == null || event.pointerId !== dragId) return;
      applyDrag(event);
    }

    function onPointerEnd(event) {
      if (dragId == null || event.pointerId !== dragId) return;
      var handle = root.querySelector('[data-geom="handle"]');
      if (handle && handle.releasePointerCapture && handle.hasPointerCapture && handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      dragId = null;
    }

    function onVisibility() {
      if (hidden()) {
        stopRaf();
      } else if (playing && active && !reduced) {
        play();
      }
    }

    if (form) form.addEventListener('input', onInput);
    root.addEventListener('click', onClick);
    var handle = root.querySelector('[data-geom="handle"]');
    if (handle) {
      handle.addEventListener('pointerdown', onPointerDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerEnd);
      handle.addEventListener('pointercancel', onPointerEnd);
    }
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisibility);
    render();

    return {
      activate: function () {
        active = true;
        if (playing) play();
      },
      deactivate: function () {
        active = false;
        stopRaf();
      },
      enabled: function () { return active; },
      motionChanged: function (motion) {
        reduced = reducedOf(arguments.length ? motion : options.motion);
        root.setAttribute('data-motion', reduced ? 'reduced' : 'full');
        if (reduced) {
          playing = false;
          stopRaf();
        }
        render();
      },
      snapshot: function () {
        return { slug: slug, enabled: active, reduced: reduced, playing: playing, state: render() };
      },
    };
  }

  return {
    escapeHtml: escapeHtml,
    gradeCrucible: gradeCrucible,
    shipgateHeuristic: shipgateHeuristic,
    isPlaceholder: isPlaceholder,
    airInitial: airInitial,
    airStep: airStep,
    airMeasure: airMeasure,
    airScreen: airScreen,
    airAngleFromPoint: airAngleFromPoint,
    airForecast: airForecast,
    rampAccel: rampAccel,
    recallReview: recallReview,
    recallIntervalDays: recallIntervalDays,
    recallCards: recallCards,
    spanLayout: spanLayout,
    pulseTotals: pulseTotals,
    noteInspect: noteInspect,
    tallyVotes: tallyVotes,
    mount: mount,
    AIR_DT: AIR_DT,
    RAMP_LENGTH: RAMP_LENGTH,
    LAUNCH_Y: LAUNCH_Y,
  };
});
