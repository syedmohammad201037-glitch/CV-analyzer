# ResumeIQ — CV analyzer + free Groq Q&A about your CV

ResumeIQ does two things only:

1. **CV analyzer** (runs on your computer): upload a PDF, DOCX or TXT CV and get a transparent 0-100 quality score with a breakdown, detected skills and sections, likely role categories, and an optional job-description comparison that lists **matched skills** and **not matched skills**.
2. **Q&A about your CV** (powered by Groq's free API): ask questions such as "What is missing in my CV?" or "Which job skills are not matched?". The assistant is instructed to answer only about your CV and not to invent facts.

## Requirements

- Python 3.10+ recommended
- Node.js 20+ recommended
- Internet is needed to install dependencies the first time, and later only for the Groq CV Q&A (the analyzer itself works offline).

## Setup (Windows PowerShell)

Open two terminals in the project folder.

### Terminal 1 — Python ML backend

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
python backend/generate_dataset.py
python backend/train_model.py
python backend/app.py
```

The dataset generator reproducibly creates a balanced dataset of 2,926 labeled examples across 11 role categories (266 per category), then the training script saves `backend/models/resume_role_model.joblib`. The API listens on `http://127.0.0.1:8000`.

### Add your free Groq key (for CV Q&A)

1. Create a free key at <https://console.groq.com/keys> (the free tier needs no credit card; limits apply and are shown in your Groq console).
2. Copy `backend/.env.example` to `backend/.env` and paste the key:

```
GROQ_API_KEY=gsk_...
```

3. Optional check: `python backend/check_groq.py`
4. Restart `python backend/app.py`.

The key stays in the backend and is never sent to the browser. `backend/.env` is git-ignored. You can pick a different model with `GROQ_MODEL` in `.env`; if the model is unavailable or rate-limited, the backend automatically falls back to `qwen/qwen3.6-27b`, then `openai/gpt-oss-20b`. Without a key, the analyzer works normally and the Q&A shows a setup message.

### Terminal 2 — React frontend

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). Vite proxies the local `/api/analyze` and `/api/health` calls to the Python service. The chat assistant does not use an API endpoint.

### Build check

```powershell
npm run build
```

## How the model works

The included `backend/data/role_training.csv` contains 2,926 labeled examples across 11 broad role categories. The dataset includes a small set of hand-written seed examples plus generated synthetic examples; `backend/generate_dataset.py` recreates it, and `backend/train_model.py` trains a scikit-learn `TfidfVectorizer` + `LogisticRegression` pipeline. The larger synthetic dataset improves role/skill phrasing coverage, but it does **not** prove real-world accuracy. For meaningful accuracy measurement, add diverse, permissioned, accurately labeled real resumes and evaluate on a separate, independently labeled test set. Do not use the classifier as an automated hiring decision.

Role confidence is the classifier's relative class probability, not a calibrated measure of correctness. Low-confidence predictions are labelled as hints in the UI.

## How the quality score works (v2)

The score in `backend/scoring.py` starts at **0**. Every point is earned by a visible check and the UI shows the breakdown:

| Component | Max | What earns points |
|---|---|---|
| Contact details | 10 | email, phone, LinkedIn/GitHub/portfolio link |
| Sections & structure | 20 | Experience or Projects (8), Education, Skills, Summary, Certifications/Projects bonus |
| Length | 10 | 350-800 words is ideal |
| Skills detected | 15 | 9+ recognised skills; repeated keyword stuffing is capped |
| Scannable bullet points | 10 | 8+ real bullets |
| Action-verb bullets | 10 | share of bullets that start with an action verb |
| Measurable results | 15 | share of bullets with %, money, users, team size, before/after. Years, phone numbers and GPA never count |
| Clarity & polish | 10 | dates present, no first-person pronouns, few clichés / weak phrases, varied openers |

Caps keep the score honest: under 80 words max 30, no Experience/Projects max 70, under 150 words max 75, under 250 words max 90, keyword stuffing max 45.

It measures CV *presentation* (completeness, clarity, evidence of impact). It does not predict candidate quality or hiring probability, and it cannot judge whether the content is true.

PDF text is rebuilt line-by-line from text positions (`src/analyzer.ts`) so bullets and headings are detected correctly. If a PDF reader returns text without line breaks, the app shows a warning because detection is then approximate.

### Tests

```powershell
python backend/tests/test_scoring.py
python backend/tests/test_groq_chat.py
```

`test_groq_chat.py` runs against a local fake Groq server, so it needs no internet or real key.

This scores five calibration CVs (strong, non-tech, fresher, keyword-stuffed, weak) and checks ordering and robustness. To improve real-world accuracy further, add permissioned, human-rated real CVs to `backend/tests/samples` and tune the weights against those ratings.

## Privacy

- **Analysis and scoring** run locally: the Flask service listens on `127.0.0.1` and no resume text leaves your computer for this part.
- **CV Q&A is not offline.** When you ask a question, the backend sends your CV text (and the job description, if you added one), the analysis summary and your question to Groq's API to generate the answer. Do not use Q&A with a CV you are not allowed to share with a third-party service. Groq's data policy applies to that text (see <https://console.groq.com/docs/your-data>).
- Pasted CV text is treated as data: it is fenced inside tags and the assistant is told never to follow instructions found in it.
- Do not expose the local service to the public internet without authentication and request limits. The backend already limits chat to 20 questions per minute to protect your free quota.

## Limitations

- Q&A answers come from a language model and can be wrong. Check them against your CV; the assistant is told to say when something is not in the CV, but this cannot be guaranteed.
- Groq's free tier has rate limits (requests/tokens per minute and per day). If you hit them, the app shows a friendly message and retries on a smaller model first.

- Scanned/image-only PDFs need OCR first; the built-in PDF extractor reads selectable text.
- The model is a starter classifier and may misclassify unusual or mixed-role resumes.
- Use the output as guidance, not as an automated hiring decision.

