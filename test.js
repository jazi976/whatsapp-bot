require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hi");
        console.log(`Success with ${modelName}:`, result.response.text());
        return true;
    } catch (e) {
        console.error(`Failed with ${modelName}:`, e.message);
        return false;
    }
}

async function run() {
    await testModel('gemini-1.5-flash');
    await testModel('gemini-1.5-flash-latest');
    await testModel('gemini-1.5-pro');
    await testModel('gemini-pro');
}

run();
