import jwt from 'jsonwebtoken'

export function protect(request, response, next) {
  const authorization = request.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ success: false, message: 'Authentication required' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    request.user = { id: payload.userId }
    return next()
  } catch {
    return response.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}
