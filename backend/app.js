import newsRoutes from './routes/newsRoutes.js'
import { createNewsService } from './services/newsService.js'
import cors from 'cors'
import express from 'express'
import { createCorsOptions } from './config/cors.js'
import aiRoutes from './routes/aiRoutes.js'
import assistantRoutes from './routes/assistantRoutes.js'
import authRoutes from './routes/authRoutes.js'
import favoritesRoutes from './routes/favoritesRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import slangRoutes from './routes/slangRoutes.js'
import testRoutes from './routes/testRoutes.js'

export function createApp(clientOrigin, pythonServiceUrl = process.env.PYTHON_SERVICE_URL, options = {}) {
  const app = express()
  app.locals.newsService = options.newsService || createNewsService()
  app.locals.pythonServiceUrl = pythonServiceUrl
  const pythonTimeoutMs = Number(options.pythonTimeoutMs ?? process.env.PYTHON_SERVICE_TIMEOUT_MS ?? 55000)
  if (!Number.isFinite(pythonTimeoutMs) || pythonTimeoutMs <= 0) {
    throw new Error('PYTHON_SERVICE_TIMEOUT_MS must be a positive number')
  }
  app.locals.pythonTimeoutMs = pythonTimeoutMs

  app.use(cors(createCorsOptions(clientOrigin)))
  app.use(express.json())

  app.use('/api/news', newsRoutes)
  app.use('/api/test', testRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/assistant', assistantRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/favorites', favoritesRoutes)
  app.use('/api/slang', slangRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
