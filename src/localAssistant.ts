export type LocalAssistantContext = {
  resumeText?: string
  jobText?: string
  mlReport?: any
  history?: { role: 'user' | 'model'; text: string }[]
}

const SKILLS = [
  'JavaScript','TypeScript','React','HTML','CSS','Tailwind','Node.js','Express','Python','SQL','Firebase','MongoDB','Git','GitHub','REST API','Java','C++','C#','PHP','Django','Flask','FastAPI','scikit-learn','machine learning','pandas','NumPy','Power BI','Tableau','Excel','Figma','Photoshop','Illustrator','SEO','marketing','sales','project management','communication','leadership','teamwork','customer service','accounting','bookkeeping','AWS','Docker','Linux','accessibility','testing','Agile','Scrum'
]

const sectionRules: [string, RegExp][] = [
  ['Professional summary', /\b(summary|professional profile|profile|objective|about me)\b/i],
  ['Work experience', /\b(experience|employment|work history|professional experience)\b/i],
  ['Projects', /\b(projects|selected projects|personal projects|portfolio)\b/i],
  ['Skills', /\b(skills|technical skills|core competencies|technologies)\b/i],
  ['Education', /\b(education|academic|degree|university|college|school)\b/i],
  ['Certifications', /\b(certifications|certificates|licenses)\b/i],
]

const clean = (s: string) => s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
const hasAny = (s: string, words: string[]) => words.some(w => s.includes(w))
const extractBullets = (text: string) => text.split('\n').map(s => s.trim()).filter(s => /^([-*•▪◦]|\d+[.)])\s+/.test(s)).map(s => s.replace(/^([-*•▪◦]|\d+[.)])\s+/, '')).slice(0, 8)
const unique = <T,>(items: T[]) => [...new Set(items)]

function skillList(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ')
  return SKILLS.filter(skill => {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalized)
  })
}

function getSections(text: string) {
  return sectionRules.filter(([, re]) => re.test(text)).map(([name]) => name)
}

function summaryDraft(resume: string, skills: string[]) {
  const roleLine = resume.split('\n').map(x => x.trim()).find(x => /developer|designer|analyst|manager|engineer|specialist|student|accountant|marketing|support/i.test(x) && x.length < 90)
  const role = roleLine || 'motivated professional'
  const chosen = skills.slice(0, 5)
  return `Motivated ${role.toLowerCase()} with practical exposure to ${chosen.length ? chosen.join(', ') : 'relevant tools and project work'}. Focused on building reliable work, learning quickly, and solving problems through clear communication and structured execution. Add your actual years of experience, strongest project, and one verified achievement before using this draft.`
}

function bulletRewrite(resume: string, userMessage: string) {
  let supplied = ''
  const explicitMatch = userMessage.match(/^(?:please\s+)?(?:rewrite|improve|polish)\s+(?:this|the following|this bullet)\s*[:\-]\s*([\s\S]+)$/i)
  if (explicitMatch?.[1]) supplied = explicitMatch[1].trim()
  else if (/^[-*•▪◦]\s+/.test(userMessage.trim())) supplied = userMessage.trim().replace(/^[-*•▪◦]\s+/, '')
  else if (/^["“][\s\S]+["”]$/.test(userMessage.trim())) supplied = userMessage.trim().slice(1, -1)
  const bullets = supplied.length > 12 ? [supplied] : extractBullets(resume)
  if (!bullets.length) return 'Paste one bullet in this format: **Rewrite this: [your current bullet]**. I can polish wording while preserving the facts. A strong bullet usually states the action, task, tools or method, and a verified outcome.'
  const polish = (raw: string) => {
    let line = raw.replace(/[.!?]+$/, '').trim()
    line = line.replace(/^(?:responsible for|duties included|tasked with)\s+/i, 'Managed ')
      .replace(/^(?:worked on|work on)\s+/i, 'Contributed to ')
      .replace(/^(?:helped with|assisted with)\s+/i, 'Supported ')
      .replace(/^(?:did|made)\s+/i, 'Completed ')
      .replace(/^i\s+/i, '')
    if (line) line = line.charAt(0).toUpperCase() + line.slice(1)
    return line
  }
  return `**Polished bullet drafts — verify before using**\n\n${bullets.slice(0, 5).map((b, i) => `${i + 1}. ${polish(b)}.`).join('\n\n')}\n\nI preserved the supplied facts and only adjusted common wording. To strengthen each bullet further, add the tool or method and a real outcome where you have evidence. Never invent numbers, responsibilities, or results.`
}

function interviewAnswer(resume: string, job: string, skills: string[]) {
  const role = job.split('\n').map(x => x.trim()).find(x => /developer|designer|analyst|manager|engineer|specialist|accountant|marketing|support/i.test(x) && x.length < 100) || 'the target role'
  const projects = resume.split('\n').map(x => x.trim()).filter(x => /project|built|created|developed|designed|implemented/i.test(x)).slice(0, 2)
  return `Let's prepare for **${role}**. Use these questions and answer them with real examples:\n\n1. **Tell me about yourself.** Give a 30–60 second summary of your current focus, relevant skills (${skills.slice(0, 4).join(', ') || 'your strongest skills'}), and one project.\n2. **Walk me through a project.** Explain the problem, your personal contribution, tools, challenge, and verified outcome.${projects.length ? ` Your resume mentions: ${projects.join('; ')}.` : ''}\n3. **What are you improving?** Choose one honest skills gap and explain your learning plan.\n4. **Why this role?** Connect two requirements from the job description to evidence you can demonstrate.\n\nTry answering question 1 here. I can help structure your answer, but keep it truthful and in your own voice.`
}

export function answerLocally(message: string, context: LocalAssistantContext = {}): string {
  const q = clean(message).toLowerCase()
  const resume = clean(context.resumeText || '')
  const job = clean(context.jobText || '')
  const report = context.mlReport || null
  const skills = unique([...(report?.skills ? Object.values(report.skills).flat() as string[] : []), ...skillList(resume)]).slice(0, 45)
  const jobSkills = skillList(job)
  const missing = jobSkills.filter(s => !skills.some(rs => rs.toLowerCase() === s.toLowerCase()))
  const sections = getSections(resume)
  const isResumeQuestion = hasAny(q, ['my resume','my cv','my skills','my experience','my profile','my summary','my score','my report','my job match','my gaps','my education'])
  if (!resume && isResumeQuestion) return 'I don’t have your resume text in the assistant context yet. Upload a text-based PDF/DOCX or paste your resume, then enable **Use resume context**. You can also ask me general resume questions without uploading anything.'

  if (/^(hello|hi|hey|salam|assalamualaikum|good morning|good evening)\b/.test(q) && q.length < 90) {
    return 'Hello! I’m ResumeIQ’s offline career helper. I run locally without a cloud AI, API key, or model download. I can review resume sections, identify skills, suggest honest rewrites, compare a job description, draft a summary, and run interview practice. What would you like to work on?'
  }
  if (hasAny(q, ['what can you do','help me','help menu','commands','capabilities'])) {
    return 'Here’s what I can do offline:\n\n• **Resume review:** missing sections, detected skills, and next steps.\n• **Summary draft:** create a starter summary from the resume text.\n• **Bullet improvement:** turn existing bullets into clearer, evidence-based drafts.\n• **Job match:** compare skills found in your resume and job description.\n• **Interview prep:** generate role-focused practice questions.\n• **Skill explanation:** explain common technical and career terms.\n\nI use local rules and your provided text, not a generative cloud model, so answers are instant but less flexible than a full LLM.'
  }
  if (hasAny(q, ['privacy','where is my data','sent online','internet','api key','cloud'])) {
    return 'This assistant’s replies are generated locally in your browser. The chat does not call an external AI service and does not need an API key. The resume analyzer may still send text to your own local Flask service at 127.0.0.1 for the existing Scikit-learn prediction. No cloud AI request is made by this assistant.'
  }
  if (hasAny(q, ['interview','interview questions','prepare for interview','mock interview','tell me about yourself'])) {
    return interviewAnswer(resume, job, skills)
  }
  if (hasAny(q, ['rewrite','rewrite bullet','improve bullet','experience bullet','action bullet','make this stronger','make it professional'])) {
    return (resume || message.length > 25) ? bulletRewrite(resume, message) : 'Paste your current bullet or add a resume first. I’ll help make the wording clearer without adding invented results. A strong format is **action + task + method/tools + verified outcome**.'
  }
  if (hasAny(q, ['summary','professional profile','objective','about me','profile draft','write my summary'])) {
    if (!resume) return 'A useful summary is 2–4 lines: target role, strongest relevant skills, project or experience evidence, and the type of work you can do. Upload or paste your resume and I can make a draft based on its text.'
    return `**Summary draft — review before using**\n\n${summaryDraft(resume, skills)}\n\nThis is a template generated from detected terms, not a factual verification. Replace generic wording with your real experience and remove anything that does not accurately describe you.`
  }
  if (hasAny(q, ['job description','job match','match my resume','match score','skill gap','missing skills','skills missing','compare job','compare my resume','with the job','tailor my resume'])) {
    if (!resume) return 'Upload or paste your resume first. To compare against a role, also paste the job description into the job-description field, then ask “compare my resume with the job”.'
    if (!job) return `I can see ${skills.length} potential skills in your resume${skills.length ? `: ${skills.slice(0, 12).join(', ')}` : ''}. For a meaningful comparison, paste the job description into the job-description field and ask again. I won’t assume a skill is missing from your real abilities just because it is absent from the text.`
    const matched = jobSkills.filter(s => skills.some(rs => rs.toLowerCase() === s.toLowerCase()))
    return `**Local job-description comparison**\n\n- Skills found in both texts: ${matched.length ? matched.join(', ') : 'No exact vocabulary matches found'}\n- Job skills not detected in resume text: ${missing.length ? missing.join(', ') : 'None from the built-in vocabulary'}\n- Resume skills detected: ${skills.length}\n- Job-description skills detected: ${jobSkills.length}\n\nThese are exact-vocabulary checks, not proof of ability or inability. Review synonyms and add only skills you genuinely have. For each relevant skill, include a project or experience example as evidence.`
  }
  if (hasAny(q, ['skills','what skills','list my skills','detected skills','technical skills'])) {
    if (!resume) return `I can explain or categorize skills in general. For example, frontend skills include HTML, CSS, JavaScript and React; backend skills can include Python, Node.js, SQL and APIs. Paste your resume if you want me to list skills detected in your own text.`
    return `**Skills detected in your resume text**\n\n${skills.length ? skills.join(', ') : 'No terms from my built-in skills vocabulary were detected.'}\n\nI found ${skills.length} vocabulary matches. This may miss synonyms or skills described indirectly, so check the resume manually too.`
  }
  if (hasAny(q, ['score','quality','weakness','weak points','review my resume','analyze my resume','resume feedback','improve my resume','what should i improve','missing section'])) {
    if (!resume) return 'Upload or paste your resume, then ask for a review. I’ll check common sections, skill terms, bullet points and measurable evidence using local rules.'
    const words = resume.split(/\s+/).filter(Boolean).length
    const bullets = extractBullets(resume).length
    const missingSections = sectionRules.filter(([, re]) => !re.test(resume)).map(([name]) => name)
    const suggestions = [
      ...(missingSections.length ? [`Sections not detected: ${missingSections.join(', ')}.`] : ['Common resume sections were detected; check that each has useful, current details.']),
      ...(bullets < 3 ? ['Add 2–5 concise bullets that explain your actions and contributions.'] : [`${bullets} bullet-style lines were detected; make sure each focuses on a clear contribution.`]),
      ...(!/\b\d+(?:\.\d+)?\s*(%|users|customers|projects|months|years|hours|sales|revenue)\b/i.test(resume) ? ['If you have real measurable outcomes, include them; never invent metrics.'] : []),
      ...(words < 120 ? ['The text is short; confirm the entire resume was extracted and include relevant projects or coursework.'] : []),
      ['Tailor the top third of the resume to the role and prioritize the most relevant evidence.'],
    ]
    return `**Local resume review**\n\n- Word count: ${words}\n- Bullet lines detected: ${bullets}\n- Skills detected: ${skills.length}\n- Sections detected: ${sections.join(', ') || 'No standard section headings detected'}\n\n**Next steps**\n${unique(suggestions).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nThis is a checklist, not a validated hiring score.`
  }
  if (hasAny(q, ['cover letter','application letter'])) {
    const role = job.split('\n').map(x => x.trim()).find(x => x.length > 3 && x.length < 80) || 'the advertised role'
    const relevant = skills.slice(0, 4).join(', ') || '[relevant skills]'
    return `**Cover-letter starter — personalize the facts**\n\nDear Hiring Team,\n\nI am applying for ${role}. My background includes ${relevant}, and I am interested in contributing these skills while continuing to grow professionally. A relevant project or experience I can discuss is [add a real example and your personal contribution].\n\nI would welcome the opportunity to explain how my experience aligns with the role’s requirements. Thank you for your time and consideration.\n\nSincerely,\n[Your name]\n\nReplace all bracketed text and verify that every statement is accurate before sending.`
  }
  if (hasAny(q, ['explain','what is','meaning of','define'])) {
    const terms: [string[], string][] = [
      [['ats'], '**ATS** means Applicant Tracking System. It helps employers organize applications. Use clear headings, readable formatting and role-relevant wording; no format can guarantee passing every ATS.'],
      [['keyword','keywords'], '**Keywords** are role-relevant terms such as tools, skills and job responsibilities. Include them naturally only when they match your real experience.'],
      [['quantified','metrics','numbers'], '**Quantified achievements** use verified numbers to show scope or outcomes, such as users supported, time saved, or project size. Never invent metrics.'],
      [['tf-idf','tfidf'], '**TF-IDF** is a text-processing method that gives more weight to terms that help distinguish a document. ResumeIQ uses it in its local role-classification model; it does not understand meaning like a large language model.'],
      [['logistic regression'], '**Logistic Regression** is a lightweight machine-learning classifier. ResumeIQ uses it to estimate which broad role category best matches the resume text, based on its training examples.'],
    ]
    const found = terms.find(([keys]) => keys.some(k => q.includes(k)))
    if (found) return found[1]
  }
  if (hasAny(q, ['thank','thanks','got it','okay','ok'])) return 'You’re welcome. A good next step is to work on one section at a time. Ask for a summary draft, bullet rewrite, skill review, job comparison, or interview practice whenever you’re ready.'

  if (hasAny(q, ['make it shorter','shorten that','shorter please','summarize that answer'])) {
    const previous = [...(context.history || [])].reverse().find(item => item.role === 'model' && item.text.trim())?.text || ''
    if (previous) return previous.split(/\n\s*\n/).slice(0, 2).join('\n\n').slice(0, 700) + (previous.length > 700 ? '…' : '')
    return 'Tell me which part you want shortened, or ask your question again with “in 3 bullet points”.'
  }

  if (resume && isResumeQuestion) return `Based on the current resume text, I detected ${skills.length} skills and these sections: ${sections.join(', ') || 'no standard headings detected'}. Try asking “review my resume”, “list my skills”, “draft my summary”, or “compare my resume with the job”.`
  return 'I can help with resume structure, skills, job-description comparisons, bullet rewrites, cover-letter starters and interview practice—all locally, without an API key. Try a specific question such as “review my resume”, “draft my summary”, “explain ATS”, or “prepare interview questions”. Because this assistant uses a lightweight local intent engine rather than a generative LLM, it may not understand every open-ended question.'
}
