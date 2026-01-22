const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function test() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log("Listing available models...");
        // The library doesn't have a direct listModels in the main object, 
        // it's usually done via the fetch API or the REST endpoint if manually handled.
        // However, let's try a different approach: try gemini-pro (the older name) or 
        // check the library's latest model strings.

        // Actually, let's try a very generic model name or check if the key is restricted to a certain version.

        // Testing several common names:
        const models = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"];

        for (const modelName of models) {
            try {
                console.log(`Testing model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hi");
                console.log(`SUCCESS with ${modelName}:`, (await result.response).text().substring(0, 10));
                break;
            } catch (e) {
                console.log(`FAILED with ${modelName}:`, e.message);
            }
        }

    } catch (error) {
        console.error("Critical error:", error.message);
    }
}

test();
