import { Router } from 'express'
import { getAiHealth, processWithAi } from '../controllers/aiController.js'

const router = Router()

router.get('/health', getAiHealth)
router.post('/process', processWithAi)

export default router
