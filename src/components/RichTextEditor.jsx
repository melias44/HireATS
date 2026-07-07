import { useRef, useEffect, useCallback } from 'react'

// Toolbar button
function TBtn({ onClick, title, active, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{
        height: 28, minWidth: 28, padding: '0 6px',
        border: '1px solid transparent',
        borderRadius: 5,
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, background: 'var(--border)', margin: '3px 4px', alignSelf: 'stretch' }} />
}

// Convert plain text (e.g. from AI) to basic HTML
export function plainToHtml(text) {
  if (!text) return ''
  // If it already contains HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(text)) return text
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      // Bullet lines
      if (/^[-•*]\s+/.test(trimmed)) return `<li>${trimmed.replace(/^[-•*]\s+/, '')}</li>`
      return `<p>${trimmed}</p>`
    })
    .join('\n')
    .replace(/(<li>.*<\/li>\n?)+/gs, match => `<ul>${match}</ul>`)
}

export default function RichTextEditor({ value, onChange, placeholder = 'Describe the role…' }) {
  const editorRef = useRef(null)
  const lastHtml = useRef('')

  // Set content when value changes from outside (e.g. AI fill-in)
  // Only update DOM if content actually differs, to avoid cursor jump
  useEffect(() => {
    if (!editorRef.current) return
    const html = plainToHtml(value || '')
    if (html !== lastHtml.current) {
      editorRef.current.innerHTML = html
      lastHtml.current = html
    }
  }, [value])

  // Sync DOM → parent state
  const sync = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    lastHtml.current = html
    onChange(html)
  }, [onChange])

  function exec(cmd, val = null) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    sync()
  }

  function queryState(cmd) {
    try { return document.queryCommandState(cmd) } catch { return false }
  }

  function queryValue(cmd) {
    try { return document.queryCommandValue(cmd) } catch { return '' }
  }

  const isBold      = queryState('bold')
  const isItalic    = queryState('italic')
  const isUL        = queryState('insertUnorderedList')
  const isOL        = queryState('insertOrderedList')
  const blockVal    = queryValue('formatBlock').toLowerCase()
  const isH2        = blockVal === 'h2'
  const isH3        = blockVal === 'h3'

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderRadius: 'var(--radius)',
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
        padding: '6px 8px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <TBtn onClick={() => exec('bold')}   title="Bold (Ctrl+B)"   active={isBold}>  <b>B</b></TBtn>
        <TBtn onClick={() => exec('italic')} title="Italic (Ctrl+I)" active={isItalic}><i>I</i></TBtn>
        <Divider />
        <TBtn onClick={() => exec('formatBlock', isH2 ? 'p' : 'h2')} title="Heading 1" active={isH2}
          style={{ fontSize: 12 }}>H1</TBtn>
        <TBtn onClick={() => exec('formatBlock', isH3 ? 'p' : 'h3')} title="Heading 2" active={isH3}
          style={{ fontSize: 12 }}>H2</TBtn>
        <TBtn onClick={() => exec('formatBlock', 'p')} title="Normal text" active={!isH2 && !isH3 && !isUL && !isOL}>
          ¶
        </TBtn>
        <Divider />
        <TBtn onClick={() => exec('insertUnorderedList')} title="Bullet list"   active={isUL}>• List</TBtn>
        <TBtn onClick={() => exec('insertOrderedList')}   title="Numbered list" active={isOL}>1. List</TBtn>
        <Divider />
        <TBtn onClick={() => exec('indent')}  title="Indent">→</TBtn>
        <TBtn onClick={() => exec('outdent')} title="Outdent">←</TBtn>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onKeyUp={sync}
        onMouseUp={sync}
        data-placeholder={placeholder}
        style={{
          minHeight: 160,
          padding: '12px 14px',
          outline: 'none',
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--text)',
          overflowY: 'auto',
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-3);
          pointer-events: none;
        }
        [contenteditable] ul { padding-left: 20px; margin: 6px 0; }
        [contenteditable] ol { padding-left: 20px; margin: 6px 0; }
        [contenteditable] li { margin: 3px 0; }
        [contenteditable] h2 { font-size: 16px; font-weight: 700; margin: 10px 0 4px; }
        [contenteditable] h3 { font-size: 14px; font-weight: 700; margin: 8px 0 4px; }
        [contenteditable] p  { margin: 4px 0; }
      `}</style>
    </div>
  )
}
