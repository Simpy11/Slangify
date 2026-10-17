
import './config/loadEnvironment.js'
import { createApp } from './app.js'
import connectDB from './config/db.js'
import { validateEnvironment } from './config/environment.js'


let configuration
try {
  configuration = validateEnvironment()
} catch (error) {
  console.error("MongoDB connection failed:");
  console.error("Name:", error.name);
  console.error("Message:", error.message);
  console.error("Cause:", error.cause?.message);
  process.exit(1);
}
const app = createApp(configuration.clientOrigin, configuration.pythonServiceUrl)

async function startServer() {
  await connectDB()

  app.listen(configuration.port, () => {
    console.log(`Slangify API listening on port ${configuration.port}`)
  })
}

startServer()
