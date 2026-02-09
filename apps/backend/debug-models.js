const axios = require('axios');
require('dotenv').config();

async function test() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found");
        return;
    }

    try {
        console.log("Querying Gemini API for available models...");
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        console.log("Models found:", response.data.models.map(m => m.name).join(', '));
    } catch (error) {
        console.error("Error listing models:");
        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("Message:", error.message);
        }
    }
}

test();
