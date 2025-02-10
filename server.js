const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const Tesseract = require('tesseract.js');
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post('/chat', async (req, res) => {
    const { userMessage } = req.body;
    if (!userMessage || userMessage.trim() === '') {
        return res.status(400).json({ error: 'User message cannot be empty' });
    }

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: userMessage },
                ],
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const botMessage = response.data.choices[0].message.content;
        res.json({ message: botMessage });

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Error contacting the ChatGPT API' });
    }
});


const summarizeText = async (text) => {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are a text summarizer." },
                    { role: "user", content: `Summarize this:\n\n${text}` }
                ]
            },
            {
                headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Error summarizing text:", error);
        return "Error summarizing text.";
    }
};

app.post('/summarize', upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        let extractedText = "";

        if (req.file.mimetype === "application/pdf") {
            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdfParse(dataBuffer);
            extractedText = data.text.substring(0, 4000); // Limit size for OpenAI

        } else if (req.file.mimetype === "text/plain") {
            extractedText = fs.readFileSync(req.file.path, "utf8").substring(0, 4000);

        } else if (req.file.mimetype.startsWith("image/")) {
            const { data: { text } } = await Tesseract.recognize(req.file.path, "eng");
            extractedText = text.substring(0, 4000);
        } else {
            return res.status(400).json({ error: "Unsupported file type" });
        }

        const summary = await summarizeText(extractedText);

        res.json({ summary });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error processing PDF" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
