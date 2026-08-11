import mongoose from "mongoose";

export const connectDB = async (uri) => {
  try {
    // Defaults to "Interior" (the one Railway/production has always used)
    // when MONGO_DB_NAME isn't set, so production needs zero config
    // changes — only a local .env opting into a separate dev database
    // needs to set it.
    const dbName = process.env.MONGO_DB_NAME || "Interior";
    // minPoolSize keeps a handful of connections to Atlas open and idle
    // rather than opening them lazily on first use. Several report
    // endpoints (e.g. the CA Monthly Package) fire ~10 queries
    // concurrently via Promise.all — on a cold pool that means ~10
    // simultaneous new TLS handshakes to Atlas instead of reusing one
    // warm connection, which is what was actually behind the multi-second
    // "first click after a while" delays users were seeing.
    await mongoose.connect(uri, { dbName, minPoolSize: 5 });
    console.log(`Database connected (${dbName})`);
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
};
