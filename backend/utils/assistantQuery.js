const simpleQuestionPatterns = [
  /^what does (.+?) mean$/i,
  /^what is (.+)$/i,
  /^tell me (?:the )?meaning of (.+)$/i,
  /^explain (.+)$/i,
  /^define (.+)$/i,
  /^what(?:'s| is) the meaning of (.+)$/i,
]

function clean(value) {
  return String(value || '').trim().replace(/[\u2018\u2019]/g, "'").replace(/[?!.,]+$/g, '').replace(/\s+/g, ' ')
}

export function classifyAssistantQuery(input) {
  const text = clean(input)
  for (const pattern of simpleQuestionPatterns) {
    const match = text.match(pattern)
    const term = clean(match?.[1])
    if (term && term.length <= 80 && term.split(' ').length <= 5) {
      return { text, dictionaryTerm: term, isSimple: true }
    }
  }

  const words = text.split(' ').filter(Boolean)
  const looksLikeTerm = words.length <= 3 && /^[\p{L}\p{N}'-]+(?:\s+[\p{L}\p{N}'-]+)*$/u.test(text)
  return { text, dictionaryTerm: looksLikeTerm ? text : null, isSimple: looksLikeTerm }
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Only standalone cooked expressions are aliases; contextual sentences still use AI.
export function dictionaryCandidates(term) {
  const candidates = [term]
  if (/^(?:i am|i'm|im) cooked$/i.test(term)) candidates.push('cooked')
  return candidates
}
