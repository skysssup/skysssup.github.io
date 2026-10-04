// JavaScript port of Recall's backend/app/scheduler.py (skysssup/recall-ai @ 5fabc58).
//
// Same constants, same operation order, and the same rounding as CPython:
//   - round(x, n) is reproduced exactly (correctly rounded, ties to even),
//   - timedelta(days=x) is reproduced exactly (CPython's microsecond accumulation),
//   - timestamps are naive-UTC microseconds since 1970-01-01, like the app's datetimes.
// verify-scheduler.mjs checks every case in scheduler-cases.json against this file.

export const RATING_AGAIN = 1
export const RATING_HARD = 2
export const RATING_GOOD = 3
export const RATING_EASY = 4
export const RATING_LABELS = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }

export const DECAY_EXPONENT = 0.5
export const TARGET_RETRIEVABILITY = 0.9
export const STABILITY_MIN = 0.1
export const STABILITY_MAX = 3650.0
export const DIFFICULTY_MIN = 1.0
export const DIFFICULTY_MAX = 10.0
export const LEECH_THRESHOLD = 8

const GROWTH = { [RATING_HARD]: 1.15, [RATING_GOOD]: 1.8, [RATING_EASY]: 2.6 }
const DIFFICULTY_DELTA = { [RATING_AGAIN]: 1.2, [RATING_HARD]: 0.4, [RATING_GOOD]: 0.0, [RATING_EASY]: -0.8 }
const FIRST_REVIEW_STABILITY = { [RATING_HARD]: 0.5, [RATING_GOOD]: 1.0, [RATING_EASY]: 3.0 }

export const US_PER_SECOND = 1_000_000
export const US_PER_HOUR = 3_600_000_000
export const US_PER_DAY = 86_400_000_000

// Python's two-argument max/min: the first argument wins unless the second compares strictly greater/less.
const pyMax = (a, b) => (b > a ? b : a)
const pyMin = (a, b) => (b < a ? b : a)

// C round(): halfway cases away from zero.
function cRound(x) {
  const t = Math.trunc(x)
  return Math.abs(x - t) >= 0.5 ? t + Math.sign(x) : t
}

// Exact decomposition of a finite double into mantissa * 2^exponent.
const view = new DataView(new ArrayBuffer(8))
function decompose(x) {
  view.setFloat64(0, x)
  const hi = view.getUint32(0)
  const lo = view.getUint32(4)
  const exponentBits = (hi >>> 20) & 0x7ff
  let mantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo)
  if (exponentBits === 0) return { mantissa, exponent: -1074 }
  mantissa |= 1n << 52n
  return { mantissa, exponent: exponentBits - 1075 }
}

// Python's round(x, ndigits) for floats: round the exact binary value to ndigits decimals (ties to even),
// then convert that decimal back to the nearest double.
export function pyRound(x, ndigits = 0) {
  if (!Number.isFinite(x) || x === 0) return x
  const negative = x < 0
  const { mantissa, exponent } = decompose(Math.abs(x))
  let num = mantissa * 10n ** BigInt(ndigits)
  let den = 1n
  if (exponent >= 0) num <<= BigInt(exponent)
  else den <<= BigInt(-exponent)
  let q = num / den
  const twiceRemainder = 2n * (num - q * den)
  if (twiceRemainder > den || (twiceRemainder === den && (q & 1n) === 1n)) q += 1n
  const digits = q.toString()
  const result = Number(`${digits}e-${ndigits}`)
  return negative ? -result : result
}

// CPython's timedelta(days=x) in whole microseconds (Modules/_datetimemodule.c: delta_new + accum).
export function timedeltaDaysToUs(days) {
  const intpart = Math.trunc(days)
  const fracpart = days - intpart
  let total = intpart * US_PER_DAY
  if (fracpart === 0) return total
  const scaled = US_PER_DAY * fracpart
  const scaledInt = Math.trunc(scaled)
  const leftover = scaled - scaledInt
  total += scaledInt
  if (leftover === 0) return total
  let wholeUs = cRound(leftover)
  if (Math.abs(wholeUs - leftover) === 0.5) {
    const totalIsOdd = ((total % 2) + 2) % 2
    wholeUs = 2.0 * cRound((leftover + totalIsOdd) * 0.5) - totalIsOdd
  }
  return total + wholeUs
}

// Python's timedelta.total_seconds() / 86400.0 for a microsecond difference.
const usToDays = (deltaUs) => deltaUs / US_PER_SECOND / 86400.0

export const nowUs = () => Date.now() * 1000
const resolveNow = (current) => (current == null ? nowUs() : current)

export function elapsedDays(lastReviewUs, currentUs) {
  if (lastReviewUs == null) return 0.0
  return pyMax(0.0, usToDays(resolveNow(currentUs) - lastReviewUs))
}

export function retrievability(stability, lastReviewUs, currentUs, decay = DECAY_EXPONENT) {
  const s = pyMax(STABILITY_MIN, stability)
  const t = elapsedDays(lastReviewUs, currentUs)
  const r = (1.0 + t / (9.0 * s)) ** -pyMax(0.01, decay)
  return pyMax(0.0, pyMin(1.0, r))
}

export function intervalDays(stability, targetR = TARGET_RETRIEVABILITY) {
  const s = pyMax(STABILITY_MIN, stability)
  const target = pyMin(0.99, pyMax(0.01, targetR))
  return 9.0 * s * (target ** (-1.0 / DECAY_EXPONENT) - 1.0)
}

const clampS = (s) => pyMax(STABILITY_MIN, pyMin(STABILITY_MAX, s))
const clampD = (d) => pyMax(DIFFICULTY_MIN, pyMin(DIFFICULTY_MAX, d))

// Next card state after a rating. Mirrors apply_review(); the stored stability/difficulty/retrievability
// are rounded to 4 decimals exactly as the API stores them, while dueAtUs uses the unrounded stability.
export function applyReview({ stability, difficulty, rating, reviewCount = 0, lapses = 0, lastReviewUs = null, currentUs = null }) {
  if (![RATING_AGAIN, RATING_HARD, RATING_GOOD, RATING_EASY].includes(rating)) {
    throw new RangeError(`invalid rating: ${rating}`)
  }
  const now = resolveNow(currentUs)
  const d = clampD(difficulty + DIFFICULTY_DELTA[rating])
  const difficultyFactor = pyMax(1.0, d) ** -0.25
  let newS
  let dueAtUs
  if (rating === RATING_AGAIN) {
    newS = clampS(stability * 0.35)
    lapses += 1
    dueAtUs = now + 12 * US_PER_HOUR
  } else {
    if (reviewCount === 0) {
      newS = clampS(FIRST_REVIEW_STABILITY[rating])
    } else {
      const growth = GROWTH[rating] * difficultyFactor
      const rBefore = retrievability(stability, lastReviewUs, now)
      const bonus = 1.0 + 0.15 * pyMax(0.0, rBefore - TARGET_RETRIEVABILITY)
      newS = clampS(stability * growth * bonus)
    }
    dueAtUs = now + timedeltaDaysToUs(pyMax(0.05, intervalDays(newS)))
  }
  const rNow = retrievability(newS, now, now)
  return {
    stability: pyRound(newS, 4),
    difficulty: pyRound(d, 4),
    retrievability: pyRound(rNow, 4),
    dueAtUs,
    lastReviewedAtUs: now,
    reviewCount: reviewCount + 1,
    lapses,
  }
}

export function forgettingRisk(r) {
  return pyMax(0.0, pyMin(1.0, 1.0 - r))
}

export function priorityScore(retrievabilityValue, difficulty, dueAtUs, currentUs) {
  const now = resolveNow(currentUs)
  let overdueDays = 0.0
  if (dueAtUs != null) overdueDays = pyMax(0.0, usToDays(now - dueAtUs))
  return (
    2.5 * forgettingRisk(retrievabilityValue) +
    0.15 * difficulty +
    0.8 * overdueDays +
    0.05 * (1.0 - Math.exp(-overdueDays))
  )
}

const SOLVE_PRIORS = { Easy: [90, 240], Medium: [240, 480], Hard: [480, 900] }
const ACCEPTED = ['accepted', 'ac', 'ok', 'correct']

// Captured solve telemetry -> [recall strength in 0..1, suggested rating 1..4].
export function recallFromSolve(timeToUnderstandS, timeToWriteS, numSubmissions, hintsUsed, verdict, difficulty = 'Medium') {
  const [uMean, wMean] = SOLVE_PRIORS[difficulty] ?? SOLVE_PRIORS.Medium
  let score = 1.0
  if (verdict && !ACCEPTED.includes(verdict.toLowerCase())) score -= 0.45
  if (timeToUnderstandS != null && uMean > 0) score -= 0.25 * pyMax(0.0, timeToUnderstandS / uMean - 1.0)
  if (timeToWriteS != null && wMean > 0) score -= 0.2 * pyMax(0.0, timeToWriteS / wMean - 1.0)
  score -= 0.12 * pyMax(0, numSubmissions - 1)
  score -= 0.15 * pyMax(0, hintsUsed)
  const strength = pyMax(0.0, pyMin(1.0, score))
  const rating = strength < 0.3 ? RATING_AGAIN : strength < 0.55 ? RATING_HARD : strength < 0.8 ? RATING_GOOD : RATING_EASY
  return [strength, rating]
}

export function isLeech(lapses, threshold = LEECH_THRESHOLD) {
  return lapses >= pyMax(1, threshold)
}

// Days until next due for each rating, as shown on the Review page's buttons.
export function previewIntervals({ stability, difficulty, reviewCount = 0, lapses = 0, lastReviewUs = null, currentUs = null }) {
  const now = resolveNow(currentUs)
  const out = {}
  for (const rating of [RATING_AGAIN, RATING_HARD, RATING_GOOD, RATING_EASY]) {
    const state = applyReview({ stability, difficulty, rating, reviewCount, lapses, lastReviewUs, currentUs: now })
    out[rating] = pyRound(pyMax(0.0, usToDays(state.dueAtUs - now)), 3)
  }
  return out
}

// Cards due per UTC calendar day if nothing is reviewed. cards: [{ stability, lastReviewUs, dueAtUs }].
export function forecastDueCounts(cards, days = 14, currentUs = null) {
  const now = resolveNow(currentUs)
  const today = Math.floor(now / US_PER_DAY) * US_PER_DAY
  const n = pyMax(1, pyMin(90, days))
  const counts = new Array(n).fill(0)
  for (const { stability, lastReviewUs = null, dueAtUs = null } of cards) {
    for (let offset = 0; offset < n; offset++) {
      const dayEnd = today + (offset + 1) * US_PER_DAY - 1
      const r = retrievability(stability, lastReviewUs, dayEnd)
      if (dueAtUs == null || dueAtUs <= dayEnd || r < TARGET_RETRIEVABILITY) {
        counts[offset] += 1
        break
      }
    }
  }
  return counts.map((dueCount, i) => ({
    day_offset: i,
    date: isoFromUs(today + i * US_PER_DAY).slice(0, 10),
    due_count: dueCount,
  }))
}

// Naive-UTC ISO strings, formatted like Python's datetime.isoformat().
export function isoFromUs(us) {
  const seconds = Math.floor(us / US_PER_SECOND)
  const micro = us - seconds * US_PER_SECOND
  const base = new Date(seconds * 1000).toISOString().slice(0, 19)
  return micro ? `${base}.${String(micro).padStart(6, '0')}` : base
}

export function usFromIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(iso)
  if (!m) throw new RangeError(`not an ISO timestamp: ${iso}`)
  const [, y, mo, d, h = '0', mi = '0', s = '0', frac = '', tz] = m
  let us = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) * 1000 + Number(frac.padEnd(6, '0') || 0)
  if (tz && tz !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1
    const digits = tz.slice(1).replace(':', '')
    us -= sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60 * US_PER_SECOND
  }
  return us
}

// Convenience for widgets: replay ratings from a cold-start card (stability 1.0, difficulty 5.0),
// the defaults the app gives a new problem. reviews: [{ rating, atUs }] in time order.
export function replay(reviews, start = { stability: 1.0, difficulty: 5.0, reviewCount: 0, lapses: 0, lastReviewUs: null }) {
  let card = { ...start }
  const states = []
  for (const { rating, atUs } of reviews) {
    const next = applyReview({ ...card, rating, currentUs: atUs })
    states.push({ rating, ...next, intervalDays: usToDays(next.dueAtUs - next.lastReviewedAtUs) })
    card = {
      stability: next.stability,
      difficulty: next.difficulty,
      reviewCount: next.reviewCount,
      lapses: next.lapses,
      lastReviewUs: next.lastReviewedAtUs,
    }
  }
  return states
}
