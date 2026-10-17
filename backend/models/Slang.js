import mongoose from 'mongoose'

export const SLANG_CATEGORIES = ['Social Media', 'Meme', 'Gaming', 'Lifestyle', 'Gen Z', 'Other']

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return tags
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))]
}

const slangSchema = new mongoose.Schema({
  word: {
    type: String,
    required: [true, 'Slang word is required'],
    trim: true,
    lowercase: true,
    unique: true,
    maxlength: [50, 'Slang word cannot exceed 50 characters'],
  },
  meaning: {
    type: String,
    required: [true, 'Meaning is required'],
    trim: true,
    maxlength: [500, 'Meaning cannot exceed 500 characters'],
  },
  example: {
    type: String,
    required: [true, 'Example sentence is required'],
    trim: true,
    maxlength: [500, 'Example sentence cannot exceed 500 characters'],
  },
  emoji: {
    type: String,
    trim: true,
    maxlength: [16, 'Emoji cannot exceed 16 characters'],
    default: '✨',
  },
  category: {
    type: String,
    required: true,
    enum: SLANG_CATEGORIES,
    index: true,
  },
  tags: {
    type: [{
      type: String,
      trim: true,
      maxlength: [30, 'Each tag cannot exceed 30 characters'],
    }],
    default: [],
    set: normalizeTags,
    validate: {
      validator: (tags) => tags.length <= 10,
      message: 'A slang entry can have at most 10 tags',
    },
  },
  isTrending: {
    type: Boolean,
    default: false,
    index: true,
  },
  popularity: {
    type: Number,
    default: 0,
    min: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
})

const Slang = mongoose.model('Slang', slangSchema)

export default Slang
