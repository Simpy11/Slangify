import { Router } from 'express'

const router = Router()
router.get('/', async (request, response) => {
  response.set('Cache-Control', 'no-store')
  try {
    return response.json(await request.app.locals.newsService.getNews())
  } catch {
    response.set('Retry-After', '300')
    return response.status(503).json({ success: false, code: 'NEWS_UNAVAILABLE', message: 'The buzz is taking a break. News sources are temporarily unavailable; please try again shortly.' })
  }
})
export default router
