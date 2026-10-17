export function createCorsOptions(clientOrigin) {
  return {
    origin(origin, callback) {
      if (!origin || origin === clientOrigin) return callback(null, true)
      return callback(Object.assign(new Error('Origin is not allowed by CORS'), { status: 403 }))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }
}
