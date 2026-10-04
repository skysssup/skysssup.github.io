// Browser-safe parity check: replays scheduler-cases.json (generated from Recall's Python scheduler)
// through scheduler.mjs. Floats are compared with Object.is (bit-for-bit); timestamps in whole
// microseconds and as Python isoformat() strings.
import * as S from './scheduler.mjs'

export function verify(doc) {
  const sections = []
  const failures = []
  const section = (name, detail) => {
    const s = { name, detail, checks: 0, mismatches: 0 }
    sections.push(s)
    return (label, actual, expected) => {
      s.checks += 1
      if (!Object.is(actual, expected)) {
        s.mismatches += 1
        failures.push(`${name} ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    }
  }

  const steps = doc.sequences.reduce((n, seq) => n + seq.steps.length, 0)
  const checkReview = section('apply_review', `${doc.sequences.length} sequences, ${steps} chained reviews`)
  const checkPreview = section('preview_intervals', `${steps} button previews x 4 ratings`)
  const checkCurve = section('retrievability curve', `${doc.sequences.length} final cards x ${doc.sequences[0].final_curve.length} points`)
  for (const seq of doc.sequences) {
    let card = { stability: 1.0, difficulty: 5.0, reviewCount: 0, lapses: 0, lastReviewUs: null }
    seq.steps.forEach((step, i) => {
      const at = `${seq.id}#${i + 1}`
      const { input, output } = step
      checkReview(`${at} input.stability`, card.stability, input.stability)
      checkReview(`${at} input.difficulty`, card.difficulty, input.difficulty)
      checkReview(`${at} input.review_count`, card.reviewCount, input.review_count)
      checkReview(`${at} input.lapses`, card.lapses, input.lapses)
      checkReview(`${at} input.last_review_us`, card.lastReviewUs, input.last_review_us)
      const now = input.current_us
      checkReview(`${at} elapsed_days`, S.elapsedDays(card.lastReviewUs, now), input.elapsed_days)
      checkReview(`${at} retrievability_before`, S.retrievability(card.stability, card.lastReviewUs, now), step.retrievability_before)
      const preview = S.previewIntervals({ ...card, currentUs: now })
      for (const r of ['1', '2', '3', '4']) checkPreview(`${at} rating ${r}`, preview[r], step.preview_intervals_days[r])
      const next = S.applyReview({ ...card, rating: input.rating, currentUs: now })
      checkReview(`${at} stability`, next.stability, output.stability)
      checkReview(`${at} difficulty`, next.difficulty, output.difficulty)
      checkReview(`${at} retrievability`, next.retrievability, output.retrievability)
      checkReview(`${at} due_at_us`, next.dueAtUs, output.due_at_us)
      checkReview(`${at} due_at`, S.isoFromUs(next.dueAtUs), output.due_at)
      checkReview(`${at} last_reviewed_at_us`, next.lastReviewedAtUs, output.last_reviewed_at_us)
      checkReview(`${at} review_count`, next.reviewCount, output.review_count)
      checkReview(`${at} lapses`, next.lapses, output.lapses)
      checkReview(`${at} interval_days`, (next.dueAtUs - now) / S.US_PER_SECOND / 86400.0, output.interval_days)
      checkReview(`${at} interval_days(S)`, S.intervalDays(next.stability), output.interval_days_for_stability)
      checkReview(`${at} is_leech`, S.isLeech(next.lapses), output.is_leech)
      card = {
        stability: next.stability,
        difficulty: next.difficulty,
        reviewCount: next.reviewCount,
        lapses: next.lapses,
        lastReviewUs: next.lastReviewedAtUs,
      }
    })
    for (const point of seq.final_curve) {
      const at = card.lastReviewUs + S.timedeltaDaysToUs(point.t_days)
      checkCurve(`${seq.id} t=${point.t_days}`, S.retrievability(card.stability, card.lastReviewUs, at), point.r)
    }
  }

  const f = doc.forecast
  const checkForecast = section('forecast_due_counts', `${f.cards.length} cards over ${f.days} UTC days`)
  const series = S.forecastDueCounts(
    f.cards.map((c) => ({ stability: c.stability, lastReviewUs: c.last_review_us, dueAtUs: c.due_at_us })),
    f.days,
    f.current_us,
  )
  checkForecast('length', series.length, f.series.length)
  f.series.forEach((day, i) => {
    checkForecast(`day ${i} date`, series[i]?.date, day.date)
    checkForecast(`day ${i} due_count`, series[i]?.due_count, day.due_count)
  })

  const checkSolve = section('recall_from_solve', `${doc.recall_from_solve.length} telemetry combinations`)
  for (const c of doc.recall_from_solve) {
    const [strength, rating] = S.recallFromSolve(...c.input)
    checkSolve(`${JSON.stringify(c.input)} strength`, strength, c.strength)
    checkSolve(`${JSON.stringify(c.input)} rating`, rating, c.rating)
  }

  const checkPriority = section('priority_score', `${doc.priority_score.length} scores at the API's 4 decimals`)
  let rawEqual = 0
  for (const c of doc.priority_score) {
    const { retrievability, difficulty, due_at_us, current_us } = c.input
    const raw = S.priorityScore(retrievability, difficulty, due_at_us, current_us)
    if (Object.is(raw, c.raw)) rawEqual += 1
    checkPriority(JSON.stringify(c.input), S.pyRound(raw, 4), c.rounded4)
  }

  const checkRound = section('python round(x, n)', `${doc.python_round.length} values incl. exact binary ties`)
  for (const [x, nd, expected] of doc.python_round) checkRound(`round(${x}, ${nd})`, S.pyRound(x, nd), expected)

  const checkDelta = section('timedelta(days=x)', `${doc.timedelta_days.length} values incl. half-microsecond ties`)
  for (const [days, expected] of doc.timedelta_days) checkDelta(`days=${days}`, S.timedeltaDaysToUs(days), expected)

  return { sections, failures, rawPriorityEqual: rawEqual, priorityTotal: doc.priority_score.length }
}
