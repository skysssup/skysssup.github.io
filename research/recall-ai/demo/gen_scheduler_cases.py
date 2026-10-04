"""Generate demo/scheduler-cases.json from Recall's real scheduler.

Run from anywhere:  python3 gen_scheduler_cases.py <path-to-recall-ai-checkout>

Every number in the output comes from backend/app/scheduler.py. Sequences are
chained the way services.record_review chains them: the stored (rounded)
stability/difficulty and the returned timestamps feed the next review.
"""
from __future__ import annotations

import json
import platform
import random
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

repo = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(repo / "backend"))

from app import scheduler as sch  # noqa: E402

EPOCH = datetime(1970, 1, 1)
T0 = datetime(2026, 1, 5, 9, 0, 0)


def us(dt: datetime | None) -> int | None:
    if dt is None:
        return None
    delta = dt - EPOCH
    return (delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt is not None else None


# Each step: (rating, timing). Timing is one of
#   ("due",)            review exactly at the previous due_at
#   ("frac", f)         review at last_review + f * (previous due_at - last_review)
#   ("days", d)         review d days after the previous review
#   ("hours", h)        review h hours after the previous review
G, H, E, A = sch.RATING_GOOD, sch.RATING_HARD, sch.RATING_EASY, sch.RATING_AGAIN
ON_TIME = ("due",)
SEQUENCES = [
    ("good-on-time", "Good every time, reviewed exactly when due", [(G, ON_TIME)] * 8),
    ("easy-on-time", "Easy every time, reviewed exactly when due", [(E, ON_TIME)] * 6),
    ("hard-on-time", "Hard every time, reviewed exactly when due", [(H, ON_TIME)] * 6),
    ("lapse-relearn", "Three Goods, one Again, then recovery", [(G, ON_TIME)] * 3 + [(A, ON_TIME)] + [(G, ON_TIME)] * 3),
    ("leech", "Again nine times in a row; the leech flag trips at 8 lapses", [(A, ON_TIME)] * 9),
    ("early-review", "Good reviews taken early, while recall is still high",
     [(G, ON_TIME), (G, ("frac", 0.25)), (G, ("frac", 0.5)), (G, ON_TIME)]),
    ("late-review", "Good reviews taken long after they were due",
     [(G, ON_TIME), (G, ("frac", 3.0)), (G, ("frac", 10.0))]),
    ("first-again", "Forgotten on first review, then learned", [(A, ON_TIME), (G, ON_TIME), (G, ON_TIME), (E, ON_TIME)]),
    ("mixed", "A realistic mix of ratings",
     [(G, ON_TIME), (H, ON_TIME), (E, ON_TIME), (A, ON_TIME), (G, ON_TIME), (E, ON_TIME), (G, ON_TIME), (H, ON_TIME)]),
    ("easy-to-cap", "Easy until stability reaches the 3650-day cap", [(E, ON_TIME)] * 14),
    ("again-floor", "Again until stability and difficulty hit their clamps", [(A, ON_TIME)] * 12),
    ("cram-same-day", "Three Goods one hour apart", [(G, ON_TIME), (G, ("hours", 1)), (G, ("hours", 1))]),
]

CURVE_DAYS = [0, 0.5, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90]


def run_sequence(steps):
    card = dict(stability=1.0, difficulty=5.0, review_count=0, lapses=0, last=None, due=T0)
    out = []
    for rating, timing in steps:
        last = card["last"]
        if last is None:
            current = T0
        elif timing[0] == "due":
            current = card["due"]
        elif timing[0] == "frac":
            current = last + (card["due"] - last) * timing[1]
        elif timing[0] == "days":
            current = last + timedelta(days=timing[1])
        else:
            current = last + timedelta(hours=timing[1])
        r_before = sch.retrievability(card["stability"], last, current)
        preview = sch.preview_intervals(
            card["stability"], card["difficulty"], card["review_count"], card["lapses"], last, current
        )
        state = sch.apply_review(
            stability=card["stability"],
            difficulty=card["difficulty"],
            rating=rating,
            review_count=card["review_count"],
            lapses=card["lapses"],
            last_review=last,
            current=current,
        )
        interval = (state.due_at - current).total_seconds() / 86400.0
        out.append({
            "input": {
                "stability": card["stability"],
                "difficulty": card["difficulty"],
                "rating": rating,
                "review_count": card["review_count"],
                "lapses": card["lapses"],
                "last_review": iso(last),
                "last_review_us": us(last),
                "current": iso(current),
                "current_us": us(current),
                "elapsed_days": sch.elapsed_days(last, current),
            },
            "retrievability_before": r_before,
            "preview_intervals_days": {str(k): v for k, v in preview.items()},
            "output": {
                "stability": state.stability,
                "difficulty": state.difficulty,
                "retrievability": state.retrievability,
                "due_at": iso(state.due_at),
                "due_at_us": us(state.due_at),
                "last_reviewed_at": iso(state.last_reviewed_at),
                "last_reviewed_at_us": us(state.last_reviewed_at),
                "review_count": state.review_count,
                "lapses": state.lapses,
                "interval_days": interval,
                "interval_days_for_stability": sch.interval_days(state.stability),
                "is_leech": sch.is_leech(state.lapses),
            },
        })
        card = dict(
            stability=state.stability,
            difficulty=state.difficulty,
            review_count=state.review_count,
            lapses=state.lapses,
            last=state.last_reviewed_at,
            due=state.due_at,
        )
    curve = [
        {"t_days": t, "r": sch.retrievability(card["stability"], card["last"], card["last"] + timedelta(days=t))}
        for t in CURVE_DAYS
    ]
    return out, curve


sequences = []
for sid, label, steps in SEQUENCES:
    rows, curve = run_sequence(steps)
    sequences.append({"id": sid, "label": label, "steps": rows, "final_curve": curve})

# Forecast: a small deck evaluated on UTC calendar days.
NOW_F = datetime(2026, 10, 3, 14, 0, 0)
deck = [
    (1.0, NOW_F - timedelta(days=10), NOW_F - timedelta(days=1)),
    (2.5, NOW_F - timedelta(days=2), NOW_F + timedelta(hours=7)),
    (0.35, NOW_F - timedelta(hours=6), NOW_F + timedelta(hours=6)),
    (4.0, NOW_F - timedelta(days=1), NOW_F + timedelta(days=7, hours=10)),
    (8.0, NOW_F - timedelta(days=3), NOW_F + timedelta(days=13, hours=21)),
    (12.0, NOW_F, NOW_F + timedelta(days=25)),
    (30.0, NOW_F - timedelta(days=30), NOW_F + timedelta(days=33)),
    (3.0, NOW_F - timedelta(days=4), NOW_F + timedelta(days=2, hours=8)),
    (6.0, NOW_F - timedelta(days=5), NOW_F + timedelta(days=7, hours=16)),
    (1.5, None, None),
    (5.0, NOW_F - timedelta(days=12), datetime(2026, 12, 1)),
    (0.1, NOW_F - timedelta(hours=1), NOW_F + timedelta(hours=11)),
]
forecast = {
    "current": iso(NOW_F),
    "current_us": us(NOW_F),
    "days": 14,
    "cards": [
        {"stability": s, "last_review_us": us(lr), "due_at_us": us(d), "last_review": iso(lr), "due_at": iso(d)}
        for s, lr, d in deck
    ],
    "series": sch.forecast_due_counts(deck, days=14, current=NOW_F),
}

# Solve telemetry -> (recall strength, suggested rating)
solves = []
for verdict in ("Accepted", "Wrong Answer"):
    for difficulty in ("Easy", "Medium", "Hard"):
        for understand in (None, 60, 300, 900):
            for write in (None, 120, 480, 1500):
                for submissions in (1, 3):
                    for hints in (0, 2):
                        strength, rating = sch.recall_from_solve(understand, write, submissions, hints, verdict, difficulty)
                        solves.append({
                            "input": [understand, write, submissions, hints, verdict, difficulty],
                            "strength": strength,
                            "rating": rating,
                        })

# Queue priority (the API rounds it to 4 decimals)
NOW_P = datetime(2026, 6, 1, 12, 0, 0)
priority = []
for r in (0.2, 0.5, 0.9, 0.97):
    for d in (1.0, 5.0, 10.0):
        for offset in (timedelta(days=-10), timedelta(days=-1), timedelta(hours=-1), timedelta(0), timedelta(days=2), None):
            due = None if offset is None else NOW_P + offset
            raw = sch.priority_score(r, d, due, NOW_P)
            priority.append({
                "input": {"retrievability": r, "difficulty": d, "due_at_us": us(due), "current_us": us(NOW_P)},
                "raw": raw,
                "rounded4": round(raw, 4),
            })

# Primitives the port must reproduce exactly: round(x, n) on stored values (ties go to even on the
# exact binary value) and timedelta(days=x), which rounds leftover microseconds half-to-even.
rng = random.Random(42)
round_inputs = [k / 32 for k in range(1, 64)] + [0.00005, 1.00005, 2.5, 0.125, 0.375, 3650.00005, 0.99995, 9.99995]
round_inputs += [rng.uniform(0, 10) for _ in range(400)] + [rng.uniform(0, 3650) for _ in range(400)]
round_cases = [[x, nd, round(x, nd)] for x in round_inputs for nd in (3, 4)]

td_inputs = [rng.uniform(0, 30) for _ in range(300)] + [rng.uniform(0, 7705.6) for _ in range(300)]
ties = {0: 0, 1: 0}
while min(ties.values()) < 20:
    days = rng.randrange(0, 50) + (rng.randrange(1, 86_400_000_000) + 0.5) / 86_400_000_000
    whole = int(days)
    scaled = 86_400_000_000.0 * (days - whole)
    if scaled - int(scaled) == 0.5:
        parity = (whole * 86_400_000_000 + int(scaled)) % 2
        if ties[parity] < 20:
            td_inputs.append(days)
            ties[parity] += 1


def td_us(days: float) -> int:
    td = timedelta(days=days)
    return (td.days * 86400 + td.seconds) * 1_000_000 + td.microseconds


timedelta_cases = [[x, td_us(x)] for x in td_inputs]

commit = subprocess.run(["git", "-C", str(repo), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
doc = {
    "source": "backend/app/scheduler.py",
    "commit": commit,
    "python": platform.python_version(),
    "notes": [
        "Timestamps are naive UTC, as in the app. *_us fields are microseconds since 1970-01-01T00:00:00.",
        "Sequences start from the cold-start card state the app uses (stability 1.0, difficulty 5.0) and chain stored, rounded values.",
        "preview_intervals_days is what the Review page shows on the four rating buttons before the rating is applied.",
    ],
    "constants": {
        "TARGET_RETRIEVABILITY": sch.TARGET_RETRIEVABILITY,
        "DECAY_EXPONENT": sch.DECAY_EXPONENT,
        "STABILITY_MIN": sch.STABILITY_MIN,
        "STABILITY_MAX": sch.STABILITY_MAX,
        "DIFFICULTY_MIN": sch.DIFFICULTY_MIN,
        "DIFFICULTY_MAX": sch.DIFFICULTY_MAX,
        "GROWTH": {str(k): v for k, v in sch._GROWTH.items()},
        "DIFFICULTY_DELTA": {str(k): v for k, v in sch._DIFFICULTY_DELTA.items()},
        "interval_days_per_unit_stability": sch.interval_days(1.0),
    },
    "sequences": sequences,
    "forecast": forecast,
    "recall_from_solve": solves,
    "priority_score": priority,
    "python_round": round_cases,
    "timedelta_days": timedelta_cases,
}

out = Path(__file__).resolve().parent / "scheduler-cases.json"
out.write_text(json.dumps(doc, indent=1) + "\n")
steps = sum(len(s["steps"]) for s in sequences)
print(f"wrote {out.name}: {len(sequences)} sequences, {steps} reviews, "
      f"{len(forecast['series'])} forecast days, {len(solves)} solve mappings, {len(priority)} priority scores, "
      f"{len(round_cases)} round() cases, {len(timedelta_cases)} timedelta cases")
