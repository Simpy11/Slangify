import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/User.js'

const MIN_PASSWORD_LENGTH = 8

function createToken(userId) {
  if (!process.env.JWT_SECRET) throw new Error('JWT configuration is missing')
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function safeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
  }
}

function validationMessage(error) {
  return Object.values(error.errors).map((item) => item.message).join(' ')
}

function handleAuthError(response, error) {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0]
    const message = field === 'email' ? 'An account with this email already exists' : 'This username is already taken'
    return response.status(409).json({ success: false, message })
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return response.status(400).json({ success: false, message: validationMessage(error) })
  }
  console.error(`Authentication operation failed (${error?.name || 'Error'})`)
  return response.status(500).json({ success: false, message: 'Internal server error' })
}

export async function registerUser(request, response) {
  const name = String(request.body.name || '').trim()
  const username = String(request.body.username || '').trim().toLowerCase()
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')

  if (!name || !username || !email || !password) {
    return response.status(400).json({ success: false, message: 'Name, username, email, and password are required' })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return response.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
  }

  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] }).lean()
    if (existing?.email === email) return response.status(409).json({ success: false, message: 'An account with this email already exists' })
    if (existing?.username === username) return response.status(409).json({ success: false, message: 'This username is already taken' })

    const user = await User.create({ name, username, email, password })
    return response.status(201).json({
      success: true,
      message: 'Account created successfully',
      token: createToken(user._id.toString()),
      user: safeUser(user),
    })
  } catch (error) {
    return handleAuthError(response, error)
  }
}

export async function loginUser(request, response) {
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  if (!email || !password) return response.status(400).json({ success: false, message: 'Email and password are required' })

  try {
    const user = await User.findOne({ email }).select('+password')
    if (!user || !(await user.matchesPassword(password))) {
      return response.status(401).json({ success: false, message: 'Invalid email or password' })
    }
    return response.json({
      success: true,
      message: 'Login successful',
      token: createToken(user._id.toString()),
      user: safeUser(user),
    })
  } catch (error) {
    return handleAuthError(response, error)
  }
}

export async function getCurrentUser(request, response) {
  try {
    const user = await User.findById(request.user.id).lean()
    if (!user) return response.status(401).json({ success: false, message: 'User account not found' })
    return response.json({ success: true, user: safeUser(user) })
  } catch (error) {
    return handleAuthError(response, error)
  }
}
