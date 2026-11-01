// Removes markdown symbols so text reads normally in the editor, PDF and DOCX.
export function clean(t: string): string {
  return t.replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(?!\s)([^*\n]+?)\*/g, '$1')
    .replace(/`/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
