"""Expand ResumeIQ's small seed set into a balanced, reproducible synthetic dataset.

These are generated practice examples, not real people's resumes. For production use,
add consented, accurately labeled real-world examples and evaluate on a separate dataset.
"""
from pathlib import Path
import csv
import random

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "role_training.csv"
RNG = random.Random(20261022)

ROLES = {
"frontend_developer": {
 "titles": ["Frontend Developer", "Frontend Engineer", "Web UI Developer", "React Developer", "UI Engineer", "Web Application Developer"],
 "skills": ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Tailwind CSS", "Vue", "Angular", "Redux", "Vite", "responsive design", "web accessibility", "browser testing", "component libraries", "performance optimization", "design systems"],
 "tasks": ["built reusable interface components", "implemented responsive web pages", "improved client-side rendering performance", "connected UI screens to REST endpoints", "created accessible forms and navigation", "fixed cross-browser layout defects", "maintained shared design-system components", "translated wireframes into working interfaces", "added form validation and error states", "wrote component tests"],
 "tools": ["React and TypeScript", "HTML, CSS and JavaScript", "Vite and Redux", "Tailwind CSS and browser devtools", "Vue and modern CSS", "Angular and RxJS"],
 "outcomes": ["reduced layout inconsistencies", "improved page usability", "made screens work on mobile and desktop", "simplified component reuse", "improved keyboard navigation", "reduced avoidable UI regressions"]},
"backend_developer": {
 "titles": ["Backend Developer", "Backend Engineer", "API Developer", "Software Engineer - Backend", "Server-side Developer", "Platform Developer"],
 "skills": ["Python", "Node.js", "Express", "Java", "REST APIs", "SQL", "PostgreSQL", "MongoDB", "authentication", "authorization", "caching", "Docker", "microservices", "unit testing", "API documentation", "database indexing"],
 "tasks": ["developed REST API endpoints", "implemented authentication and role-based access", "designed database schemas", "optimized slow database queries", "added request validation and error handling", "integrated third-party services", "wrote automated service tests", "maintained background jobs", "documented API contracts", "improved logging and monitoring"],
 "tools": ["Node.js and Express", "Python and Flask", "Java and Spring", "PostgreSQL and Redis", "MongoDB and REST APIs", "Docker and CI pipelines"],
 "outcomes": ["improved API reliability", "reduced repeated database work", "made errors easier to diagnose", "strengthened access controls", "simplified service maintenance", "improved response consistency"]},
"data_scientist": {
 "titles": ["Data Scientist", "Machine Learning Engineer", "Applied ML Specialist", "NLP Engineer", "Predictive Analytics Scientist", "Junior Data Scientist"],
 "skills": ["Python", "scikit-learn", "pandas", "NumPy", "feature engineering", "model evaluation", "classification", "regression", "natural language processing", "TensorFlow", "PyTorch", "cross-validation", "data preprocessing", "hyperparameter tuning", "experiment tracking", "statistical modeling"],
 "tasks": ["prepared features for predictive models", "trained and evaluated classification models", "compared baseline algorithms", "cleaned noisy training data", "analyzed model errors", "built repeatable preprocessing pipelines", "evaluated precision and recall", "documented experiment results", "tested model generalization", "prototyped text classification"],
 "tools": ["Python and scikit-learn", "pandas and NumPy", "PyTorch and experiment tracking", "TensorFlow and model evaluation", "Jupyter and statistical analysis", "NLP preprocessing pipelines"],
 "outcomes": ["made model evaluation reproducible", "identified data leakage risks", "improved feature quality", "documented limitations clearly", "compared models using held-out data", "made predictions easier to interpret"]},
"data_analyst": {
 "titles": ["Data Analyst", "Business Intelligence Analyst", "Reporting Analyst", "Power BI Analyst", "Junior Data Analyst", "Operations Data Analyst"],
 "skills": ["SQL", "Excel", "Power BI", "Tableau", "data cleaning", "dashboard design", "KPI reporting", "data visualization", "descriptive statistics", "ETL", "business reporting", "pivot tables", "data quality checks", "trend analysis", "DAX", "requirements gathering"],
 "tasks": ["cleaned and reconciled business datasets", "built KPI dashboards", "wrote SQL queries for reporting", "automated recurring reports", "identified trends in operational data", "validated figures against source records", "created visual summaries for stakeholders", "combined data from multiple sources", "defined metrics with business teams", "investigated unexpected data changes"],
 "tools": ["SQL and Power BI", "Excel and pivot tables", "Tableau and data extracts", "Python and pandas", "DAX and Power Query", "SQL reporting workflows"],
 "outcomes": ["reduced manual reporting effort", "made KPI definitions consistent", "improved visibility into trends", "caught data quality issues earlier", "helped teams compare monthly performance", "made reports easier to use"]},
"graphic_designer": {
 "titles": ["Graphic Designer", "Visual Designer", "Brand Designer", "Social Media Designer", "Marketing Designer", "Junior Graphic Artist"],
 "skills": ["Adobe Photoshop", "Adobe Illustrator", "InDesign", "typography", "layout design", "brand identity", "logo design", "social media creatives", "print design", "color theory", "image editing", "vector illustration", "poster design", "visual storytelling", "prepress", "creative briefs"],
 "tasks": ["designed campaign graphics", "created consistent brand assets", "prepared print-ready artwork", "developed social media posts", "refined typography and visual hierarchy", "adapted layouts to multiple formats", "edited images for promotional materials", "created logo concepts", "reviewed artwork against brand guidelines", "prepared design files for handoff"],
 "tools": ["Photoshop and Illustrator", "InDesign and print workflows", "vector illustration tools", "brand guidelines and layout systems", "image editing and typography", "digital and print design software"],
 "outcomes": ["improved visual consistency", "made promotional messages easier to scan", "prepared assets for different platforms", "reduced avoidable production revisions", "strengthened brand recognition", "delivered organized source files"]},
"marketing": {
 "titles": ["Digital Marketing Specialist", "SEO Specialist", "Content Marketer", "Marketing Coordinator", "Growth Marketing Associate", "Social Media Marketer"],
 "skills": ["SEO", "keyword research", "content strategy", "Google Analytics", "campaign reporting", "email marketing", "social media management", "conversion optimization", "paid search", "marketing automation", "A/B testing", "content calendars", "audience segmentation", "copywriting", "lead generation", "web analytics"],
 "tasks": ["researched search intent and keywords", "planned content calendars", "monitored campaign performance", "prepared channel performance reports", "optimized landing page copy", "coordinated email campaigns", "tracked conversion funnels", "tested alternative ad messages", "scheduled social media content", "summarized audience engagement trends"],
 "tools": ["Google Analytics and Search Console", "SEO research tools", "email marketing platforms", "campaign dashboards", "social media scheduling tools", "A/B testing and analytics tools"],
 "outcomes": ["made campaign reporting clearer", "identified content opportunities", "improved consistency of publishing", "found friction in conversion journeys", "aligned content with audience intent", "documented performance against goals"]},
"finance_accounting": {
 "titles": ["Accountant", "Accounts Assistant", "Finance Analyst", "Bookkeeper", "Accounts Payable Specialist", "Junior Financial Analyst"],
 "skills": ["bookkeeping", "general ledger", "accounts payable", "accounts receivable", "bank reconciliation", "financial statements", "Excel", "budgeting", "variance analysis", "invoice processing", "payroll support", "journal entries", "month-end close", "tax documentation", "cash flow reporting", "account reconciliation"],
 "tasks": ["reconciled bank and ledger balances", "recorded journal entries", "processed supplier invoices", "tracked customer receivables", "prepared monthly financial reports", "reviewed expense documentation", "supported month-end closing", "matched payments to invoices", "maintained organized accounting records", "investigated account discrepancies"],
 "tools": ["Excel and accounting software", "general ledger systems", "accounts payable workflows", "bank reconciliation tools", "financial reporting spreadsheets", "invoice and billing systems"],
 "outcomes": ["improved traceability of transactions", "identified discrepancies for review", "made month-end records more complete", "supported timely reporting", "reduced duplicate data entry", "kept supporting documents organized"]},
"project_management": {
 "titles": ["Project Coordinator", "Project Manager", "Program Coordinator", "Operations Manager", "Scrum Master", "Delivery Coordinator"],
 "skills": ["project planning", "Agile", "Scrum", "risk tracking", "stakeholder communication", "resource planning", "Jira", "sprint planning", "status reporting", "requirements management", "process improvement", "issue tracking", "roadmaps", "meeting facilitation", "scope management", "dependency tracking"],
 "tasks": ["maintained project plans and milestones", "coordinated cross-functional delivery", "tracked risks and dependencies", "prepared weekly status reports", "facilitated sprint ceremonies", "followed up on action items", "aligned stakeholders on requirements", "managed issue escalation", "documented project decisions", "reviewed delivery progress against scope"],
 "tools": ["Jira and Agile boards", "project tracking spreadsheets", "roadmap and planning tools", "status dashboards", "Scrum ceremonies and sprint reports", "risk and issue logs"],
 "outcomes": ["improved visibility of project status", "made ownership of action items clear", "surfaced delivery risks earlier", "kept teams aligned on milestones", "reduced missed handoffs", "made decisions easier to track"]},
"customer_support": {
 "titles": ["Customer Support Representative", "Customer Success Associate", "Help Desk Agent", "Support Specialist", "Client Service Representative", "Technical Support Agent"],
 "skills": ["customer service", "ticketing systems", "troubleshooting", "written communication", "phone support", "live chat", "CRM", "issue triage", "knowledge base writing", "escalation handling", "product guidance", "service-level tracking", "active listening", "case documentation", "technical support", "conflict resolution"],
 "tasks": ["resolved customer questions through chat and email", "triaged incoming support tickets", "documented issues and resolutions", "escalated complex cases to specialist teams", "guided users through product workflows", "updated help-center articles", "followed up on unresolved cases", "identified recurring customer problems", "maintained accurate CRM notes", "explained technical steps in plain language"],
 "tools": ["CRM and ticketing platforms", "help desk software", "knowledge base tools", "live chat and email support", "case tracking dashboards", "customer feedback systems"],
 "outcomes": ["made support handoffs clearer", "improved consistency of case notes", "helped users complete workflows", "identified recurring support themes", "kept customers informed about next steps", "made troubleshooting easier to repeat"]},
"human_resources": {
 "titles": ["HR Coordinator", "Human Resources Assistant", "Recruiting Coordinator", "Talent Acquisition Associate", "People Operations Specialist", "HR Generalist"],
 "skills": ["recruitment coordination", "candidate screening", "interview scheduling", "onboarding", "employee records", "HRIS", "policy documentation", "employee engagement", "benefits administration", "training coordination", "confidential record handling", "workforce planning", "job descriptions", "reference checks", "people operations", "offboarding"],
 "tasks": ["coordinated interview schedules", "maintained employee records", "supported new-hire onboarding", "screened applications against job criteria", "prepared HR documentation", "tracked recruitment pipeline stages", "answered routine policy questions", "coordinated training sessions", "updated HRIS records", "supported offboarding checklists"],
 "tools": ["HRIS platforms", "applicant tracking systems", "recruitment spreadsheets", "onboarding checklists", "employee documentation systems", "interview scheduling tools"],
 "outcomes": ["improved completeness of employee records", "made interview coordination smoother", "kept candidates informed", "standardized onboarding steps", "made recruitment stages easier to track", "handled confidential information carefully"]},
"general": {
 "titles": ["Administrative Assistant", "Office Coordinator", "Operations Assistant", "Entry-Level Professional", "Generalist", "Administrative Support Specialist"],
 "skills": ["Microsoft Office", "organization", "written communication", "scheduling", "documentation", "data entry", "time management", "team collaboration", "record keeping", "problem solving", "customer interaction", "meeting coordination", "attention to detail", "file management", "research", "task prioritization"],
 "tasks": ["organized records and shared documents", "coordinated schedules and meetings", "prepared routine correspondence", "updated tracking spreadsheets", "supported day-to-day office operations", "followed documented procedures", "handled incoming requests", "maintained accurate files", "compiled information for reports", "coordinated routine administrative tasks"],
 "tools": ["Microsoft Office and spreadsheets", "calendar and email tools", "document management systems", "shared team workspaces", "data entry and record systems", "office scheduling tools"],
 "outcomes": ["kept records organized", "made routine handoffs more reliable", "improved access to shared information", "supported timely completion of tasks", "reduced avoidable administrative errors", "made schedules easier to coordinate"]}
}

OPENERS = [
 "Resume profile for {title}: {skills}. Experienced in {tasks} using {tools}.",
 "{title} with practical knowledge of {skills}. Responsibilities include {tasks}; tools include {tools}.",
 "Professional experience as a {title}. {tasks_cap} with {tools}; skills include {skills}.",
 "Career summary: {title} focused on {tasks}, applying {skills} and {tools}.",
 "Candidate targeting {title} roles with experience in {skills}. Has {tasks} and works with {tools}.",
 "Relevant background: {title}; {skills}; {tasks}; familiar with {tools}.",
 "{title} skilled in {skills}, with hands-on work to {tasks}. Common tools: {tools}.",
 "Work history includes {title} duties such as {tasks}. Technical and professional strengths: {skills}; {tools}.",
 "For a {title} position: {skills}. Delivered work to {tasks} using {tools}.",
 "Profile: {title} with experience across {skills}; typical work has involved {tasks} and {tools}."
]


def make_examples(label, cfg, count=260):
    result = set()
    attempts = 0
    while len(result) < count and attempts < count * 40:
        attempts += 1
        title = RNG.choice(cfg['titles'])
        skills = ", ".join(RNG.sample(cfg['skills'], k=RNG.choice([3, 4, 5, 6])))
        tasks = RNG.choice(cfg['tasks'])
        tools = RNG.choice(cfg['tools'])
        outcome = RNG.choice(cfg['outcomes'])
        template = RNG.choice(OPENERS)
        text = template.format(title=title, skills=skills, tasks=tasks, tasks_cap=tasks[0].upper()+tasks[1:], tools=tools)
        if RNG.random() < 0.7:
            text += " The work helped " + outcome + "."
        if RNG.random() < 0.45:
            text += " Additional experience includes " + RNG.choice(cfg['tasks']) + "."
        if RNG.random() < 0.35:
            text += " Relevant strengths: " + ", ".join(RNG.sample(cfg['skills'], k=2)) + "."
        result.add((" ".join(text.split()), label))
    return result


def main():
    existing = []
    if DATA.exists():
        with DATA.open(newline="", encoding="utf-8-sig") as f:
            existing = [(r['text'].strip(), r['label'].strip()) for r in csv.DictReader(f) if r.get('text','').strip() and r.get('label','').strip()]
    # Keep the original hand-written seed examples, then add balanced synthetic examples.
    all_rows = set(existing)
    per_role = 260
    for label, cfg in ROLES.items():
        all_rows.update(make_examples(label, cfg, per_role))
    rows = sorted(all_rows, key=lambda row: (row[1], row[0]))
    DATA.parent.mkdir(parents=True, exist_ok=True)
    with DATA.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "label"])
        writer.writeheader()
        writer.writerows({"text": text, "label": label} for text, label in rows)
    counts = {}
    for _, label in rows:
        counts[label] = counts.get(label, 0) + 1
    print(f"Wrote {len(rows)} unique labeled examples to {DATA}")
    print("Per-role counts:")
    for label in sorted(counts):
        print(f"  {label}: {counts[label]}")
    print("Note: generated examples are synthetic; validate with a separate set of real, consented resumes before relying on accuracy claims.")

if __name__ == "__main__":
    main()
