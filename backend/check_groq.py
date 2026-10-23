"""Quick check that your Groq key works:  python backend/check_groq.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from groq_chat import GroqError, ask_groq, get_api_key, get_models, load_env

load_env(Path(__file__).resolve().parent / ".env")
if not get_api_key():
    sys.exit("No GROQ_API_KEY found. Copy backend/.env.example to backend/.env and paste your key.")
print("Models to try:", get_models())
try:
    out = ask_groq("What is the candidate's name and main skill?",
                   "Sara Khan\nFrontend developer with React, TypeScript and CSS experience. Built a student marketplace app.")
    print("OK ->", out["model"], "\n", out["answer"])
except GroqError as exc:
    sys.exit(f"Groq error ({exc.status}): {exc.message}")
