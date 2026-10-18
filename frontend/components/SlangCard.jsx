import PronunciationButton from './PronunciationButton.jsx'
import { Heart, MessageCircle } from 'lucide-react'

function SlangCard({ slang, isFavorite = false, isFavoritePending = false, onToggleFavorite, variant = 'explore' }) {
  if (variant === 'home') {
    return <article className="slang-card">
      <div className="card-top">
        <span className="emoji">{slang.emoji}</span>
        <span className="popularity-chip">{slang.isTrending ? '🔥 Trending' : '✨ Fresh'}</span>
        <button type="button" className={isFavorite ? 'favorite active' : 'favorite'} disabled={isFavoritePending || !onToggleFavorite} aria-pressed={isFavorite} aria-busy={isFavoritePending} onClick={() => onToggleFavorite(slang._id)} aria-label={`${isFavorite ? 'Remove' : 'Add'} ${slang.word} ${isFavorite ? 'from' : 'to'} favorites`}><Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="slang-word-heading"><h3>{slang.word}</h3><PronunciationButton word={slang.word} /></div>
      <p>{slang.meaning}</p>
      <span className="badge">{slang.category}</span>
    </article>
  }

  return (
    <article className={`explore-slang-card ${slang.isTrending ? 'is-trending' : ''}`}>
      <div className="explore-card-top">
        <span className="explore-emoji">{slang.emoji}</span>
        <span className="popularity-chip">{slang.isTrending ? '🔥 Viral' : '✨ Fresh'}</span>
        <button type="button" className={isFavorite ? 'favorite active' : 'favorite'} disabled={isFavoritePending || !onToggleFavorite} aria-pressed={isFavorite} aria-busy={isFavoritePending} onClick={(event) => { event.stopPropagation(); onToggleFavorite(slang._id) }} aria-label={`${isFavorite ? 'Remove' : 'Save'} ${slang.word} ${isFavorite ? 'from' : 'to'} favorites`}><Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="word-row"><div className="slang-word-heading"><h3>{slang.word}</h3><PronunciationButton word={slang.word} /></div><span className="explore-category">{slang.category}</span></div>
      <p className="explore-meaning">{slang.meaning}</p>
      <div className="example"><MessageCircle size={14} /><p><span>IN A SENTENCE</span>{slang.example}</p></div>
    </article>
  )
}

export default SlangCard
