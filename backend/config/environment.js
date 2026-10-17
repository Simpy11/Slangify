const REQUIRED_VARIABLES = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL', 'PYTHON_SERVICE_URL']

function clientOrigin(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('CLIENT_URL must be a valid absolute URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value.replace(/\/$/, '')) {
    throw new Error('CLIENT_URL must be an http(s) origin without a path')
  }
  return parsed.origin
}

function serviceUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('PYTHON_SERVICE_URL must be a valid absolute URL')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash) {
    throw new Error('PYTHON_SERVICE_URL must be an http(s) URL without a query or fragment')
  }
  return value.replace(/\/+$/, '')
}

export function validateEnvironment(environment = process.env) {
  const missing = REQUIRED_VARIABLES.filter((name) => !environment[name]?.trim())
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  const port = environment.PORT === undefined || environment.PORT === '' ? 5000 : Number(environment.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  return {
    port,
    clientOrigin: clientOrigin(environment.CLIENT_URL.trim()),
    pythonServiceUrl: serviceUrl(environment.PYTHON_SERVICE_URL.trim()),
  }
}
