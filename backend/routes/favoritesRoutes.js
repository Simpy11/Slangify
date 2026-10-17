import { Router } from 'express'
import { addFavorite, getFavorites, removeFavorite } from '../controllers/favoritesController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/', protect, getFavorites)
router.post('/:slangId', protect, addFavorite)
router.delete('/:slangId', protect, removeFavorite)

export default router
