export const SKILLS = [
  'python','java','javascript','typescript','react','angular','vue','node.js','express','html','css',
  'sql','mysql','postgresql','mongodb','firebase','aws','azure','docker','kubernetes','git','linux',
  'machine learning','deep learning','scikit-learn','sklearn','pandas','numpy','tensorflow','pytorch',
  'nlp','computer vision','data analysis','data visualization','power bi','tableau','excel','statistics',
  'rest api','fastapi','flask','django','streamlit','communication','leadership','teamwork','problem solving',
  'project management','agile','scrum','testing','ci/cd','figma','ui/ux','seo','marketing','sales',
  'customer service','accounting','financial analysis','bookkeeping','risk management','research',
  'prompt engineering','llm','transformers','hugging face','natural language processing','cloud computing',
  'c++','c#','php','laravel','wordpress','next.js','vite','tailwind','zustand','redux','communication skills',
  'data structures','algorithms','restful api','unit testing','responsive design','accessibility'
]

const STOP = new Set(('a an the and or but if then than of to in on for with by from at as is are was were be been being it its this that these those you your our we they their i me my he she his her them have has had do does did will would can could should may might not no yes about into over under across using use used work worked working experience experienced skill skills ability abilities responsible responsibility responsibilities role roles job candidate resume cv summary profile education degree bachelor master university college project projects').split(/\s+/))

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z0-9+#./-]{1,}/g) ?? []
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase().replace(/\s+/g, ' ')
  return SKILLS.filter(skill => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(lower)
  })
}

function vectorize(documents: string[]) {
  const terms = documents.map(tokenize)
  const df = new Map<string, number>()
  terms.forEach(tokens => {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1)
  })
  const vocab = [...df.keys()]
  const idf = new Map(vocab.map(term => [term, Math.log((1 + documents.length) / (1 + (df.get(term) ?? 0))) + 1]))
  return terms.map(tokens => {
    const counts = new Map<string, number>()
    tokens.forEach(term => counts.set(term, (counts.get(term) ?? 0) + 1))
    const vector = vocab.map(term => (counts.get(term) ?? 0) * (idf.get(term) ?? 1))
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1
    return vector.map(v => v / norm)
  })
}

export type Analysis = {
  score: number
  similarity: number
  coverage: number
  resumeSkills: string[]
  jobSkills: string[]
  matched: string[]
  missing: string[]
  keywords: string[]
  resumeWords: number
  jobWords: number
}

export function analyzeResume(resume: string, job: string): Analysis {
  const [resumeVector, jobVector] = vectorize([resume, job])
  const similarity = resumeVector.reduce((sum, value, i) => sum + value * (jobVector[i] ?? 0), 0)
  const resumeSkills = extractSkills(resume)
  const jobSkills = extractSkills(job)
  const matched = jobSkills.filter(skill => resumeSkills.includes(skill))
  const missing = jobSkills.filter(skill => !resumeSkills.includes(skill))
  const coverage = matched.length / Math.max(1, jobSkills.length)
  const score = Math.round(100 * (0.55 * similarity + 0.45 * coverage))

  const resumeWords = new Set(tokenize(resume))
  const freq = new Map<string, number>()
  tokenize(job).filter(word => !STOP.has(word) && word.length > 2).forEach(word => {
    freq.set(word, (freq.get(word) ?? 0) + 1)
  })
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .filter(word => !resumeWords.has(word) && !missing.some(skill => skill.toLowerCase() === word))
    .slice(0, 12)

  return {
    score: Math.max(0, Math.min(100, score)),
    similarity: Math.round(similarity * 100),
    coverage: Math.round(coverage * 100),
    resumeSkills, jobSkills, matched, missing, keywords,
    resumeWords: tokenize(resume).length,
    jobWords: tokenize(job).length,
  }
}

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt')) return file.text()
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // Rebuild lines from text positions so bullets/headings stay at the start of a line.
      const lines: string[] = []
      let current = ''
      let lastY: number | null = null
      for (const item of content.items) {
        if (!('str' in item)) continue
        const y = item.transform?.[5] ?? 0
        if (lastY !== null && Math.abs(y - lastY) > 3 && current.trim()) { lines.push(current.trim()); current = '' }
        if (item.str) current += (current && !current.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str
        lastY = y
        if (item.hasEOL) { if (current.trim()) lines.push(current.trim()); current = ''; lastY = null }
      }
      if (current.trim()) lines.push(current.trim())
      pages.push(lines.join('\n'))
    }
    return pages.join('\n')
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }
  throw new Error('Unsupported file. Please use PDF, DOCX, or TXT.')
}
