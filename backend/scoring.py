"""Transparent, deterministic resume quality scoring (0-100).

Design goals
------------
* No free points: the score starts at 0 and every point is earned by a visible check.
* Robust to text extraction: works for text with real line breaks and for "flat"
  text where a PDF reader joined everything with spaces.
* Hard to game: numbers only count as achievements when they are tied to a unit
  (%, $, users, team size ...), years/phone numbers/GPA never count, and keyword
  stuffing is detected and capped.
* Explainable: returns a per-component breakdown and suggestions ordered by how
  many points each fix could earn.

The score measures CV *presentation quality* (completeness, clarity, evidence of
impact). It is NOT a prediction of candidate quality or hiring probability.
"""
import re

# --------------------------------------------------------------------------- #
# Vocabulary
# --------------------------------------------------------------------------- #
SKILL_GROUPS = {
    "Programming": ["python", "java", "javascript", "typescript", "c++", "c#", "php", "sql", "bash"],
    "Web development": ["react", "angular", "vue", "node.js", "express", "html", "css", "tailwind", "next.js",
                        "django", "flask", "fastapi", "rest api", "graphql", "api"],
    "Data & ML": ["scikit-learn", "sklearn", "machine learning", "deep learning", "pandas", "numpy", "tensorflow",
                  "pytorch", "data analysis", "power bi", "tableau", "statistics", "nlp", "spark", "hadoop",
                  "airflow", "google analytics", "a/b testing", "data visualization"],
    "Design": ["photoshop", "illustrator", "figma", "graphic design", "branding", "typography",
               "social media design", "indesign", "canva", "adobe xd", "after effects", "premiere pro",
               "ui/ux", "wireframing", "prototyping"],
    "Business": ["project management", "product management", "agile", "scrum", "kanban", "leadership",
                 "communication", "teamwork", "sales", "marketing", "seo", "sem", "customer service",
                 "accounting", "bookkeeping", "excel", "financial analysis", "budgeting", "forecasting",
                 "auditing", "taxation", "reconciliation", "payroll", "quickbooks", "ifrs", "gaap",
                 "stakeholder management", "roadmapping", "user research", "okrs", "mentoring", "negotiation",
                 "recruitment", "onboarding", "talent acquisition", "employee relations", "hris",
                 "content marketing", "copywriting", "email marketing", "social media", "crm", "salesforce",
                 "hubspot", "zendesk", "google ads", "risk management"],
    "Tools & Cloud": ["git", "github", "docker", "kubernetes", "aws", "azure", "gcp", "firebase", "mongodb",
                      "postgresql", "mysql", "redis", "linux", "ci/cd", "jenkins", "terraform", "jira",
                      "confluence", "notion"],
}

SECTION_HEADINGS = {
    "Summary / Profile": ["summary", "professional summary", "career summary", "profile", "professional profile",
                          "objective", "career objective", "about me"],
    "Experience": ["experience", "work experience", "professional experience", "employment",
                   "employment history", "work history", "internships", "internship experience"],
    "Education": ["education", "academic background", "academics", "qualifications", "qualification",
                  "education and training"],
    "Skills": ["skills", "technical skills", "key skills", "core competencies", "competencies", "technologies",
               "tools and technologies", "skills and tools"],
    "Projects": ["projects", "personal projects", "selected projects", "academic projects", "portfolio"],
    "Certifications": ["certifications", "certification", "certificates", "licenses", "courses"],
}
_ALL_HEADINGS = {p for phrases in SECTION_HEADINGS.values() for p in phrases}

ACTION_VERBS = set("""
led lead leads built build builds developed develop develops designed design designs launched launch launches
increased increase increases reduced reduce reduces managed manage manages created create creates implemented
implement implements improved improve improves delivered deliver delivers optimized optimised optimize optimise
automated automate analyzed analysed analyze analyse owned own owns introduced introduce ran run runs partnered
partner mentored mentor mentors drove drive drives scaled scale scales spearheaded established establish
streamlined streamline negotiated negotiate coordinated coordinate coordinates supervised supervise trained train
wrote write writes shipped ship ships architected architect engineered engineer migrated migrate refactored
refactor resolved resolve generated generate grew grow won secured secure achieved achieve exceeded exceed
cut saved save boosted boost accelerated accelerate transformed transform founded founded directed direct
organized organised organize organise planned plan plans executed execute prepared prepare reviewed review
audited audit reconciled reconcile processed process forecasted forecast budgeted budget recruited recruit
onboarded onboard conducted conduct presented present researched research tested test deployed deploy
maintained maintain monitored monitor configured configure integrated integrate collaborated collaborate
published publish taught teach advised advise supported support handled handle assisted assist
""".split())

CLICHES = [
    "team player", "hard working", "hard-working", "go-getter", "think outside the box", "self-motivated",
    "synergy", "references available", "results-driven", "detail-oriented", "detail oriented",
    "dynamic professional", "passionate about", "proven track record",
]

WEAK_PHRASES = ["responsible for", "duties included", "helped with", "worked on", "involved in", "tasked with"]

# --------------------------------------------------------------------------- #
# Low-level helpers
# --------------------------------------------------------------------------- #
_MARK = r"[•▪●◦‣■□➢➤▶►]"
_LINE_MARK = re.compile(r"^\s*(?:" + _MARK + r"\s*|[-*–—]\s+|\d{1,2}[.)]\s+)(.*)$")

_UNITS = (r"users|customers?|clients?|members|people|projects?|products?|features?|applications|apps|tools|reports|"
          r"tickets|employees|engineers|developers|stakeholders|accounts|campaigns|systems|dashboards|teams|"
          r"countries|markets|releases|deployments|pipelines|requests|transactions|leads|orders|interviews|"
          r"models|courses|students|vendors|suppliers|cases|invoices|papers|publications|stores|branches")
_NOT_YEAR = r"(?!(?:19|20)\d{2}\b)"
METRIC_PATTERNS = [
    re.compile(r"\b\d+(?:\.\d+)?\s?%"),                                              # 24%
    re.compile(r"(?:[$€£₹]|\bUSD\s?|\bPKR\s?|\bRs\.?\s?)\d[\d,.]*\s?[kKmMbB]?\b"),  # $4M
    re.compile(r"\b\d+(?:\.\d+)?x\b", re.I),                                         # 3x
    re.compile(_NOT_YEAR + r"\b\d[\d,]*\+?\s+(?:[A-Za-z-]+\s+)?(?:" + _UNITS + r")\b", re.I),
    re.compile(r"\b(?:team|group|squad) of \d+\b", re.I),
    re.compile(r"\b(?:managed|led|supervised|mentored|trained)\s+(?:a\s+)?(?:team\s+of\s+)?\d+\b", re.I),
    re.compile(r"\bfrom \d[\d,.]*\s?\w*\s+to\s+\d[\d,.]*", re.I),                    # from 6 weeks to 2
    re.compile(r"\b(?:saved|reduced|cut|shortened)\b[^.\n]{0,30}?\b\d+\s*(?:hours|days|weeks)\b", re.I),
]


def _clean_heading(line):
    s = re.sub(r"[^A-Za-z/& ]", " ", line)
    return re.sub(r"\s+", " ", s).strip().lower().replace("&", "and")


def _looks_like_heading(line):
    s = _clean_heading(line)
    if s in _ALL_HEADINGS:
        return True
    letters = re.sub(r"[^A-Za-z]", "", line)
    return bool(letters) and line.strip().isupper() and len(line.split()) <= 4


def _words(text):
    return re.findall(r"\b[\w+#./-]+\b", text)


def has_phone(text):
    """Phone numbers only: 9-15 digits, and never a run of years such as '2019 2020 2021 100'."""
    for m in re.finditer(r"(?<!\d)\+?\(?\d[\d\s().-]{7,}\d(?!\d)", text):
        tokens = re.findall(r"\d+", m.group(0))
        digits = sum(len(t) for t in tokens)
        years = sum(1 for t in tokens if len(t) == 4 and t[:2] in ("19", "20"))
        if 9 <= digits <= 15 and years < 2:
            return True
    return False


def find_metrics(statement):
    spans = []
    for pat in METRIC_PATTERNS:
        for m in pat.finditer(statement):
            spans.append(m.span())
    spans.sort()
    merged = []
    for s in spans:  # merge overlapping matches so one achievement counts once
        if merged and s[0] < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], s[1]))
        else:
            merged.append(s)
    return [statement[a:b] for a, b in merged]


def detect_sections(text):
    lines = [l for l in text.splitlines() if l.strip()]
    flat = len(lines) < 8
    found = {}
    for name, phrases in SECTION_HEADINGS.items():
        hit = False
        for ph in phrases:
            for l in lines:
                s = _clean_heading(l)
                if s == ph or (l.strip().isupper() and re.search(r"(?<![a-z])" + re.escape(ph) + r"(?![a-z])", s)):
                    hit = True
                    break
            if not hit and flat:  # flat text: accept Title Case / UPPER CASE heading words only
                for variant in {ph.title(), ph.upper()}:
                    pattern = (r"(?<![A-Za-z])(?<!LinkedIn )(?<!GitHub )(?<!User )(?<!Customer )"
                               r"(?<!Employee )(?<!Patient )" + re.escape(variant) + r"(?![A-Za-z])")
                    if re.search(pattern, text):
                        hit = True
                        break
            if hit:
                break
        found[name] = hit
    return found


def extract_bullets(text):
    """Return bullet statements. Only real line-start markers count when line breaks exist."""
    lines = text.splitlines()
    if len([l for l in lines if l.strip()]) < 8:  # flat text fallback
        parts = re.split(_MARK, text)[1:]
        return [" ".join(p.split()[:45]) for p in parts if len(p.split()) >= 3]
    bullets, cur, pending = [], None, False
    for raw in lines:
        line = raw.strip()
        if not line:
            if cur is not None:
                bullets.append(cur)
            cur, pending = None, False
            continue
        m = _LINE_MARK.match(raw)
        if m:
            if cur is not None:
                bullets.append(cur)
            rest = m.group(1).strip()
            cur, pending = (rest, False) if rest else (None, True)
            continue
        if pending:
            cur, pending = line, False
            continue
        if cur is not None:
            if _looks_like_heading(line):
                bullets.append(cur)
                cur = None
            else:
                cur += " " + line
    if cur is not None:
        bullets.append(cur)
    return [" ".join(b.split()[:45]) for b in bullets if len(b.split()) >= 3]


def extract_skills(text):
    low = re.sub(r"\s+", " ", text.lower())
    out, mentions = {}, 0
    for group, skills in SKILL_GROUPS.items():
        found = []
        for skill in skills:
            pattern = r"(?<![a-z0-9])" + re.escape(skill.lower()) + r"(?![a-z0-9+#])"
            hits = re.findall(pattern, low)
            if hits:
                found.append(skill)
                mentions += len(hits)
        if found:
            out[group] = sorted(set(found))
    return out, mentions


def _first_word(statement):
    m = re.match(r"[A-Za-z][A-Za-z-]*", statement.strip())
    return m.group(0).lower() if m else ""


def _is_action_verb(word):
    return word in ACTION_VERBS or (word.endswith("ed") and len(word) > 4 and word not in {"detailed", "skilled", "experienced"})


def _comp(key, label, score, mx, note):
    return {"key": key, "label": label, "score": round(score, 1), "max": mx, "note": note}


def _label(score):
    if score >= 85: return "Strong"
    if score >= 70: return "Good"
    if score >= 55: return "Fair"
    if score >= 40: return "Needs work"
    return "Weak"


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #
def score_resume(text):
    raw = text.replace("\r\n", "\n")
    clean = re.sub(r"\s+", " ", raw).strip()
    low = clean.lower()
    words = _words(clean)
    n_words = len(words)
    line_count = len([l for l in raw.splitlines() if l.strip()])
    warnings = []
    if line_count < 8 and n_words > 150:
        warnings.append("The text has almost no line breaks (common with some PDF readers), so section and bullet "
                        "detection is approximate. Paste the text or use a text-based PDF/DOCX for a more exact score.")

    # 1. Contact (10) --------------------------------------------------------
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", clean))
    phone_ok = has_phone(clean)
    has_link = bool(re.search(r"(linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|https?://|www\.)", low))
    contact = 4 * has_email + 3 * phone_ok + 3 * has_link
    missing_contact = [n for n, ok in (("email", has_email), ("phone number", phone_ok),
                                       ("LinkedIn/GitHub/portfolio link", has_link)) if not ok]
    c_contact = _comp("contact", "Contact details", contact, 10,
                      "All present" if not missing_contact else "Missing: " + ", ".join(missing_contact))

    # 2. Structure / sections (20) -------------------------------------------
    sections = detect_sections(raw)
    exp_or_proj = sections["Experience"] or sections["Projects"]
    structure = (8 * exp_or_proj + 4 * sections["Education"] + 4 * sections["Skills"]
                 + 2 * sections["Summary / Profile"]
                 + 2 * ((sections["Projects"] and sections["Experience"]) or sections["Certifications"]))
    missing_sections = [n for n, ok in sections.items() if not ok]
    c_struct = _comp("structure", "Sections & structure", structure, 20,
                     f"{sum(sections.values())}/6 common sections found")

    # 3. Length (10) -----------------------------------------------------------
    if n_words >= 350 and n_words <= 800:
        length = 10
    elif n_words < 350:
        length = 10 * n_words / 350
    elif n_words <= 1100:
        length = 10 - 4 * (n_words - 800) / 300
    else:
        length = 4
    c_len = _comp("length", "Length", length, 10,
                  f"{n_words} words (ideal 350-800)")

    # 4. Skills (15) -----------------------------------------------------------
    skills, mentions = extract_skills(clean)
    skill_count = sum(len(v) for v in skills.values())
    skills_pts = min(15, skill_count * 15 / 9)
    repeats = mentions / max(1, skill_count)
    stuffed = skill_count >= 10 and repeats >= 2.5
    if stuffed:
        skills_pts = min(skills_pts, 5)
        warnings.append("The same skill keywords are repeated many times. Repetition is not rewarded; list each skill "
                        "once and show it in real experience or projects.")
    c_skills = _comp("skills", "Skills detected", skills_pts, 15, f"{skill_count} recognised skills (9+ earns full marks)")

    # 5. Bullets (10) ----------------------------------------------------------
    bullets = extract_bullets(raw)
    n_bullets = len(bullets)
    bullets_pts = min(10, n_bullets * 10 / 8)
    c_bul = _comp("bullets", "Scannable bullet points", bullets_pts, 10, f"{n_bullets} bullet points (8+ earns full marks)")

    # 6. Impact (25) = action verbs 10 + metrics 15 ----------------------------
    verb_hits = [b for b in bullets if _is_action_verb(_first_word(b))]
    verb_ratio = len(verb_hits) / n_bullets if n_bullets else 0
    verbs_pts = 10 * verb_ratio
    c_verbs = _comp("verbs", "Action-verb bullets", verbs_pts, 10,
                    f"{len(verb_hits)}/{n_bullets} bullets start with an action verb" if n_bullets else "No bullets to check")

    all_metrics = list({m.lower(): m for m in find_metrics(clean)}.values())
    metric_bullets = [b for b in bullets if find_metrics(b)]
    if n_bullets >= 3:
        metrics_pts = 15 * min(1, (len(metric_bullets) / n_bullets) / 0.4)
        metric_note = f"{len(metric_bullets)}/{n_bullets} bullets show a measurable result (40%+ earns full marks)"
    else:
        metrics_pts = min(9, 15 * min(1, len(all_metrics) / 5) * 0.6)
        metric_note = f"{len(all_metrics)} measurable results found outside bullet points"
    c_metrics = _comp("metrics", "Measurable results", metrics_pts, 15, metric_note)

    # 7. Clarity & hygiene (10) ------------------------------------------------
    year_tokens = re.findall(r"\b(?:19|20)\d{2}\b", clean)
    dates_pts = 3 if len(year_tokens) >= 2 else 0
    first_person = len(re.findall(r"\b(?:I|me|my|myself)\b", clean))
    person_pts = 3 if first_person <= 2 else (1.5 if first_person <= 5 else 0)
    cliche_hits = [c for c in CLICHES if c in low]
    weak_hits = [w for w in WEAK_PHRASES if w in low]
    cliche_pts = max(0, 2 - len(cliche_hits) - 0.5 * len(weak_hits))
    openers = [_first_word(b) for b in bullets]
    if len(openers) >= 4:
        top_share = max(openers.count(o) for o in set(openers)) / len(openers)
        variety_pts = 2 if top_share <= 0.3 else (1 if top_share <= 0.5 else 0)
    else:
        variety_pts = 1
    clarity = dates_pts + person_pts + cliche_pts + variety_pts
    notes = []
    if not dates_pts: notes.append("dates missing")
    if first_person > 2: notes.append("first-person pronouns")
    if cliche_hits: notes.append("clichés: " + ", ".join(cliche_hits[:3]))
    if weak_hits: notes.append("weak phrasing: " + ", ".join(weak_hits[:3]))
    if variety_pts < 2 and len(openers) >= 4: notes.append("repetitive bullet openers")
    c_clarity = _comp("clarity", "Clarity & polish", clarity, 10, "; ".join(notes) or "Clean")

    components = [c_contact, c_struct, c_len, c_skills, c_bul, c_verbs, c_metrics, c_clarity]
    total = sum(c["score"] for c in components)
    # Hard caps so an incomplete CV can never look "good" through other categories.
    if n_words < 80:
        total = min(total, 30)
        warnings.append("The resume text is very short, so the score is capped. Check that all pages were read.")
    elif not exp_or_proj:
        total = min(total, 70)
    if stuffed:
        total = min(total, 45)
    cap = 75 if n_words < 150 else (90 if n_words < 250 else 100)
    if n_words >= 80 and total > cap:
        total = cap
        warnings.append(f"Score limited to {cap}: with only {n_words} words there is too little content to rate a CV higher.")
    score = int(round(max(0, min(100, total))))

    # Suggestions ordered by potential gain ----------------------------------
    gain = {c["key"]: c["max"] - c["score"] for c in components}
    ideas = []
    def add(key, text):
        if gain[key] >= 1.5:
            ideas.append((gain[key], f"{text} (up to +{round(gain[key])} points)"))
    add("metrics", "Add real, measurable outcomes to more bullets: percentages, revenue, users, time saved or team size. Never invent numbers.")
    add("verbs", "Start each bullet with a strong action verb (Led, Built, Reduced, Launched) instead of 'Responsible for…'.")
    add("bullets", "Describe roles and projects in short bullet points (aim for 8 or more in total).")
    add("structure", "Add the missing sections: " + (", ".join(missing_sections) or "none") + ". Skip any that truly do not apply.")
    add("skills", "List the tools and skills you can genuinely demonstrate, grouped by category.")
    add("length", "Expand to roughly 350-800 words with relevant experience, projects and results." if n_words < 350
        else "Tighten the CV: remove old or irrelevant details to stay under about 800 words.")
    add("contact", "Add " + (", ".join(missing_contact) or "contact details") + " at the top.")
    add("clarity", "Polish the wording: " + ("; ".join(notes) or "add dates to each role") + ".")
    ideas.sort(key=lambda x: -x[0])
    suggestions = [t for _, t in ideas[:6]]
    if not suggestions:
        suggestions.append("This CV is in good shape. Tailor the top third to each target role without adding skills you do not have.")

    return {
        "quality_score": score,
        "score_label": _label(score),
        "score_breakdown": components,
        "warnings": warnings,
        "sections": sections,
        "missing_sections": missing_sections,
        "skills": skills,
        "skill_count": skill_count,
        "word_count": n_words,
        "bullet_count": n_bullets,
        "quantified_items": len(all_metrics),
        "suggestions": suggestions,
    }
