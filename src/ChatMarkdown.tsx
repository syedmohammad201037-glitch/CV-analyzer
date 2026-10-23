import { Fragment, type ReactNode } from 'react'

/**
 * Tiny, dependency-free Markdown renderer for chat answers.
 * Supports: paragraphs, #/##/### headings, -, *, • and 1. lists (with nesting by indent),
 * **bold**, *italic* and `code`. Everything is rendered as React elements (no raw HTML),
 * so model output can never inject markup.
 */
type ListNode = { ordered: boolean; items: { text: string; children: ListNode[] }[] }
type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; list: ListNode }

const LIST_RE = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/
const HEADING_RE = /^\s{0,3}#{1,6}\s+(.*)$/

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*\s][^*]*?\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const tok = match[0]
    const key = `${keyPrefix}-${i++}`
    if (tok.startsWith('**')) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={key}>{tok.slice(1, -1)}</code>)
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    last = match.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function parse(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (!line.trim()) { flushPara(); continue }
    const heading = HEADING_RE.exec(line)
    if (heading) { flushPara(); blocks.push({ type: 'h', text: heading[1].replace(/\s*#+\s*$/, '') }); continue }
    if (LIST_RE.test(line)) {
      flushPara()
      const root: ListNode = { ordered: /\d/.test(LIST_RE.exec(line)![2]), items: [] }
      const stack: { indent: number; list: ListNode }[] = [{ indent: LIST_RE.exec(line)![1].length, list: root }]
      let m: RegExpExecArray | null
      while (n < lines.length) {
        if (!lines[n].trim()) {
          // blank line: stay in the list only if another list item follows
          let k = n + 1
          while (k < lines.length && !lines[k].trim()) k++
          if (k < lines.length && LIST_RE.test(lines[k])) { n = k; continue }
          break
        }
        m = LIST_RE.exec(lines[n])
        if (!m) {
          // indented continuation line of the previous item
          const top = stack[stack.length - 1].list
          const prev = top.items[top.items.length - 1]
          if (prev && /^\s+\S/.test(lines[n]) && !HEADING_RE.test(lines[n])) { prev.text += ' ' + lines[n].trim(); n++; continue }
          break
        }
        const indent = m[1].length
        while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop()
        let cur = stack[stack.length - 1]
        // a switch between bullets and numbers at the top level starts a new list
        if (stack.length === 1 && indent <= cur.indent && cur.list.items.length && cur.list.ordered !== /\d/.test(m[2])) break
        if (indent > cur.indent) {
          const parent = cur.list.items[cur.list.items.length - 1]
          if (parent) {
            const child: ListNode = { ordered: /\d/.test(m[2]), items: [] }
            parent.children.push(child)
            cur = { indent, list: child }
            stack.push(cur)
          }
        }
        cur.list.items.push({ text: m[3].trim(), children: [] })
        n++
      }
      n-- // outer for-loop will advance
      blocks.push({ type: 'list', list: root })
      continue
    }
    para.push(line.trim())
  }
  flushPara()
  return blocks
}

function renderList(list: ListNode, key: string): ReactNode {
  const Tag = list.ordered ? 'ol' : 'ul'
  return (
    <Tag key={key}>
      {list.items.map((item, i) => (
        <li key={`${key}-${i}`}>
          {inline(item.text, `${key}-${i}`)}
          {item.children.map((c, j) => renderList(c, `${key}-${i}-${j}`))}
        </li>
      ))}
    </Tag>
  )
}

export default function ChatMarkdown({ text }: { text: string }) {
  const blocks = parse(text)
  return (
    <div className="md">
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.type === 'p' && <p>{inline(b.text, `p${i}`)}</p>}
          {b.type === 'h' && <p className="md-heading">{inline(b.text, `h${i}`)}</p>}
          {b.type === 'list' && renderList(b.list, `l${i}`)}
        </Fragment>
      ))}
    </div>
  )
}
