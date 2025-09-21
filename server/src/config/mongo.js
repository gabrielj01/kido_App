import mongoose from 'mongoose';

let connecting = null;
let currentUri = null;

export async function connectDB(uriFromCaller) {
  // Accept MONGO_URI or MONGODB_URI; safe local fallback
  const uri =
    uriFromCaller ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/babysit';

  // Reuse already-open connection
  if (mongoose.connection.readyState === 1) {
    if (currentUri && currentUri !== uri) {
      console.warn('[mongo] Already connected; reusing existing connection.');
    }
    return mongoose.connection;
  }
  if (connecting) return connecting;

  mongoose.set('strictQuery', true);
  currentUri = uri;

  connecting = mongoose.connect(uri)
    .then(() => {
      console.log('✅ MongoDB connected @', currentUri);
      return mongoose.connection;
    })
    .catch(err => {
      console.error('❌ Mongo connect error:', err.message);
      throw err;
    })
    .finally(() => { connecting = null; });

  return connecting;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}
