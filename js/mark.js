(function (global) {
  "use strict";

  // The A mark from aakashdahal.fun, in its 41.7 × 50 viewBox.
  var OUTLINE = [[20.85, 0], [41.7, 50], [30.2, 50], [20.85, 24.5], [11.5, 50], [0, 50]];
  var VIEW_W = 41.7, VIEW_H = 50;
  var NAMES = ["AIRFORGE", "AGENTCRUCIBLE", "SHIPGATE", "RECALL-AI", "GHOST-NOTETAKER", "SPANFORGE", "LOCALPULSE", "MOLTDAO"];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function inside(x, y) {
    var hit = false;
    for (var i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
      var xi = OUTLINE[i][0], yi = OUTLINE[i][1], xj = OUTLINE[j][0], yj = OUTLINE[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  // The mark as a solid: a dense front face, a sparse back face, and side walls
  // along the outline. Returns [x, y, z, weight] per point; x and y are fractions
  // of the box, z is in units of the box width.
  function markPoints(nx, ny, depth) {
    var cells = new Uint8Array(nx * ny);
    for (var y = 0; y < ny; y++) {
      for (var x = 0; x < nx; x++) {
        cells[y * nx + x] = inside(((x + 0.5) / nx) * VIEW_W, ((y + 0.5) / ny) * VIEW_H) ? 1 : 0;
      }
    }
    var at = function (x, y) { return x >= 0 && y >= 0 && x < nx && y < ny && cells[y * nx + x] === 1; };
    var out = [];
    for (var cy = 0; cy < ny; cy++) {
      for (var cx = 0; cx < nx; cx++) {
        if (!at(cx, cy)) continue;
        var u = (cx + 0.5) / nx - 0.5, v = (cy + 0.5) / ny - 0.5;
        var threshold = (BAYER[(cy & 3) * 4 + (cx & 3)] + 0.5) / 16;
        if (threshold < 0.7) out.push(u, v, -depth / 2, 1);
        if (threshold < 0.22) out.push(u, v, depth / 2, 0.45);
        var edge = !at(cx + 1, cy) || !at(cx - 1, cy) || !at(cx, cy + 1) || !at(cx, cy - 1);
        if (edge) for (var s = 1; s < 6; s++) out.push(u, v, -depth / 2 + (depth * s) / 6, 0.75);
      }
    }
    return new Float32Array(out);
  }

  function mountMark(box, options) {
    var cloud = global.Dotfield.mountCloud(box, {
      reduced: options.reduced,
      words: NAMES,
      threshold: 0.3,
      yaw: 0.62,
      pitch: 0.1,
      speed: 0.34,
      rest: 0.32,
      dissolve: true,
      cols: function (width) { return width < 320 ? 30 : width < 440 ? 36 : 44; },
      points: function (width) { return markPoints(width < 320 ? 46 : width < 440 ? 56 : 68, width < 320 ? 55 : width < 440 ? 67 : 82, 0.24); }
    });
    cloud.start();
  }

  var api = { mountMark: mountMark, markPoints: markPoints, inside: inside, names: NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SkyMark = api;
})(typeof window !== "undefined" ? window : globalThis);
