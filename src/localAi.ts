export type LocalAIProgress = { status?: string; progress?: number; file?: string }

type TextGenerator = (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => Promise<Array<{ generated_text?: string | Array<{ role?: string; content?: string }> }>>

let generatorPromise: Promise<TextGenerator> | null = null

async function getGenerator(onProgress?: (message: string) => void): Promise<TextGenerator> {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      onProgress?.('Downloading the small AI model (first run only)…')
      // Loaded dynamically so the app can still build without bundling the model/runtime.
      const moduleUrl = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2'
      const transformers = await import(/* @vite-ignore */ moduleUrl) as {
        env: { allowLocalModels: boolean; useBrowserCache: boolean }
        pipeline: (task: string, model: string, options: Record<string, unknown>) => Promise<unknown>
      }
      transformers.env.allowLocalModels = false
      transformers.env.useBrowserCache = true
      return await transformers.pipeline(
        'text-generation',
        'onnx-community/Qwen2.5-0.5B-Instruct',
        { device: 'wasm', dtype: 'q4', progress_callback: (p: LocalAIProgress) => {
          if (p.status === 'progress' && typeof p.progress === 'number') onProgress?.(`Downloading AI model… ${Math.round(p.progress)}%`)
          else if (p.status === 'done') onProgress?.('AI model ready. Preparing analysis…')
          else if (p.status === 'ready') onProgress?.('AI model ready. Analyzing your CV…')
        } },
      ) as Promise<TextGenerator>
    })().catch(error => {
      generatorPromise = null
      throw error
    })
  }
  return generatorPromise
}

export async function analyzeCvWithLocalAI(cvText: string, onProgress?: (message: string) => void): Promise<string> {
  const generator = await getGenerator(onProgress)
  onProgress?.('Reading experience, skills, education and projects…')
  const clippedText = cvText.slice(0, 9000)
  const prompt = `You are ResumeIQ, a careful CV reviewer. Analyze only the CV below. Do not invent facts or assume missing information. Give concise, useful feedback. Return these headings: PROFILE SUMMARY, KEY SKILLS, EXPERIENCE & PROJECTS, EDUCATION, STRENGTHS, GAPS OR UNCLEAR DETAILS, TOP 5 IMPROVEMENTS. For improvements, be specific and honest. If a detail is absent, say it is not stated. Do not make hiring predictions.\n\nCV TEXT:\n${clippedText}`
  const output = await generator([{ role: 'user', content: prompt }], {
    max_new_tokens: 300,
    do_sample: false,
    return_full_text: false,
  })
  const first = output?.[0]?.generated_text
  const answer = typeof first === 'string' ? first : Array.isArray(first) ? first.map(item => item.content ?? '').join('\n') : ''
  if (!answer.trim()) throw new Error('The local AI returned an empty response. Try a shorter CV or use the standard analysis.')
  return answer.trim()
}
