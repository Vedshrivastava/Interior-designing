import mongoose from "mongoose";

export const connectDB = async (uri) => {
  try {
    // Defaults to "Interior" (the one Railway/production has always used)
    // when MONGO_DB_NAME isn't set, so production needs zero config
    // changes — only a local .env opting into a separate dev database
    // needs to set it.
    const dbName = process.env.MONGO_DB_NAME || "Interior";
    await mongoose.connect(uri, { dbName });
    console.log(`Database connected (${dbName})`);
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
};
