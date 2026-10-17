export function notFoundHandler(_request, response) {
  response.status(404).json({
    success: false,
    message: 'Route not found',
  })
}

export function errorHandler(error, _request, response, _next) {
  const status = error.status || 500
  console.error(`Unhandled request error (${error.name || 'Error'})`)
  response.status(status).json({
    success: false,
    message: error.type === 'entity.parse.failed' ? 'Request body must be valid JSON'
      : error.type === 'entity.too.large' ? 'Request body is too large'
        : status < 500 ? error.message : 'Internal server error',
  })
}
