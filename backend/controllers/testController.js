export function getApiStatus(_request, response) {
  response.json({
    success: true,
    message: 'Slangify API is running',
  })
}
