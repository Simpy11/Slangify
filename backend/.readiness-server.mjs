import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import Slang from './models/Slang.js';
import seed from './data/slangSeed.js';
const mongo=await MongoMemoryServer.create({instance:{launchTimeout:30000}});
await mongoose.connect(mongo.getUri());
await Slang.insertMany(seed);
await mongoose.disconnect();
const server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,MONGO_URI:mongo.getUri(),JWT_SECRET:randomBytes(32).toString('hex'),CLIENT_URL:'http://127.0.0.1:5175',PYTHON_SERVICE_URL:'http://127.0.0.1:8055',PORT:'5055'},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',chunk=>{if(String(chunk).includes('listening'))console.log('READINESS: real Express server started with isolated MongoDB and temporary configuration.');});
server.stderr.on('data',()=>console.error('READINESS: Express reported a startup/runtime error.'));
let closing=false;
async function stop(){if(closing)return;closing=true;server.kill();await mongo.stop();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('exit',stop);
setTimeout(stop,30*60*1000);
