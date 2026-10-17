import mongoose from 'mongoose'
import Slang from '../models/Slang.js'
import User from '../models/User.js'

function hasValidId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function existingFavorites(user) {
  return user.favorites.filter(Boolean)
}

function sendFavoritesError(response, error) {
  console.error(`Favorites database operation failed (${error?.name || 'Error'})`)
  return response.status(500).json({ success: false, message: 'Internal server error' })
}

export async function getFavorites(request, response) {
  try {
    const user = await User.findById(request.user.id).populate('favorites')
    if (!user) return response.status(401).json({ success: false, message: 'User account not found' })

    const favorites = existingFavorites(user)
    return response.json({ success: true, count: favorites.length, data: favorites })
  } catch (error) {
    return sendFavoritesError(response, error)
  }
}

export async function addFavorite(request, response) {
  const { slangId } = request.params
  if (!hasValidId(slangId)) {
    return response.status(400).json({ success: false, message: 'Invalid slang ID' })
  }

  try {
    const slang = await Slang.findById(slangId).lean()
    if (!slang) return response.status(404).json({ success: false, message: 'Slang not found' })

    const user = await User.findByIdAndUpdate(
      request.user.id,
      { $addToSet: { favorites: slang._id } },
      { new: true },
    )
    if (!user) return response.status(401).json({ success: false, message: 'User account not found' })

    return response.json({ success: true, message: 'Slang added to favorites', data: slang })
  } catch (error) {
    return sendFavoritesError(response, error)
  }
}

export async function removeFavorite(request, response) {
  const { slangId } = request.params
  if (!hasValidId(slangId)) {
    return response.status(400).json({ success: false, message: 'Invalid slang ID' })
  }

  try {
    const slangExists = await Slang.exists({ _id: slangId })
    if (!slangExists) return response.status(404).json({ success: false, message: 'Slang not found' })

    const user = await User.findByIdAndUpdate(
      request.user.id,
      { $pull: { favorites: slangId } },
      { new: true },
    )
    if (!user) return response.status(401).json({ success: false, message: 'User account not found' })

    return response.json({ success: true, message: 'Slang removed from favorites' })
  } catch (error) {
    return sendFavoritesError(response, error)
  }
}
