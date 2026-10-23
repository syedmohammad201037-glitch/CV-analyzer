from pathlib import Path
import re
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
from collections import deque
from scoring import score_resume
from groq_chat import GroqError, ask_groq, groq_status, load_env

ROOT = Path(__file__).resolve().parent
load_env(ROOT / ".env")  # GROQ_API_KEY etc. (never sent to the browser)
MODEL_PATH = ROOT / "models" / "resume_role_model.joblib"
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})

ROLE_LABELS = {
    "frontend_developer": "Frontend Developer", "backend_developer": "Backend Developer",
    "data_scientist": "Data Scientist / ML", "data_analyst": "Data Analyst / BI",
    "graphic_designer": "Graphic Designer", "marketing": "Marketing / SEO",
    "finance_accounting": "Finance / Accounting", "project_management": "Project / Operations Management",
    "customer_support": "Customer Support", "human_resources": "Human Resources", "general": "General / Other"
}

model = None

def get_model():
    global model
    if model is None:
        if not MODEL_PATH.exists():
            raise RuntimeError("Model is not trained. Run: python backend/train_model.py")
        model = joblib.load(MODEL_PATH)
    return model


def analyze_text(text):
    clean = re.sub(r"\s+", " ", text).strip()
    if len(clean) < 40:
        raise ValueError("Not enough readable text. Please upload a text-based PDF/DOCX or paste the resume text.")
    clf = get_model()
    probs = clf.predict_proba([clean])[0]
    order = probs.argsort()[::-1]
    classes = clf.named_steps["classifier"].classes_
    role = classes[order[0]]
    confidence = float(probs[order[0]])
    top = [{"role": ROLE_LABELS.get(classes[i], classes[i]), "confidence": round(float(probs[i]) * 100, 1)} for i in order[:3]]

    report = score_resume(text)  # uses the original text so line breaks / bullets are preserved
    report.update({
        "predicted_role": ROLE_LABELS.get(role, role),
        "confidence": round(confidence * 100, 1),
        "alternatives": top,
        "disclaimer": ("The role prediction comes from a small ML model trained on illustrative examples. The quality "
                       "score is a transparent checklist of CV presentation (completeness, clarity, evidence of impact). "
                       "Neither is a validated hiring or candidate-quality prediction."),
    })
    return report


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "model_ready": MODEL_PATH.exists(), "model": "TF-IDF + LogisticRegression (scikit-learn)",
                    "external_ai": True, "external_ai_provider": "Groq (CV Q&A only)", **groq_status()})


@app.post("/api/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")
    if not isinstance(text, str): return jsonify({"error": "Resume text must be a string."}), 400
    if len(text) > 200000: return jsonify({"error": "Resume is too long. Please keep it under 200,000 characters."}), 413
    try: return jsonify(analyze_text(text))
    except ValueError as exc: return jsonify({"error": str(exc)}), 400
    except Exception as exc: return jsonify({"error": str(exc)}), 500


# Small in-process limiter so a runaway loop cannot burn through the free Groq quota.
_chat_calls = deque()
CHAT_LIMIT, CHAT_WINDOW = 20, 60


@app.post("/api/chat")
def chat():
    now = time.time()
    while _chat_calls and now - _chat_calls[0] > CHAT_WINDOW:
        _chat_calls.popleft()
    if len(_chat_calls) >= CHAT_LIMIT:
        return jsonify({"error": f"Too many questions in a short time. Please wait a few seconds."}), 429
    payload = request.get_json(silent=True) or {}
    for key in ("question", "resume_text", "job_text"):
        if key in payload and not isinstance(payload[key], str):
            return jsonify({"error": f"{key} must be a string."}), 400
    _chat_calls.append(now)
    try:
        result = ask_groq(
            question=payload.get("question", ""),
            resume_text=payload.get("resume_text", ""),
            job_text=payload.get("job_text", ""),
            report=payload.get("report"),
            matched=payload.get("matched"),
            not_matched=payload.get("not_matched"),
            history=payload.get("history"),
        )
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except GroqError as exc:
        return jsonify({"error": exc.message}), exc.status if exc.status in (401, 429, 502, 503, 504) else 502
    except Exception:
        return jsonify({"error": "Something went wrong while answering. Please try again."}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)
