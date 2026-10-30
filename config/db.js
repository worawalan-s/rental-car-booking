const mongoose = require('mongoose');

const connectDB = async () => {
  mongoose.set('strictQuery', true);
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    if (
      err.code === 'EBADRESP' &&
      process.env.MONGO_URI &&
      process.env.MONGO_URI.startsWith('mongodb+srv://')
    ) {
      // Fallback for macOS c-ares DNS SRV resolver bug
      const parts = process.env.MONGO_URI.replace('mongodb+srv://', '').split('@');
      const credentials = parts[0];
      const directUri = `mongodb://${credentials}@ac-ch8cqkf-shard-00-00.wsqzxut.mongodb.net:27017,ac-ch8cqkf-shard-00-01.wsqzxut.mongodb.net:27017,ac-ch8cqkf-shard-00-02.wsqzxut.mongodb.net:27017/RentalCarBooking?ssl=true&replicaSet=atlas-xdnhdm-shard-0&authSource=admin&retryWrites=true&w=majority`;
      const conn = await mongoose.connect(directUri);
      console.log(`MongoDB Connected (Fallback): ${conn.connection.host}`);
      return conn;
    }
    throw err;
  }
};

module.exports = connectDB;
