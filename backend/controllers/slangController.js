import mongoose from 'mongoose'
import Slang, { SLANG_CATEGORIES } from '../models/Slang.js'

const updateFields = ['word', 'meaning', 'example', 'emoji', 'category', 'tags', 'isTrending', 'popularity']
const sortOptions = {
  popular: { popularity: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  alphabetical: { word: 1 },
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw Object.assign(new Error(`${name} must be a positive integer`), { status: 400 })
  }
  return Number(value)
}

function normalizeCategory(value) {
  if (value === undefined) return undefined
  const normalized = String(value).trim().toLowerCase()
  return SLANG_CATEGORIES.find((category) => category.toLowerCase() === normalized)
}

function invalidInput(message) {
  return Object.assign(new Error(message), { status: 400 })
}

function requiredText(body, field, label, maximum) {
  if (typeof body[field] !== 'string') throw invalidInput(`${label} is required`)
  const value = body[field].trim()
  if (!value) throw invalidInput(`${label} is required`)
  if (value.length > maximum) throw invalidInput(`${label} cannot exceed ${maximum} characters`)
  return value
}

function createPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidInput('Request body must be a JSON object')
  }

  const categoryInput = requiredText(body, 'category', 'Category', 30)
  const category = normalizeCategory(categoryInput)
  if (!category) throw invalidInput('Invalid slang category')

  let emoji
  if (body.emoji !== undefined && body.emoji !== null && body.emoji !== '') {
    if (typeof body.emoji !== 'string') throw invalidInput('Emoji must be text')
    const normalizedEmoji = body.emoji.trim()
    if (normalizedEmoji.length > 16) throw invalidInput('Emoji cannot exceed 16 characters')
    emoji = normalizedEmoji || undefined
  }

  let tags = []
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw invalidInput('Tags must be an array')
    if (body.tags.length > 10) throw invalidInput('A slang entry can have at most 10 tags')
    tags = body.tags.map((tag) => {
      if (typeof tag !== 'string') throw invalidInput('Each tag must be text')
      const normalized = tag.trim()
      if (!normalized) throw invalidInput('Tags cannot be empty')
      if (normalized.length > 30) throw invalidInput('Each tag cannot exceed 30 characters')
      return normalized
    })
  }

  return {
    word: requiredText(body, 'word', 'Slang word', 50),
    meaning: requiredText(body, 'meaning', 'Meaning', 500),
    example: requiredText(body, 'example', 'Example sentence', 500),
    category,
    emoji,
    tags,
  }
}

function sendDatabaseError(response, error) {
  if (error?.code === 11000) {
    return response.status(409).json({ success: false, message: 'This slang already exists' })
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const message = Object.values(error.errors).map((item) => item.message).join(' ')
    return response.status(400).json({ success: false, message })
  }
  if (error?.status === 400) {
    return response.status(400).json({ success: false, message: error.message })
  }

  console.error(`Slang database operation failed (${error?.name || 'Error'})`)
  return response.status(500).json({ success: false, message: 'Internal server error' })
}

function hasValidId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function getAllSlang(request, response) {
  try {
    const filter = {}
    const search = String(request.query.search || '').trim()
    if (search) {
      const searchPattern = new RegExp(escapeRegex(search), 'i')
      // Dictionary search is word-only; contextual lookup belongs to the assistant.
      filter.word = searchPattern
    }

    if (request.query.category !== undefined) {
      const category = normalizeCategory(request.query.category)
      if (!category) throw Object.assign(new Error('Invalid slang category'), { status: 400 })
      filter.category = category
    }

    if (request.query.trending !== undefined) {
      if (!['true', 'false'].includes(String(request.query.trending).toLowerCase())) {
        throw Object.assign(new Error('trending must be true or false'), { status: 400 })
      }
      filter.isTrending = String(request.query.trending).toLowerCase() === 'true'
    }

    if (request.query.letter !== undefined) {
      const letter = String(request.query.letter).trim()
      if (!/^[a-z]$/i.test(letter)) {
        throw Object.assign(new Error('letter must be a single A-Z character'), { status: 400 })
      }
      // Keep the prefix constraint ANDed with any word substring search.
      filter.$and = [{ word: new RegExp(`^${escapeRegex(letter)}`, 'i') }]
    }

    const sortName = String(request.query.sort || 'popular').toLowerCase()
    if (!sortOptions[sortName]) throw Object.assign(new Error('Invalid sort option'), { status: 400 })

    const page = parsePositiveInteger(request.query.page, 1, 'page')
    const requestedLimit = parsePositiveInteger(request.query.limit, 12, 'limit')
    const limit = Math.min(requestedLimit, 50)
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      Slang.find(filter).sort(sortOptions[sortName]).skip(skip).limit(limit).lean(),
      Slang.countDocuments(filter),
    ])

    return response.json({
      success: true,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data,
    })
  } catch (error) {
    return sendDatabaseError(response, error)
  }
}

export async function getSlangById(request, response) {
  if (!hasValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid slang ID' })
  }

  try {
    const slang = await Slang.findById(request.params.id).lean()
    if (!slang) return response.status(404).json({ success: false, message: 'Slang not found' })
    return response.json({ success: true, data: slang })
  } catch (error) {
    return sendDatabaseError(response, error)
  }
}

export async function createSlang(request, response) {
  try {
    const slang = await Slang.create({
      ...createPayload(request.body),
      createdBy: request.user.id,
    })
    return response.status(201).json({
      success: true,
      message: 'Slang added successfully',
      data: slang,
    })
  } catch (error) {
    return sendDatabaseError(response, error)
  }
}

export async function updateSlang(request, response) {
  if (!hasValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid slang ID' })
  }

  const updates = Object.fromEntries(
    Object.entries(request.body).filter(([key]) => updateFields.includes(key)),
  )
  if (!Object.keys(updates).length) {
    return response.status(400).json({ success: false, message: 'No valid fields supplied' })
  }

  try {
    const slang = await Slang.findById(request.params.id)
    if (!slang) return response.status(404).json({ success: false, message: 'Slang not found' })

    if (!slang.createdBy || slang.createdBy.toString() !== request.user.id) {
      return response.status(403).json({ success: false, message: 'You are not allowed to update this slang' })
    }

    Object.assign(slang, updates)
    await slang.save()
    return response.json({ success: true, message: 'Slang updated successfully', data: slang })
  } catch (error) {
    return sendDatabaseError(response, error)
  }
}

export async function deleteSlang(request, response) {
  if (!hasValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid slang ID' })
  }

  try {
    const slang = await Slang.findById(request.params.id)
    if (!slang) return response.status(404).json({ success: false, message: 'Slang not found' })

    if (!slang.createdBy || slang.createdBy.toString() !== request.user.id) {
      return response.status(403).json({ success: false, message: 'You are not allowed to delete this slang' })
    }

    await slang.deleteOne()
    return response.json({ success: true, message: 'Slang deleted successfully' })
  } catch (error) {
    return sendDatabaseError(response, error)
  }
}
