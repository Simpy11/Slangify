import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Resolve the backend file before app/routes are initialized, regardless of cwd.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
