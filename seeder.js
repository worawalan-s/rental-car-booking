const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config/config.env' });

// Load Mongoose models
const Provider = require('./models/Provider');
const Car = require('./models/Car');
const User = require('./models/User');
const Booking = require('./models/Booking');

// Database connection helper
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('FATAL ERROR: MONGO_URI is not defined in config/config.env');
    process.exit(1);
  }
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

// Read mock JSON datasets
const providers = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_data', 'providers.json'), 'utf-8')
);
const cars = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_data', 'cars.json'), 'utf-8')
);
const users = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_data', 'users.json'), 'utf-8')
);
const bookings = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_data', 'bookings.json'), 'utf-8')
);

// Import all data into database with dynamic relational linking
const importData = async () => {
  try {
    await connectDB();

    // 1. Wipe existing data in reverse dependency order to prevent duplicate keys
    await Booking.deleteMany();
    await Car.deleteMany();
    await Provider.deleteMany();
    await User.deleteMany();
    console.log('Existing collections cleared...');

    // 2. Create Providers
    const createdProviders = await Provider.create(providers);
    console.log(`✓ ${createdProviders.length} Providers imported`);

    // 3. Map real Provider ObjectIds dynamically into Cars
    const carsWithProviders = cars.map((car, index) => {
      const assignedProvider = createdProviders[index % createdProviders.length];
      return {
        ...car,
        provider: assignedProvider._id,
      };
    });
    const createdCars = await Car.create(carsWithProviders);
    console.log(`✓ ${createdCars.length} Cars imported (covering 7 categories)`);

    // 4. Create Users individually to ensure unique salt/hash per user via pre-save hook
    const createdUsers = [];
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers.push(user);
    }
    console.log(
      `✓ ${createdUsers.length} Users imported (unique bcrypt salt/hash generated for each user)`
    );

    // 5. Map real Car, Provider, and User ObjectIds into Bookings
    const bookingsWithRefs = bookings.map((booking, index) => {
      const assignedCar = createdCars[index % createdCars.length];
      const assignedUser = createdUsers[index % createdUsers.length];
      return {
        ...booking,
        car: assignedCar._id,
        provider: assignedCar.provider,
        user: assignedUser._id,
      };
    });
    const createdBookings = await Booking.create(bookingsWithRefs);
    console.log(`✓ ${createdBookings.length} Bookings imported`);

    console.log('\x1b[32m%s\x1b[0m', '✅ Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Data Import Failed:', err.message);
    process.exit(1);
  }
};

// Delete all data across collections
const destroyData = async () => {
  try {
    await connectDB();

    await Booking.deleteMany();
    await Car.deleteMany();
    await Provider.deleteMany();
    await User.deleteMany();

    console.log('\x1b[31m%s\x1b[0m', '🗑️ All database collections wiped successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Data Destroy Failed:', err.message);
    process.exit(1);
  }
};

// CLI flag router
if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  destroyData();
} else {
  console.log('Usage: node seeder.js -i (to import) or node seeder.js -d (to destroy)');
  process.exit(1);
}
