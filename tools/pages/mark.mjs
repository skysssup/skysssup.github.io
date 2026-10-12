// One drawing for the header and browser identity; raster icons use this same SVG.
const rays = [[14,3,14,25],[3,14,25,14],[6,6,22,22],[6,22,22,6]];
export const markBody = rays.map(([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('') + '<circle cx="14" cy="14" r="5"/>';
export const headerMark = `<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">${markBody}</svg>`;
export const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="5" fill="#090a0b"/><g fill="none" stroke="#ecebe8" stroke-width="1.5" stroke-linecap="round">${markBody}</g></svg>\n`;
