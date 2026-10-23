"""Calibration + regression tests for scoring.py.  Run:  python backend/tests/test_scoring.py"""
import sys, re
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from scoring import score_resume

def load(name): return (HERE / "samples" / name).read_text(encoding="utf-8")

def show(name, r):
    print(f"\n=== {name}: {r['quality_score']}/100 ({r['score_label']})")
    for c in r["score_breakdown"]:
        print(f"  {c['label']:<26}{c['score']:>5}/{c['max']:<3} {c['note']}")
    for w in r["warnings"]: print("  ! " + w)

cases = {n: score_resume(load(n + ".txt")) for n in
         ["strong_product_manager", "accountant_nontech", "fresher_cs_student", "stuffed_keywords", "weak_short"]}
flat = score_resume(re.sub(r"\s+", " ", load("strong_product_manager.txt")))
cases["strong_product_manager (flat text)"] = flat
for n, r in cases.items(): show(n, r)

s = {n: r["quality_score"] for n, r in cases.items()}
checks = [
    ("strong CV scores high",                s["strong_product_manager"] >= 85),
    ("good non-tech CV is not penalised",    s["accountant_nontech"] >= 80),
    ("fresher lands in the middle",          55 <= s["fresher_cs_student"] <= 80),
    ("keyword stuffing is not rewarded",     s["stuffed_keywords"] <= 45),
    ("weak CV scores low",                   s["weak_short"] <= 25),
    ("ordering strong > fresher > weak",     s["strong_product_manager"] > s["fresher_cs_student"] > s["weak_short"]),
    ("flat PDF text stays close to line text", abs(s["strong_product_manager (flat text)"] - s["strong_product_manager"]) <= 6),
    ("years/phones are not counted as metrics", score_resume(load("weak_short.txt") + " 2021 2022 +92 300 1234567")["quantified_items"] == 0),
]
print("\n--- checks ---")
ok = True
for label, passed in checks:
    print(("PASS " if passed else "FAIL ") + label); ok &= passed
sys.exit(0 if ok else 1)
