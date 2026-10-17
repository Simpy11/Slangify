import mongoose from 'mongoose'

export default async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error('MongoDB connection failed: MONGO_URI is not configured')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error(`MongoDB connection failed (${error.name})`)
    process.exit(1)
  }
}
