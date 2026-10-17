const text = (value) => typeof value === 'string' ? value.trim() : ''

function sentences(parts) {
  return [...new Set(parts.filter(Boolean))]
    .map((part, index, all) => index < all.length - 1 && !/[.!?]$/.test(part) ? `${part}.` : part)
    .join(' ')
}

export function getSpeakableText(result) {
  if (typeof result === 'string') return result.trim()
  if (!['assistant', 'dictionary', 'ai'].includes(result?.source)) return ''
  const data = result.data
  if (typeof data === 'string') return data.trim()
  if (!data || typeof data !== 'object') return ''
  if (result.source === 'assistant') return text(data.message)

  const word = text(data.word) || text(data.term)
  const meaning = text(data.meaning)
  if (result.source === 'dictionary' && (!word || !meaning)) return ''
  const detected = Array.isArray(data.detectedSlang) ? data.detectedSlang : []
  return sentences([
    word && meaning ? `${word} means ${meaning}` : meaning,
    ...detected.flatMap((item) => {
      const term = text(item?.term) || text(item?.word)
      const definition = text(item?.meaning)
      return [term && definition ? `${term} means ${definition}` : '',
        text(item?.example) ? `For example, ${text(item.example)}` : '']
    }),
    text(data.translation),
    text(data.explanation),
    text(data.example) ? `For example, ${text(data.example)}` : '',
  ])
}
