import dotenv from 'dotenv'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import slangSeed from '../data/slangSeed.js'
import Slang from '../models/Slang.js'

dotenv.config()

async function seedSlang() {
  try {
    await connectDB()
    await Slang.deleteMany({})
    const slang = await Slang.insertMany(slangSeed)
    console.log(`Seeded ${slang.length} slang entries successfully`)
  } catch (error) {
    console.error(`Slang seed failed (${error.name || 'Error'})`)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seedSlang()
