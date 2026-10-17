export function extractSlangQuery(input) {
  const cleaned = String(input || '')
    .trim()
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+/g, ' ')

  if (!cleaned) return ''

  const patterns = [
    /^what does (.+?) mean$/i,
    /^what is (.+)$/i,
    /^tell me (?:the )?meaning of (.+)$/i,
    /^explain (.+)$/i,
    /^define (.+)$/i,
    /^what(?:'s| is) the meaning of (.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }

  return cleaned
}
