import { Router } from 'express'
import {
  createSlang,
  deleteSlang,
  getAllSlang,
  getSlangById,
  updateSlang,
} from '../controllers/slangController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = Router()

router.route('/')
  .get(getAllSlang)
  .post(protect, createSlang)

router.route('/:id')
  .get(getSlangById)
  .put(protect, updateSlang)
  .delete(protect, deleteSlang)

export default router
