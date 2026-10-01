import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { Admin } from './models/index.js';

async function main() {
  try {
    await connectDB();
  } catch (err) {
    console.error(`\n✖ Could not connect to MongoDB at ${env.mongoUri}\n  ${err.message}\n  Make sure MongoDB is running locally.\n`);
    process.exit(1);
  }
  console.log('✔ MongoDB connected');

  // Make sure all indexes (incl. the unique bill index) exist.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  if ((await Admin.countDocuments()) === 0) {
    console.warn('⚠ No admin accounts found. Run `npm run seed` to create them.');
  }

  const app = createApp();
  app.listen(env.port, () => console.log(`✔ API listening on http://localhost:${env.port}`));
}

main();
