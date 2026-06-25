require('dotenv').config();
const mongoose = require('mongoose');

async function clearDb() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected. Dropping database...');
    await mongoose.connection.db.dropDatabase();
    console.log('Database dropped. Session cleared!');
    process.exit(0);
}

clearDb().catch(console.error);
