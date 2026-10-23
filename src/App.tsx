import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  ArrowDownToLine, ArrowRight, BarChart3, Check, CheckCircle2, Send, Bot,
  CircleHelp, FileSearch, FileText, Fingerprint, LoaderCircle, LockKeyhole,
  Menu, ScanSearch, ShieldCheck, Sparkles, Target, Upload, X, Zap,
} from 'lucide-react'
import { analyzeResume, extractFileText } from './analyzer'
import type { Analysis } from './analyzer'
import ChatMarkdown from './ChatMarkdown'

type ChatMessage = { role: 'user' | 'model'; text: string }

const sampleResume = `Mohammad Khan
Frontend Developer
Summary
Frontend developer experienced in building responsive web applications with React, TypeScript, JavaScript, HTML, CSS and Tailwind. Strong problem solving and communication skills.
Experience
Built reusable React components and REST API integrations. Used Git, Firebase and responsive design practices to deliver accessible interfaces.
Projects
Created a dashboard using React, Vite, TypeScript and data visualization. Used Python, pandas and scikit-learn for a small machine learning project.
Education
Matriculation and ongoing independent learning in web development and AI/ML.
Skills
React, TypeScript, JavaScript, HTML, CSS, Git, Firebase, Python, pandas, scikit-learn, REST API, teamwork.`

const sampleJob = `Frontend Developer
We are looking for a frontend developer with strong React, TypeScript, JavaScript, HTML, CSS, responsive design and accessibility knowledge. Experience with REST API integration, Git, unit testing, UI/UX collaboration and problem solving is preferred. Candidates should communicate clearly, work in an agile team, and understand performance optimization and reusable component architecture.`

function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'green' | 'amber' }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Target }) {
  return <div className="metric-card">
    <div className="metric-top"><span>{label}</span><Icon size={17} strokeWidth={1.8} /></div>
    <div className="metric-value">{value}</div>
    <div className="metric-note">{note}</div>
  </div>
}

export default function App() {
  const [resumeText, setResumeText] = useState('')
  const [jobText, setJobText] = useState('')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [mlReport, setMlReport] = useState<any>(null)
  const [mlBusy, setMlBusy] = useState(false)
  const [mlError, setMlError] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: 'model', text: 'Hi! Ask me anything about your CV: its strengths, gaps, structure, skills, or which job skills are not matched. Upload or paste your CV first.' }])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function loadFile(file?: File) {
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const text = await extractFileText(file)
      if (!text.trim()) throw new Error('No readable text found. If this is a scanned PDF, use a text-based PDF or paste the resume text.')
      setResumeText(text)
      setFileName(file.name)
      setMlReport(null)
      setMlError('')
      setMlBusy(true)
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'ML analysis failed. Is the Python backend running?')
        setMlReport(data)
      } catch (e) {
        setMlError(e instanceof Error ? e.message : 'Could not reach the local ML service. Start the Python backend and try again.')
      } finally { setMlBusy(false) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    void loadFile(e.dataTransfer.files?.[0])
  }


  async function analyze() {
    setError('')
    if (!resumeText.trim()) { setError('Upload a CV or paste its text first.'); return }
    setBusy(true)
    setMlBusy(true)
    setMlError('')
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: resumeText }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ML analysis failed. Check that the Python backend is running.')
      setMlReport(data)
      if (jobText.trim()) setResult(analyzeResume(resumeText, jobText))
      else setResult(null)
    } catch (e) {
      setMlError(e instanceof Error ? e.message : 'Could not reach the local ML service. Start the Python backend and try again.')
    } finally { setBusy(false); setMlBusy(false) }
  }

  async function sendChat(event?: FormEvent<HTMLFormElement>, suggestedMessage?: string) {
    event?.preventDefault()
    const message = (suggestedMessage ?? chatInput).trim()
    if (!message || chatBusy) return
    if (resumeText.trim().length < 40) { setChatError('Upload or paste your CV first, then ask your question.'); return }
    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: message }]
    setChatMessages(nextMessages.slice(-40))
    setChatInput('')
    setChatError('')
    setChatBusy(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: message,
          resume_text: resumeText,
          job_text: jobText,
          report: mlReport,
          matched: result?.matched,
          not_matched: result?.missing,
          history: chatMessages.slice(-8),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not get an answer. Is the Python backend running?')
      const reply: ChatMessage = { role: 'model', text: String(data.answer ?? '') }
      setChatMessages([...nextMessages, reply].slice(-40))
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not reach the backend. Start it and try again.')
    } finally {
      setChatBusy(false)
    }
  }

  function resetChat() {
    setChatMessages([{ role: 'model', text: 'New conversation started. Ask me anything about your CV.' }])
    setChatError('')
  }

  function downloadReport() {
    if (!result) return
    const rows = [
      ['Section', 'Item', 'Result'],
      ['Overview', 'Overall match', `${result.score}%`],
      ['Overview', 'Text similarity', `${result.similarity}%`],
      ['Overview', 'Skill coverage', `${result.coverage}%`],
      ...result.matched.map(skill => ['Matched skills', skill, 'Detected in both']),
      ...result.missing.map(skill => ['Not matched skills', skill, 'In job description, not found in CV']),
      ...result.keywords.map(word => ['Suggested keywords', word, 'Review for relevance']),
    ]
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'resume-analysis-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function useSample() {
    setResumeText(sampleResume)
    setJobText(sampleJob)
    setFileName('sample-resume.txt')
    setError('')
    setResult(null)
    setMlReport(null)
  }

  const suggestions = result ? [
    ...(result.missing.length ? [`Not matched skills: ${result.missing.slice(0, 7).join(', ')}. Include them only if you genuinely have the experience.`] : []),
    ...(result.score < 45 ? ['Tailor your summary and experience bullets to the target role using accurate language from the job description.'] : []),
    ...(result.resumeWords < 180 ? ['Your resume text is quite short. Confirm all pages, experience, projects and education were extracted.'] : []),
    ...(result.resumeWords > 1000 ? ['Consider trimming repeated details and prioritizing experience relevant to this role.'] : []),
    'Use outcome-focused bullets: action + what you did + a measurable result, where you have a real metric.',
    'Show skills in project or experience context, not only in a standalone skills list.',
    'Check spelling, contact details, dates and consistent formatting before applying.',
  ] : []

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="ResumeIQ home"><span className="brand-icon"><Sparkles size={19} fill="currentColor" /></span><span>resume<span className="brand-light">iq</span><sup>✳</sup></span></a>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}>
        <a href="#analyzer" onClick={() => setMobileMenu(false)}>Analyzer</a>
        <a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a>
        <a href="#assistant" onClick={() => setMobileMenu(false)}>Ask about your CV</a>
        <a href="#privacy" onClick={() => setMobileMenu(false)}>Privacy</a>
      </nav>
      <div className="topbar-right"><span className="local-badge"><span className="status-dot" /> LOCAL ANALYSIS</span><button className="mobile-toggle icon-button" onClick={() => setMobileMenu(v => !v)} aria-label="Toggle navigation">{mobileMenu ? <X size={20}/> : <Menu size={20}/>}</button></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>Your experience.<br /><span className="muted-heading">In sharper focus.</span></h1>
          <p className="hero-subtitle">A smarter way to see how your resume lines up with the role you want. Find the strengths, spot the gaps, move forward with clarity.</p>
          <div className="hero-actions">
            <a className="button button-dark" href="#analyzer">Analyze my resume <ArrowRight size={17}/></a>
            <button className="button button-quiet" onClick={useSample}>Try sample data</button>
          </div>
          <div className="trust-row"><span><ShieldCheck size={15}/> Private by design</span><span><Zap size={15}/> CPU-friendly</span><span><LockKeyhole size={15}/> Free Groq Q&A</span></div>
        </div>
        <div className="hero-art" aria-label="Resume match illustration">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="floating-chip chip-top"><span className="chip-icon"><Check size={14}/></span> Skills aligned</div>
          <div className="resume-paper">
            <div className="paper-top"><div className="avatar-mark">MK</div><div><div className="paper-name">Your Resume</div><div className="paper-role">Frontend Developer</div></div><span className="paper-dots">•••</span></div>
            <div className="paper-rule" /><div className="paper-section-label">EXPERIENCE</div>
            <div className="paper-line long" /><div className="paper-line medium" /><div className="paper-line short" />
            <div className="paper-section-label spaced">CORE SKILLS</div>
            <div className="paper-pills"><i>React</i><i>TypeScript</i><i>UI / UX</i></div>
            <div className="paper-line medium lower" /><div className="paper-line long" />
          </div>
          <div className="match-card"><div className="match-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" className="ring-bg"/><circle cx="40" cy="40" r="32" className="ring-value"/></svg><div className="ring-number">86<span>%</span></div></div><div className="match-text"><b>Role match</b><span>Looking promising</span><div className="mini-bars"><i/><i/><i/><i/><i/></div></div><span className="match-spark">✦</span></div>
          <div className="floating-chip chip-bottom"><span className="tiny-check"><Check size={12}/></span> Gaps, meet game plan.</div>
          <div className="art-star star-one">✳</div><div className="art-star star-two">✦</div>
        </div>
      </section>

      <section className="feature-strip" id="how-it-works">
        <div className="feature"><div className="feature-icon"><ScanSearch size={19}/></div><div><b>Role relevance</b><span>See the text overlap</span></div></div>
        <div className="feature"><div className="feature-icon"><Target size={19}/></div><div><b>Skill gap finder</b><span>Know what to review</span></div></div>
        <div className="feature"><div className="feature-icon"><BarChart3 size={19}/></div><div><b>Clear next steps</b><span>Turn insights into action</span></div></div>
        <div className="feature"><div className="feature-icon"><Fingerprint size={19}/></div><div><b>Private by design</b><span>CV analysis runs on your computer</span></div></div>
      </section>

      <section className="workspace" id="analyzer">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> THE WORKSPACE</div><h2>Let’s find your <span className="serif-accent">fit.</span></h2><p>Two ingredients. One clearer picture of your next move.</p></div><div className="step-indicator"><span className="step-active">01</span><i/><span>02</span><i/><span>03</span></div></div>

        <div className="input-grid">
          <div className="input-panel">
            <div className="panel-heading"><span className="step-number">01</span><div><h3>Your resume</h3><p>Bring your experience into focus.</p></div><FileText className="panel-heading-icon" size={20}/></div>
            <div className={`drop-zone ${dragging ? 'dragging' : ''} ${resumeText ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click() }}>
              <input ref={fileInput} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => void loadFile(e.target.files?.[0])}/>
              <div className="upload-icon">{busy ? <LoaderCircle className="spin" size={23}/> : resumeText ? <CheckCircle2 size={23}/> : <Upload size={23}/>}</div>
              <b>{resumeText ? (fileName || 'Resume text added') : 'Drop your resume here'}</b>
              <span>{resumeText ? `${resumeText.trim().split(/\s+/).length} words extracted` : 'or click to browse your files'}</span>
              <div className="file-types"><span>PDF</span><span>DOCX</span><span>TXT</span></div>
            </div>
            <div className="textarea-heading"><label htmlFor="resume-text">Resume text</label><span>{resumeText.trim() ? resumeText.trim().split(/\s+/).length : 0} words</span></div>
            <textarea id="resume-text" value={resumeText} onChange={e => { setResumeText(e.target.value); setFileName(''); setResult(null) }} placeholder="Your resume content will appear here. You can also paste it directly..." rows={7}/>
            <div className="panel-footer"><span><LockKeyhole size={13}/> Processed locally in your browser</span><button className="text-button" onClick={() => { setResumeText(''); setFileName(''); setResult(null); setMlReport(null); setMlError('') }}>Clear text</button></div>
          </div>

          <div className="input-panel">
            <div className="panel-heading"><span className="step-number">02</span><div><h3>The role you want</h3><p>Give the analyzer a target to compare.</p></div><Target className="panel-heading-icon" size={20}/></div>
            <div className="job-prompt"><div className="prompt-icon"><FileSearch size={18}/></div><div><b>Job description</b><span>Include responsibilities and requirements for better results.</span></div></div>
            <div className="textarea-heading"><label htmlFor="job-text">Role details</label><span>{jobText.trim() ? jobText.trim().split(/\s+/).length : 0} words</span></div>
            <textarea id="job-text" value={jobText} onChange={e => { setJobText(e.target.value); setResult(null) }} placeholder="Paste the job description here: role, responsibilities, required skills..." rows={10}/>
            <div className="panel-footer"><span><CircleHelp size={13}/> More detail gives a better comparison</span><button className="text-button" onClick={() => { setJobText(''); setResult(null) }}>Clear text</button></div>
          </div>
        </div>
        {error && <div className="error-message"><CircleHelp size={17}/>{error}</div>}
        <section className="result-card local-ai-card" aria-live="polite">
          <div className="result-card-heading"><div><h3><Sparkles size={17} style={{display:'inline', verticalAlign:'-3px', marginRight:7}}/> Scikit-learn CV analysis</h3><p>A trained TF-IDF + Logistic Regression model classifies the likely role. Rule-based checks provide transparent CV feedback.</p></div><span className="local-badge"><span className="status-dot"/> LOCAL CPU</span></div>
          <div className="ai-model-note"><b>Model:</b> scikit-learn TF-IDF + LogisticRegression. No LLM or GPU required for this local ML report. CV questions are answered by Groq (free tier) and only use your CV text.</div>
          {mlBusy && <div className="ai-status"><LoaderCircle className="spin" size={17}/><span>Analyzing resume with the trained ML model…</span></div>}
          {mlError && <div className="error-message"><CircleHelp size={17}/><span>{mlError}</span></div>}
          {mlReport && <div className="ai-report">
            <div className="ml-report-grid">
              <div className="ml-report-stat"><span>Predicted role</span><b>{mlReport.predicted_role}</b><small>{mlReport.confidence >= 40 ? `${mlReport.confidence}% model confidence` : `${mlReport.confidence}% confidence (low, treat as a hint)`}</small></div>
              <div className="ml-report-stat"><span>Resume quality checklist</span><b>{mlReport.quality_score}/100</b><small>{mlReport.score_label} · checklist score, not hiring probability</small></div>
              <div className="ml-report-stat"><span>Skills found</span><b>{mlReport.skill_count}</b><small>{mlReport.word_count} words · {mlReport.bullet_count} bullets</small></div>
            </div>
            {mlReport.warnings?.length > 0 && <div className="ai-model-note">{mlReport.warnings.map((w: string) => <div key={w}>⚠ {w}</div>)}</div>}
            <h4>Score breakdown</h4><div className="ml-alternatives">{mlReport.score_breakdown?.map((c: any) => <div key={c.key} className="ml-alternative" title={c.note}><span>{c.label}</span><b>{c.score}/{c.max}</b><div className="ml-track"><i style={{width: `${Math.round(100 * c.score / c.max)}%`}}/></div><small>{c.note}</small></div>)}</div>
            <h4>Likely role matches</h4><div className="ml-alternatives">{mlReport.alternatives.map((item: any) => <div key={item.role} className="ml-alternative"><span>{item.role}</span><b>{item.confidence}%</b><div className="ml-track"><i style={{width: `${item.confidence}%`}}/></div></div>)}</div>
            <h4>Detected sections</h4><div className="ml-pills">{Object.entries(mlReport.sections).map(([name, present]) => <Pill key={name} tone={present ? 'green' : 'amber'}>{present ? '✓' : '○'} {name}</Pill>)}</div>
            <h4>Skills detected</h4>{Object.keys(mlReport.skills).length ? Object.entries(mlReport.skills).map(([group, skills]: [string, any]) => <div className="ml-skill-group" key={group}><b>{group}</b><div className="ml-pills">{skills.map((skill: string) => <Pill key={skill}>{skill}</Pill>)}</div></div>) : <p>No listed skills were confidently detected. Check the extracted text or add a skills section.</p>}
            <h4>Improvement suggestions</h4><ul>{mlReport.suggestions.map((suggestion: string) => <li key={suggestion}>{suggestion}</li>)}</ul>
            <p className="ml-disclaimer">{mlReport.disclaimer}</p>
            <div className="panel-footer"><span><LockKeyhole size={13}/> ML analysis uses your local Python service</span><button className="text-button" onClick={() => { const blob = new Blob([JSON.stringify(mlReport, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'resumeiq-ml-report.json'; a.click(); URL.revokeObjectURL(url) }}>Download ML report</button></div>
          </div>}
          {!mlBusy && !mlReport && !mlError && <div className="ai-status"><Sparkles size={17}/><span>Upload a CV or paste resume text to start the trained ML analysis.</span></div>}
        </section>
        <div className="analyze-row"><div className="analyze-note"><Sparkles size={16}/><span><b>Ready when you are.</b> Your CV is processed by the local Python service.</span></div><button className="button button-dark analyze-button" onClick={analyze} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17}/> Analyzing...</> : <>Analyze resume <ArrowRight size={17}/></>}</button></div>
      </section>

      <section className="chat-section" id="assistant">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> ASK ABOUT YOUR CV</div><h2>Ask Resume<span className="serif-accent">IQ.</span></h2><p>Ask questions about your own CV: strengths, gaps, wording, and which job skills are not matched.</p></div><span className="local-badge"><span className="status-dot"/> GROQ · FREE TIER</span></div>
        <div className="chat-card">
          <div className="chat-topline"><div className="chat-avatar"><Bot size={20}/></div><div><b>ResumeIQ Assistant</b><span>Powered by Groq · Only answers questions about your CV</span></div><button type="button" className="text-button chat-reset" onClick={resetChat}>New chat</button></div>
          <div className="context-toggle"><span><b>Answers are based on your uploaded CV</b><small>When you ask a question, your CV text (and the job description, if added) is sent to Groq to generate the answer. CV analysis and scoring stay on this computer.</small></span></div>
          <div className="chat-messages" aria-live="polite">
            {chatMessages.map((item, index) => <div className={`chat-message ${item.role === 'user' ? 'from-user' : 'from-assistant'}`} key={`${index}-${item.role}`}><div className="chat-message-icon">{item.role === 'user' ? 'You' : <Sparkles size={15}/>}</div><div className="chat-message-text">{item.role === 'user' ? item.text : <ChatMarkdown text={item.text}/>}</div></div>)}
            {chatBusy && <div className="chat-message from-assistant"><div className="chat-message-icon"><Sparkles size={15}/></div><div className="chat-message-text chat-thinking"><LoaderCircle size={15} className="spin"/> Thinking…</div></div>}
          </div>
          {chatError && <div className="error-message chat-error"><CircleHelp size={17}/><span>{chatError}</span></div>}
          <div className="chat-suggestions"><button type="button" onClick={() => void sendChat(undefined, 'What are the strongest points of my CV?')}>My strengths</button><button type="button" onClick={() => void sendChat(undefined, 'What is missing or weak in my CV?')}>What is missing?</button><button type="button" onClick={() => void sendChat(undefined, 'Which skills from the job description are not matched in my CV?')}>Not matched skills</button><button type="button" onClick={() => void sendChat(undefined, 'Explain my CV quality score and how to raise it honestly.')}>Explain my score</button></div>
          <form className="chat-compose" onSubmit={e => void sendChat(e)}><textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask a question about your CV…" rows={2} maxLength={5000} aria-label="Message the ResumeIQ assistant"/><button className="button button-dark" type="submit" disabled={chatBusy || !chatInput.trim()}>{chatBusy ? <LoaderCircle size={17} className="spin"/> : <Send size={16}/>} Send</button></form>
          <p className="chat-disclaimer"><LockKeyhole size={13}/> Answers come from Groq’s free API and may contain mistakes, so check them against your CV. The assistant only answers questions about your CV, and your API key never leaves the backend.</p>
        </div>
      </section>

      {result && <section className="results-section" id="results">
        <div className="section-heading result-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR ANALYSIS</div><h2>The role-fit <span className="serif-accent">snapshot.</span></h2><p>A useful comparison, not a prediction of hiring success.</p></div><button className="button button-outline" onClick={downloadReport}><ArrowDownToLine size={16}/> Export report</button></div>
        <div className="metrics-grid">
          <Metric label="Overall match" value={`${result.score}%`} note="Text + skill coverage" icon={Target}/>
          <Metric label="Text similarity" value={`${result.similarity}%`} note="TF-IDF cosine similarity" icon={ScanSearch}/>
          <Metric label="Skill coverage" value={`${result.coverage}%`} note="Detected job skills matched" icon={CheckCircle2}/>
          <Metric label="Resume length" value={result.resumeWords.toLocaleString()} note="Words extracted" icon={FileText}/>
        </div>
        <div className="result-grid">
          <div className="result-card"><div className="result-card-heading"><div><h3>Skills that match</h3><p>Already visible in your resume</p></div><span className="heading-count">{result.matched.length.toString().padStart(2, '0')}</span></div>
            <div className="pill-wrap">{result.matched.length ? result.matched.map(s => <Pill key={s} tone="green"><Check size={12}/>{s}</Pill>) : <p className="empty-note">No exact matches found in the built-in vocabulary. Review both texts manually too.</p>}</div>
            <div className="sub-divider"/>
            <div className="result-card-heading"><div><h3>Not matched skills</h3><p>In the job description, but not found in your CV</p></div><span className="heading-count amber-count">{result.missing.length.toString().padStart(2, '0')}</span></div>
            <div className="pill-wrap">{result.missing.length ? result.missing.map(s => <Pill key={s} tone="amber">{s}</Pill>) : <p className="empty-note">Every detected job skill was found in your CV.</p>}</div>
            <p className="fine-print">Only add a skill if you genuinely have it. If not, consider learning it or building a project first.</p>
          </div>
          <div className="result-card chart-card"><div className="result-card-heading"><div><h3>Skill coverage</h3><p>Detected skills from the job description</p></div><BarChart3 size={19}/></div>
            <div className="chart-total"><b>{result.matched.length}</b><span>of {result.jobSkills.length} detected skills matched</span></div>
            <div className="coverage-track"><div className="coverage-fill" style={{ width: `${result.coverage}%` }}/></div>
            <div className="chart-legend"><span><i className="legend-dot matched-dot"/>Matched <b>{result.matched.length}</b></span><span><i className="legend-dot missing-dot"/>Not matched <b>{result.missing.length}</b></span></div>
            <div className="chart-callout"><Sparkles size={17}/><p>{result.coverage >= 70 ? 'A strong set of detected skills. Focus on showing proof of those skills in your experience and projects.' : 'Start with the not matched skills and improving the evidence for the skills you already have.'}</p></div>
          </div>
        </div>
        <div className="result-card checklist-card"><div className="result-card-heading"><div><h3>Your improvement checklist</h3><p>Small, practical steps to make the application stronger.</p></div><span className="checklist-icon"><CheckCircle2 size={20}/></span></div>
          <div className="checklist">{suggestions.map((s, i) => <div className="checklist-item" key={s}><span>{String(i + 1).padStart(2, '0')}</span><p>{s}</p></div>)}</div>
          {!!result.keywords.length && <><div className="sub-divider"/><h4>Job-description terms to review</h4><p className="result-desc">These terms appear in the job text but were not obvious in your resume. Use only those that accurately describe your experience.</p><div className="pill-wrap">{result.keywords.map(w => <Pill key={w}>{w}</Pill>)}</div></>}
        </div>
        <div className="disclaimer"><ShieldCheck size={17}/><p><b>Use your judgment.</b> ResumeIQ uses local text similarity and a curated skill list. Scores can miss synonyms and context, and are not a probability of getting hired.</p></div>
      </section>}

      {!result && <section className="how-section"><div className="how-title"><span className="eyebrow">SIMPLE BY DESIGN</span><h2>Less guessing. <span className="serif-accent">More direction.</span></h2></div><div className="how-grid"><div><span>01</span><h3>Compare the language</h3><p>Lightweight NLP checks how closely the resume text aligns with the target role.</p></div><div><span>02</span><h3>Spot the skill gaps</h3><p>A curated vocabulary finds skills that are present in the job description and resume.</p></div><div><span>03</span><h3>Choose your next step</h3><p>Use the report as a checklist, then improve your resume with honest evidence.</p></div></div></section>}
    </main>

    <footer className="footer" id="privacy"><a className="brand footer-brand" href="#"><span className="brand-icon"><Sparkles size={17} fill="currentColor"/></span><span>resume<span className="brand-light">iq</span><sup>✳</sup></span></a><span>Thoughtful tools for your next chapter.</span><div className="footer-privacy"><LockKeyhole size={13}/> Local analysis · Groq CV Q&A</div></footer>
  </div>
}
