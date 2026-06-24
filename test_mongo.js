const mongoose = require('mongoose');

async function testConnection(password) {
    const uri = `mongodb+srv://jazicyber_db_user:${password}@cluster0.dbub0hq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log(`Success with password: ${password}`);
        process.exit(0);
    } catch (e) {
        console.log(`Failed with password: ${password}. Error: ${e.message}`);
    }
}

async function run() {
    await testConnection('edIuUnb4gsC4DuY6');
    await testConnection('edluUnb4gsC4DuY6');
    process.exit(1);
}

run();
