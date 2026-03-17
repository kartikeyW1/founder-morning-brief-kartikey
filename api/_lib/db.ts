import mongoose from 'mongoose';

let cached: typeof mongoose | null = null;

export async function connectDB() {
  if (cached) return cached;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  cached = await mongoose.connect(uri);
  return cached;
}
