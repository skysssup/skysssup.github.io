/* Illustration controls for the eight workbench scenes.
   Models are local and deterministic. Nothing here is a product session. */
(function (factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') window.SkyLabControls = api.controls;
})(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SERIES_LIMIT = 38;
  var NOTE_LIMIT = 280;
  var DIFF_LIMIT = 400;

  function clamp(value, low, high) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = low;
    return Math.max(low, Math.min(high, number));
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function crucible(fault) {
    var kind = fault === 'duplicate' || fault === 'none' ? fault : 'timeout';
    var attempts = 0;
    var committed = 0;
    function deliver() {
      attempts += 1;
      committed += 1;
    }
    if (kind === 'timeout') {
      attempts += 1;
      deliver();
    } else if (kind === 'duplicate') {
      deliver();
      deliver();
    } else {
      deliver();
    }
    var claimed = 1;
    return {
      fault: kind,
      attempts: attempts,
      committed: committed,
      claimed: claimed,
      match: committed === claimed,
      checked: committed === claimed ? 'match' : 'mismatch',
      route: kind === 'none' ? 'direct' : 'retry',
    };
  }

  function crucibleMessage(result) {
    var fault = result.fault === 'duplicate' ? 'duplicate call' : result.fault === 'none' ? 'no fault' : 'timeout';
    return 'Illustration: ' + fault + '. Committed ' + result.committed + '. Claim ' + result.claimed + '. Checked ' + result.checked + '.';
  }

  var PREVIEW_RULES = [
    { id: 'cloud-secret', label: 'cloud secret', test: function (text) { return /AWS_SECRET_ACCESS_KEY|\bAKIA[0-9A-Z]{4,}\b/.test(text); } },
    { id: 'private-key', label: 'private key', test: function (text) { return /BEGIN [A-Z ]*PRIVATE KEY/.test(text); } },
    { id: 'password', label: 'password assignment', test: function (text) { return /password\s*=\s*["'][^"']+["']/i.test(text); } },
  ];

  function previewDiff(text) {
    var source = String(text == null ? '' : text).slice(0, DIFF_LIMIT);
    var hits = [];
    PREVIEW_RULES.forEach(function (rule) {
      if (rule.test(source)) hits.push(rule.label);
    });
    return {
      text: source,
      decision: hits.length ? 'block' : 'allow',
      rules: hits,
      illustration: true,
    };
  }

  function previewMessage(result) {
    if (result.decision === 'block') {
      return 'Illustration preview, not a scanner. Blocked: ' + result.rules.join(', ') + '.';
    }
    return 'Illustration preview, not a scanner. Allowed: no preview rule matched.';
  }

  function review(state, rating) {
    var current = state || { ease: 2.5, interval: 0, reps: 0 };
    var ease = clamp(current.ease, 1.3, 3);
    var interval = clamp(current.interval, 0, 365);
    var reps = clamp(current.reps, 0, 99);
    var nextRating = rating === 'good' ? 'good' : 'again';
    if (nextRating === 'again') {
      return { ease: clamp(ease - 0.2, 1.3, 3), interval: 1, reps: 0, rating: 'again' };
    }
    var nextReps = reps + 1;
    var nextInterval = nextReps === 1 ? 3 : clamp(Math.round(interval * ease), 1, 365);
    return { ease: round(clamp(ease + 0.05, 1.3, 3)), interval: nextInterval, reps: nextReps, rating: 'good' };
  }

  function intervalX(days) {
    var stops = [[1, 163], [3, 263], [7, 408], [21, 560]];
    var day = clamp(days, 1, 21);
    var index;
    if (day <= stops[0][0]) return stops[0][1];
    for (index = 1; index < stops.length; index += 1) {
      if (day <= stops[index][0]) {
        var from = stops[index - 1];
        var to = stops[index];
        var mix = (day - from[0]) / (to[0] - from[0]);
        return Math.round(from[1] + (to[1] - from[1]) * mix);
      }
    }
    return 560;
  }

  function retentionPath(index, ease) {
    var high = Math.round(88 + index * 13 + (clamp(ease, 1.3, 3) - 2.5) * 36);
    return 'M66 266C102 ' + high + ' 165 ' + high + ' 228 248S353 ' + (high + 7) + ' 403 248S505 ' + (high + 7) + ' 576 248';
  }

  function reviewMessage(state) {
    var unit = state.interval === 1 ? 'day' : 'days';
    return 'Illustration: next interval ' + state.interval + ' ' + unit + ' after ' + state.rating + '.';
  }

  var TRACE_BASE = [
    { name: 'request', depth: 0, x: 22, w: 575 },
    { name: 'plan', depth: 1, x: 41, w: 305 },
    { name: 'tool', depth: 2, x: 105, w: 221 },
    { name: 'fetch', depth: 2, x: 259, w: 78 },
    { name: 'finalize', depth: 1, x: 352, w: 170 },
  ];

  function traceLayout(duration, parallel) {
    var toolMs = clamp(duration, 80, 420);
    var sideBySide = !!parallel;
    var tool = { name: 'tool', depth: 2, x: 140, w: toolMs };
    var fetch = { name: 'fetch', depth: 2, x: sideBySide ? 160 : 140 + toolMs + 16, w: 100 };
    var finishAt = Math.max(tool.x + tool.w, fetch.x + fetch.w) + 28;
    var plan = { name: 'plan', depth: 1, x: 30, w: finishAt - 30 };
    var finalize = { name: 'finalize', depth: 1, x: finishAt, w: 120 };
    var request = { name: 'request', depth: 0, x: 0, w: finishAt + 120 };
    var axisMax = Math.ceil(request.w / 100) * 100;
    var scale = 450 / axisMax;
    return {
      duration: toolMs,
      axisMax: axisMax,
      parallel: sideBySide,
      request: request.w,
      spans: [request, plan, tool, fetch, finalize].map(function (span) {
        var x = round(150 + span.x * scale);
        var width = round(span.w * scale);
        return { name: span.name, depth: span.depth, x: x, width: width, y: 0 };
      }),
    };
  }

  function spansOverlap(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width;
  }

  function traceMessage(layout) {
    var tool = layout.spans[2];
    var fetch = layout.spans[3];
    var relation = spansOverlap(tool, fetch) ? 'tool overlaps fetch' : 'fetch follows tool';
    return 'Illustration: request length ' + Math.round(layout.request) + ', tool ' + layout.duration + ' ms, ' + relation + '.';
  }

  function parseTokens(value) {
    var number = Number(String(value == null ? '' : value).trim());
    if (!Number.isFinite(number)) return 0;
    return Math.round(clamp(number, 0, 100000));
  }

  function addTokens(series, value) {
    var next = (series || []).concat([parseTokens(value)]).slice(-SERIES_LIMIT);
    var sum = 0;
    next.forEach(function (count) { sum += count; });
    return { series: next, sum: sum, latest: next[next.length - 1] };
  }

  function pulseMessage(result) {
    var calls = result.series.length === 1 ? '1 call' : result.series.length + ' calls';
    return 'Illustration: ' + calls + ', ' + result.sum + ' tokens. Not a customer metric.';
  }

  function wavePath(series) {
    if (!series.length) return '';
    var max = 1;
    series.forEach(function (value) { if (value > max) max = value; });
    var steps = 41;
    var path = '';
    for (var i = 0; i <= steps; i += 1) {
      var t = series.length === 1 ? 0 : (i / steps) * (series.length - 1);
      var left = Math.floor(t);
      var right = Math.min(series.length - 1, left + 1);
      var mix = t - left;
      var value = series[left] * (1 - mix) + series[right] * mix;
      var x = round(46 + i * 8.3);
      var y = round(154 - (value / max) * 46);
      path += (i ? 'L' : 'M') + x + ' ' + y;
    }
    return path;
  }

  function noteText(value) {
    var clean = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, NOTE_LIMIT);
    return { text: clean, empty: clean.trim().length === 0 };
  }

  function noteMessage(note) {
    if (note.empty) return 'Illustration: empty note, nothing added.';
    return 'Illustration: captured ' + note.text.length + ' characters into the workspace drawing.';
  }

  function castVote(votes, choice) {
    var next = (votes || []).filter(function (vote) { return vote === 'yes' || vote === 'no'; });
    next.push(choice === 'no' ? 'no' : 'yes');
    if (next.length > 7) next = next.slice(next.length - 7);
    return tally(next);
  }

  function tally(votes) {
    var list = (votes || []).slice(0, 7);
    var yes = 0;
    var no = 0;
    list.forEach(function (vote) {
      if (vote === 'yes') yes += 1;
      else if (vote === 'no') no += 1;
    });
    var majority = yes === no ? 'tie' : yes > no ? 'yes' : 'no';
    var decision = majority === 'yes' ? 'pass' : majority === 'no' ? 'reject' : 'hold';
    return { votes: list, yes: yes, no: no, majority: majority, decision: decision };
  }

  function voteMessage(result) {
    return 'Illustration: ' + result.yes + ' yes, ' + result.no + ' no. Majority ' + result.majority + '. Toy treasury decision: ' + result.decision + '.';
  }

  function simulateRamp(angleDeg) {
    var angle = clamp(angleDeg, 10, 50);
    var theta = angle * Math.PI / 180;
    var cosine = Math.cos(theta);
    var sine = Math.sin(theta);
    var ax = 78;
    var ay = 94;
    var length = 250;
    var bx = ax + length * cosine;
    var by = ay + length * sine;
    var normalX = sine;
    var normalY = -cosine;
    var gravity = 1600;
    var radius = 10;
    var platformY = 292;
    var restY = platformY - radius;
    var platformX0 = 330;
    var platformX1 = 573;
    var groundY = 302;
    var x = 109;
    var y = 75;
    var vx = 0;
    var vy = 0;
    var mode = 'free';
    var where = 'air';
    var dt = 1 / 60;
    var samples = [[round(x), round(y)]];
    var guard;
    for (guard = 0; guard < 240; guard += 1) {
      if (mode === 'ramp') {
        var speed = clamp(vx * cosine + vy * sine + gravity * sine * dt, 0, 880);
        vx = speed * cosine;
        vy = speed * sine;
        x += vx * dt;
        y += vy * dt;
        var along = (x - ax) * cosine + (y - ay) * sine;
        var side = (x - ax) * normalX + (y - ay) * normalY;
        if (along >= length) {
          x = bx + normalX * radius + cosine * 2;
          y = by + normalY * radius + sine * 2;
          mode = 'free';
        } else {
          x += normalX * (radius - side);
          y += normalY * (radius - side);
        }
      } else {
        vy = clamp(vy + gravity * dt, -200, 1400);
        vx = clamp(vx, -900, 900);
        x += vx * dt;
        y += vy * dt;
        var abx = bx - ax;
        var aby = by - ay;
        var ab2 = abx * abx + aby * aby || 1;
        var u = clamp(((x - ax) * abx + (y - ay) * aby) / ab2, 0, 1);
        var qx = ax + abx * u;
        var qy = ay + aby * u;
        var gapX = x - qx;
        var gapY = y - qy;
        var gap = Math.hypot(gapX, gapY) || 1;
        var toward = (gapX / gap) * normalX + (gapY / gap) * normalY;
        if (u > 0.02 && u < 0.98 && gap < radius && toward < 0.2 && vy > -40) {
          mode = 'ramp';
          x = qx + normalX * radius;
          y = qy + normalY * radius;
          speed = Math.max(0, vx * cosine + vy * sine);
          vx = speed * cosine;
          vy = speed * sine;
        } else if (y >= restY && x >= platformX0 && x <= platformX1 && vy >= 0) {
          y = restY;
          vx = 0;
          vy = 0;
          where = 'platform';
          samples.push([round(x), round(y)]);
          break;
        } else if (y >= groundY) {
          y = groundY;
          vx = 0;
          vy = 0;
          where = 'ground';
          samples.push([round(x), round(y)]);
          break;
        }
      }
      x = clamp(x, 30, 610);
      y = clamp(y, 30, 330);
      if (guard % 2 === 0) samples.push([round(x), round(y)]);
    }
    if (where === 'air') where = 'settled';
    var landing = { x: round(clamp(x, 30, 610)), y: round(clamp(y, 30, 330)), where: where };
    samples[samples.length - 1] = [landing.x, landing.y];
    return {
      angle: angle,
      duration: round(samples.length / 60),
      ramp: { x1: round(ax), y1: round(ay), x2: round(bx), y2: round(by) },
      landing: landing,
      samples: samples,
    };
  }

  function rampPath(angle, index) {
    var theta = clamp(angle, 10, 50) * Math.PI / 180;
    var cosine = Math.cos(theta);
    var sine = Math.sin(theta);
    var normalX = sine;
    var normalY = -cosine;
    var offset = (index - 5.5) * 3.1;
    var x1 = 82 + normalX * offset;
    var y1 = 90 + normalY * offset;
    var x2 = x1 + 226 * cosine;
    var y2 = y1 + 226 * sine;
    var cx = (x1 + x2) / 2 + normalX * 10;
    var cy = (y1 + y2) / 2 + normalY * 10;
    return 'M' + round(x1) + ' ' + round(y1) + 'Q' + round(cx) + ' ' + round(cy) + ' ' + round(x2) + ' ' + round(y2);
  }

  function trajectoryPath(samples) {
    var path = '';
    var step = Math.max(1, Math.floor(samples.length / 18));
    for (var i = 0; i < samples.length; i += step) {
      path += (path ? 'L' : 'M') + samples[i][0] + ' ' + samples[i][1];
    }
    var last = samples[samples.length - 1];
    return path + 'L' + last[0] + ' ' + last[1];
  }

  function stepClock(clock, now, paused) {
    var elapsed = clock && Number.isFinite(clock.elapsed) ? clock.elapsed : 0;
    if (paused) return { elapsed: elapsed, last: null, dt: 0 };
    if (!clock || clock.last == null || !Number.isFinite(now)) return { elapsed: elapsed, last: now, dt: 0 };
    var dt = Math.min(0.032, Math.max(0, (now - clock.last) / 1000));
    return { elapsed: round(elapsed + dt), last: now, dt: dt };
  }

  function barHeight(value, max) {
    if (!max) return 8;
    return round(clamp(10 + (value / max) * 120, 8, 140));
  }

  var model = {
    clamp: clamp,
    crucible: crucible,
    crucibleMessage: crucibleMessage,
    previewDiff: previewDiff,
    previewMessage: previewMessage,
    review: review,
    intervalX: intervalX,
    retentionPath: retentionPath,
    reviewMessage: reviewMessage,
    traceLayout: traceLayout,
    spansOverlap: spansOverlap,
    traceMessage: traceMessage,
    parseTokens: parseTokens,
    addTokens: addTokens,
    pulseMessage: pulseMessage,
    wavePath: wavePath,
    noteText: noteText,
    noteMessage: noteMessage,
    castVote: castVote,
    tally: tally,
    voteMessage: voteMessage,
    simulateRamp: simulateRamp,
    rampPath: rampPath,
    stepClock: stepClock,
    defaults: {
      fault: 'timeout',
      incline: 30,
      diff: '+ AWS_SECRET_ACCESS_KEY=AKIAEXAMPLE',
      duration: 220,
      parallel: true,
      tokens: 0,
      review: { ease: 2.5, interval: 0, reps: 0 },
    },
  };

  function takeSnapshot(svg) {
    var items = [];
    svg.querySelectorAll('*').forEach(function (el) {
      var attrs = [];
      Array.from(el.attributes).forEach(function (attr) { attrs.push([attr.name, attr.value]); });
      items.push({
        el: el,
        attrs: attrs,
        text: String(el.tagName).toLowerCase() === 'text' ? el.textContent : null,
      });
    });
    return items;
  }

  function mount(card, slug, hooks) {
    hooks = hooks || {};
    var idle = {
      activated: function () { return false; },
      run: function (onDone) { if (onDone) onDone(); },
      reset: function () {},
      pause: function () {},
      resume: function () {},
      snapshot: function () { return { slug: slug, activated: false, idle: true }; },
    };
    if (!card || typeof card.querySelector !== 'function') return idle;
    var root = card.querySelector('.lab-controls[data-lab-slug="' + slug + '"]');
    var svg = card.querySelector('.scene-svg');
    if (!root || !svg) return idle;

    var motion = window.SkyMotion || { reduced: function () { return false; } };
    var output = root.querySelector('.lab-output');
    var readout = root.querySelector('[data-lab-readout]');
    var created = [];
    var snapshot = takeSnapshot(svg);
    var activated = false;
    var paused = false;
    var raf = 0;
    var clock = { elapsed: 0, last: null };
    var play = null;
    var pending = null;
    var disposed = false;

    var state = {
      fault: 'timeout',
      incline: 30,
      diff: model.defaults.diff,
      duration: 220,
      parallel: true,
      tokens: 0,
      series: [],
      review: { ease: 2.5, interval: 0, reps: 0 },
      votes: [],
      note: '',
      result: null,
    };

    function reduced() {
      return !!(motion.reduced && motion.reduced());
    }

    function control(name) {
      return root.querySelector('[data-lab-control="' + name + '"]');
    }

    function readControls() {
      var fault = control('fault');
      var incline = control('incline');
      var diff = control('diff');
      var duration = control('duration');
      var parallel = control('parallel');
      var tokens = control('tokens');
      var markdown = control('markdown');
      if (fault) state.fault = fault.value;
      if (incline) state.incline = clamp(incline.value, 10, 50);
      if (diff) state.diff = diff.value.slice(0, DIFF_LIMIT);
      if (duration) state.duration = clamp(duration.value, 80, 420);
      if (parallel) state.parallel = !!parallel.checked;
      if (tokens) state.tokens = parseTokens(tokens.value);
      if (markdown) state.note = markdown.value.slice(0, NOTE_LIMIT);
    }

    function writeControls() {
      var fault = control('fault');
      var incline = control('incline');
      var diff = control('diff');
      var duration = control('duration');
      var parallel = control('parallel');
      var tokens = control('tokens');
      var markdown = control('markdown');
      if (fault) fault.value = 'timeout';
      if (incline) incline.value = '30';
      if (diff) diff.value = model.defaults.diff;
      if (duration) duration.value = '220';
      if (parallel) parallel.checked = true;
      if (tokens) tokens.value = '0';
      if (markdown) markdown.value = '';
      setText(root.querySelector('#lab-airforge-incline-value'), '30°');
      setText(root.querySelector('#lab-spanforge-duration-value'), '220 ms');
      if (readout) readout.textContent = '';
    }

    function setText(node, text) {
      if (node) node.textContent = text;
    }

    function report(text) {
      if (output) output.textContent = text;
      if (hooks.status) hooks.status(text);
    }

    function beginDraw() {
      if (hooks.beforeChange) hooks.beforeChange();
      activated = true;
    }

    function finish(onDone) {
      if (onDone) onDone();
    }

    function stopLoop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clock.last = null;
      play = null;
    }

    function restore() {
      created.splice(0).forEach(function (node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      snapshot.forEach(function (item) {
        var names = {};
        item.attrs.forEach(function (pair) { names[pair[0]] = pair[1]; });
        Array.from(item.el.attributes).forEach(function (attr) {
          if (!Object.prototype.hasOwnProperty.call(names, attr.name)) item.el.removeAttribute(attr.name);
        });
        item.attrs.forEach(function (pair) {
          if (item.el.getAttribute(pair[0]) !== pair[1]) item.el.setAttribute(pair[0], pair[1]);
        });
        if (item.text != null && item.el.textContent !== item.text) item.el.textContent = item.text;
      });
    }

    function placeBall(point) {
      var ball = svg.querySelector('.physics-ball');
      var dot = svg.querySelector('circle.accent-fill');
      if (ball) {
        ball.setAttribute('cx', String(point[0]));
        ball.setAttribute('cy', String(point[1]));
        ball.style.removeProperty('transform');
      }
      if (dot) {
        dot.setAttribute('cx', String(point[0]));
        dot.setAttribute('cy', String(point[1]));
      }
    }

    function drawRamp(sim) {
      var strong = svg.querySelector('path.strong');
      var trajectory = svg.querySelector('.trajectory');
      if (strong) strong.setAttribute('d', 'M' + sim.ramp.x1 + ' ' + sim.ramp.y1 + 'L' + sim.ramp.x2 + ' ' + sim.ramp.y2);
      svg.querySelectorAll('.scene-art path.contour').forEach(function (path, index) {
        path.setAttribute('d', rampPath(sim.angle, index));
      });
      if (trajectory) trajectory.setAttribute('d', trajectoryPath(sim.samples));
    }

    function sampleAt(samples, elapsed) {
      var index = Math.min(samples.length - 1, Math.floor(elapsed * 60));
      return samples[Math.max(0, index)];
    }

    function playRamp(onDone) {
      readControls();
      var sim = simulateRamp(state.incline);
      state.result = sim;
      stopLoop();
      beginDraw();
      drawRamp(sim);
      setText(root.querySelector('#lab-airforge-incline-value'), Math.round(sim.angle) + '°');
      if (reduced()) {
        placeBall(sim.samples[sim.samples.length - 1]);
        report('Illustration: ' + Math.round(sim.angle) + '° ramp, ball lands on the ' + sim.landing.where + ' at ' + sim.landing.x + ', ' + sim.landing.y + '.');
        finish(onDone);
        return;
      }
      clock = { elapsed: 0, last: null };
      play = function (now) {
        if (paused || disposed) return;
        clock = stepClock(clock, now, false);
        var point = sampleAt(sim.samples, clock.elapsed);
        placeBall(point);
        if (clock.elapsed * 60 >= sim.samples.length - 1) {
          placeBall(sim.samples[sim.samples.length - 1]);
          stopLoop();
          report('Illustration: ' + Math.round(sim.angle) + '° ramp, ball lands on the ' + sim.landing.where + ' at ' + sim.landing.x + ', ' + sim.landing.y + '.');
          finish(onDone);
          return;
        }
        raf = requestAnimationFrame(play);
      };
      report('Illustration: dropping the ball on a ' + Math.round(sim.angle) + '° ramp.');
      if (!paused) raf = requestAnimationFrame(play);
      else pending = onDone;
    }

    function drawCrucible() {
      readControls();
      var result = crucible(state.fault);
      state.result = result;
      beginDraw();
      svg.querySelectorAll('.fault-marker').forEach(function (node) {
        if (node.tagName.toLowerCase() === 'text') node.textContent = result.fault;
        node.style.opacity = result.fault === 'none' ? '0' : '1';
      });
      var retry = Array.from(svg.querySelectorAll('path')).find(function (path) {
        var d = path.getAttribute('d') || '';
        return d.indexOf('M245 180V') === 0 || path.dataset.labRoute === 'retry';
      });
      if (retry) {
        retry.dataset.labRoute = 'retry';
        retry.style.opacity = result.route === 'retry' ? '1' : '0';
        retry.setAttribute('d', result.fault === 'duplicate' ? 'M245 180V308H410V180' : 'M245 180V272H410V180');
      }
      Array.from(svg.querySelectorAll('text')).forEach(function (node) {
        var value = node.textContent.trim();
        if (value === 'retry before checking' || value === 'direct, no retry' || value === 'duplicate before checking') {
          node.textContent = result.fault === 'none' ? 'direct, no retry' : result.fault === 'duplicate' ? 'duplicate before checking' : 'retry before checking';
        }
        if (value === 'compare state' || value === 'claim matches' || value === 'claim mismatches') {
          node.textContent = result.match ? 'claim matches' : 'claim mismatches';
        }
      });
      var nodes = svg.querySelectorAll('.scene-node');
      var check = nodes[nodes.length - 1];
      if (check) {
        var rect = check.querySelector('rect');
        if (rect) rect.setAttribute('fill', result.match ? 'var(--bench-hot, currentColor)' : 'none');
      }
      report(crucibleMessage(result));
    }

    function drawShipgate() {
      readControls();
      var result = previewDiff(state.diff);
      state.result = result;
      beginDraw();
      var blocked = result.decision === 'block';
      svg.querySelectorAll('.blocked-route').forEach(function (node) {
        node.style.opacity = blocked ? '1' : '0.2';
        if (node.tagName.toLowerCase() === 'text') node.textContent = blocked ? 'blocked by policy' : 'allowed by preview';
        if (node.tagName.toLowerCase() === 'path') {
          node.setAttribute('d', blocked ? 'M350 189V270H528V230' : 'M350 189V250H560V188');
        }
      });
      report(previewMessage(result));
    }

    function drawRecall(rating) {
      if (rating) state.review = review(state.review, rating);
      var interval = state.review.rating ? state.review.interval : 1;
      var x = intervalX(interval);
      state.result = { review: state.review, x: x };
      beginDraw();
      var marker = svg.querySelector('.recall-marker');
      var active = svg.querySelector('.recall-active');
      if (marker) marker.setAttribute('d', 'M' + x + ' 75V267');
      if (active) active.setAttribute('cx', String(x));
      svg.querySelectorAll('.scene-art path.contour').forEach(function (path, index) {
        path.setAttribute('d', retentionPath(index, state.review.ease));
      });
      if (readout) readout.textContent = interval + (interval === 1 ? ' day' : ' days');
      report(state.review.rating ? reviewMessage(state.review) : 'Illustration: next interval ' + interval + ' day.');
    }

    function drawTrace() {
      readControls();
      var layout = traceLayout(state.duration, state.parallel);
      state.result = layout;
      beginDraw();
      var rows = svg.querySelectorAll('.trace-span');
      layout.spans.forEach(function (span, index) {
        var row = rows[index];
        if (!row) return;
        var rect = row.querySelector('rect');
        var label = row.querySelector('text');
        if (rect) {
          rect.setAttribute('x', String(span.x));
          rect.setAttribute('width', String(span.width));
          rect.setAttribute('y', String(72 + index * 41));
        }
        if (label) label.textContent = span.name;
        var rule = row.querySelector('path');
        if (rule) {
          var end = round(span.x + span.width);
          rule.setAttribute('d', 'M' + span.x + ' ' + (98 + index * 41) + 'L' + end + ' ' + (98 + index * 41));
        }
      });
      var ticks = Array.from(svg.querySelectorAll('text')).filter(function (node) {
        return node.getAttribute('y') === '314';
      });
      ticks.forEach(function (tick, index) {
        var mark = Math.round(layout.axisMax * index / Math.max(1, ticks.length - 1));
        tick.textContent = String(mark);
        tick.setAttribute('x', String(150 + 450 * index / Math.max(1, ticks.length - 1)));
        tick.setAttribute('text-anchor', index === ticks.length - 1 ? 'end' : 'middle');
      });
      svg.querySelectorAll('.scene-art path.grid').forEach(function (rule, index) {
        var x = 150 + 450 * index / Math.max(1, ticks.length - 1);
        rule.setAttribute('d', 'M' + x + ' 54V290');
      });
      setText(root.querySelector('#lab-spanforge-duration-value'), Math.round(layout.duration) + ' ms');
      report(traceMessage(layout));
    }

    function drawPulse() {
      var result = addTokens(state.series, state.tokens);
      state.series = result.series;
      state.result = result;
      beginDraw();
      var max = 1;
      result.series.forEach(function (value) { if (value > max) max = value; });
      svg.querySelectorAll('.pulse-bar').forEach(function (bar, index) {
        var value = result.series[index] == null ? 0 : result.series[index];
        var height = result.series[index] == null ? 4 : barHeight(value, max);
        var y = round(244 - height);
        bar.setAttribute('height', String(height));
        bar.setAttribute('y', String(y));
      });
      var wave = svg.querySelector('.pulse-wave');
      if (wave) wave.setAttribute('d', wavePath(result.series));
      report(pulseMessage(result));
    }

    function drawNote() {
      readControls();
      var note = noteText(state.note);
      state.result = note;
      beginDraw();
      created.splice(0).forEach(function (node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      if (!note.empty) {
        var art = svg.querySelector('.scene-art') || svg;
        var text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', '345');
        text.setAttribute('y', '176');
        text.setAttribute('class', 'lab-note');
        text.setAttribute('aria-label', note.text);
        var remaining = note.text;
        for (var line = 0; line < 5 && remaining.length; line += 1) {
          var end = Math.min(15, remaining.length), newline = remaining.indexOf('\n');
          if (newline >= 0 && newline < end) end = newline + 1;
          else if (end < remaining.length && remaining.lastIndexOf(' ', end - 1) > 0) end = remaining.lastIndexOf(' ', end - 1) + 1;
          var row = document.createElementNS(SVG_NS, 'tspan');
          row.setAttribute('x', '345'); row.setAttribute('dy', line ? '19' : '0');
          row.textContent = remaining.slice(0, end); remaining = remaining.slice(end);
          text.appendChild(row);
        }
        if (remaining.length) text.lastChild.textContent = text.lastChild.textContent.slice(0, 14) + '…';
        svg.querySelectorAll('.scene-art path.faint').forEach(function (rule) {
          if (/^M345 (171|183|195|207|219|231|243)/.test(rule.getAttribute('d') || '')) rule.style.opacity = '0';
        });
        art.appendChild(text);
        created.push(text);
      }
      report(noteMessage(note));
    }

    function drawVotes(choice) {
      var result = choice ? castVote(state.votes, choice) : tally(state.votes);
      if (choice) state.votes = result.votes;
      state.result = result;
      beginDraw();
      var yesFill = 'var(--bench-hot, #c4552a)';
      var noFill = '#2a6f97';
      svg.querySelectorAll('.voter').forEach(function (voter, index) {
        var vote = result.votes[index];
        if (vote === 'yes') voter.style.fill = yesFill;
        else if (vote === 'no') voter.style.fill = noFill;
        else voter.style.fill = 'var(--paper)';
      });
      svg.querySelectorAll('.vote-link').forEach(function (link) {
        if (result.majority === 'yes') {
          link.style.stroke = yesFill;
          link.style.opacity = '0.95';
        } else if (result.majority === 'no') {
          link.style.stroke = noFill;
          link.style.opacity = '0.4';
        } else {
          link.style.stroke = 'currentColor';
          link.style.opacity = '0.22';
        }
      });
      if (readout) readout.textContent = result.yes + ' yes / ' + result.no + ' no';
      report(voteMessage(result));
    }

    function run(onDone) {
      if (slug === 'airforge') return playRamp(onDone);
      if (slug === 'agentcrucible') drawCrucible();
      else if (slug === 'shipgate') drawShipgate();
      else if (slug === 'recall-ai') drawRecall(state.review.rating ? undefined : 'good');
      else if (slug === 'spanforge') drawTrace();
      else if (slug === 'localpulse') drawPulse();
      else if (slug === 'ghost-notetaker') drawNote();
      else if (slug === 'moltdao') drawVotes(undefined);
      finish(onDone);
    }

    function onControl(event) {
      var target = event.target;
      if (!target || !root.contains(target)) return;
      if (target.closest('[data-scene-action]')) return;
      var name = target.getAttribute && target.getAttribute('data-lab-control');
      if (!name) return;
      readControls();
      if (name === 'incline') {
        setText(root.querySelector('#lab-airforge-incline-value'), Math.round(state.incline) + '°');
        playRamp(null);
      } else if (name === 'duration' || name === 'parallel') {
        drawTrace();
      } else if (name === 'fault') {
        drawCrucible();
      }
    }

    function onClick(event) {
      var source = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
      var button = source && source.closest('[data-lab-action]');
      if (!button || !root.contains(button)) return;
      var action = button.getAttribute('data-lab-action');
      if (action === 'drop' || action === 'run' && slug === 'airforge') playRamp(null);
      else if (action === 'run') drawCrucible();
      else if (action === 'preview') drawShipgate();
      else if (action === 'again' || action === 'good') drawRecall(action);
      else if (action === 'trace') drawTrace();
      else if (action === 'add') drawPulse();
      else if (action === 'capture') drawNote();
      else if (action === 'copy') copyNote();
      else if (action === 'yes' || action === 'no') drawVotes(action);
    }

    function copyNote() {
      readControls();
      var note = noteText(control('markdown') ? control('markdown').value : state.note);
      var done = function (ok) {
        report(ok ? 'Illustration: copied the Markdown text locally.' : 'Illustration: copy failed. The note stays in the field.');
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(note.text).then(function () { done(true); }, function () { done(false); });
          return;
        }
      } catch (error) {
        done(false);
        return;
      }
      done(false);
    }

    root.addEventListener('input', onControl);
    root.addEventListener('change', onControl);
    root.addEventListener('click', onClick);

    return {
      activated: function () { return activated; },
      run: run,
      reset: function () {
        disposed = false;
        stopLoop();
        pending = null;
        paused = false;
        activated = false;
        state.series = [];
        state.review = { ease: 2.5, interval: 0, reps: 0 };
        state.votes = [];
        state.result = null;
        state.note = '';
        restore();
        writeControls();
        readControls();
        if (output) output.textContent = '';
      },
      pause: function () {
        paused = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        clock.last = null;
      },
      resume: function () {
        if (!paused) return;
        paused = false;
        clock.last = null;
        if (play && !reduced()) raf = requestAnimationFrame(play);
        else if (pending) {
          var done = pending;
          pending = null;
          finish(done);
        }
      },
      snapshot: function () {
        return {
          slug: slug,
          activated: activated,
          paused: paused,
          fault: state.fault,
          incline: state.incline,
          diff: state.diff,
          duration: state.duration,
          parallel: state.parallel,
          tokens: state.tokens,
          series: state.series.slice(),
          review: Object.assign({}, state.review),
          votes: state.votes.slice(),
          result: state.result,
        };
      },
    };
  }

  return { model: model, controls: { mount: mount } };
});
