import { Router } from 'express'
import { getApiStatus } from '../controllers/testController.js'

const router = Router()

router.get('/', getApiStatus)

export default router
