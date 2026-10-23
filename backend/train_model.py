"""Train ResumeIQ's lightweight local role classifier from labeled CSV examples."""
from pathlib import Path
import csv
import json
from collections import Counter
import joblib
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "role_training.csv"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "resume_role_model.joblib"


def main():
    with DATA.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r.get("text", "").strip() and r.get("label", "").strip()]
    if len(rows) < 100:
        raise SystemExit(f"Dataset has only {len(rows)} valid rows. Run python backend/generate_dataset.py first.")

    texts = [r["text"].strip() for r in rows]
    labels = [r["label"].strip() for r in rows]
    counts = Counter(labels)
    if len(counts) < 2:
        raise SystemExit("Training requires at least two role labels.")

    model = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2), lowercase=True, strip_accents="unicode",
            sublinear_tf=True, min_df=2, max_features=25000,
        )),
        ("classifier", LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=42,
        )),
    ])
    model.fit(texts, labels)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH, compress=3)
    metadata = {
        "training_examples": len(rows),
        "classes": dict(sorted(counts.items())),
        "model": "TfidfVectorizer + LogisticRegression",
        "features": int(len(model.named_steps["tfidf"].vocabulary_)),
        "settings": {"ngram_range": [1, 2], "min_df": 2, "max_features": 25000, "class_weight": "balanced"},
        "dataset_note": "Includes hand-written seed examples and generated synthetic examples. Synthetic data improves coverage but does not establish real-world accuracy.",
        "evaluation_note": "No accuracy claim is reported because a trustworthy evaluation requires a separate, independently labeled test set of representative resumes.",
    }
    (MODEL_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))
    print(f"\nModel saved: {MODEL_PATH}")

if __name__ == "__main__":
    main()
