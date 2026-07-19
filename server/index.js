import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '../public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
}

// Request validation middleware
function validateInputs(req, res, next) {
  const { question, attempt } = req.body;

  if (typeof question !== 'string' || typeof attempt !== 'string') {
    return res.status(400).json({ error: "Invalid inputs. Both question and attempt must be strings." });
  }

  const trimmedQuestion = question.trim();
  const trimmedAttempt = attempt.trim();

  if (!trimmedQuestion) {
    return res.status(400).json({ error: "Question cannot be empty." });
  }

  if (!trimmedAttempt) {
    return res.status(400).json({ error: "Attempt cannot be empty." });
  }

  const combinedLength = trimmedQuestion.length + trimmedAttempt.length;
  if (combinedLength > 4000) {
    return res.status(400).json({ error: "Input too long. Combined text of question and attempt must not exceed 4000 characters." });
  }

  req.validatedData = {
    question: trimmedQuestion,
    attempt: trimmedAttempt
  };
  next();
}

// Calls Google's Gemini API with x-goog-api-key header authentication
async function callGemini(systemPrompt, userPrompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY || "",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          { text: systemPrompt }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Gemini API error (${response.status}):`, errorBody);
    throw new Error(`Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  
  // Handlers for empty responses or blocked safety content
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("No response was generated (it may have been blocked for safety reasons).");
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No readable text returned by the tutor.");
  }

  return text;
}

// POST /api/hint - Request a small nudge tutor hint from Gemini
app.post('/api/hint', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  console.log(`[API] Gemini Hint requested. Q-len: ${question.length}, A-len: ${attempt.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student has already attempted the problem. Look at what they tried, briefly say what's on the right track and what's off, then give ONE small nudge toward the next step. Do NOT give the final answer. Under 80 words, warm and direct, no headers or bullet points. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}`;

  try {
    const text = await callGemini(systemPrompt, userPrompt);
    res.json({ text });
  } catch (error) {
    console.error("Error generating hint with Gemini:", error);
    res.status(500).json({ error: error.message || "Could not reach the tutor right now." });
  }
});

// POST /api/explain - Request the full explanation and final answer from Gemini
app.post('/api/explain', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  console.log(`[API] Gemini Explanation requested. Q-len: ${question.length}, A-len: ${attempt.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student attempted the problem and got a hint but is still stuck. Now give the full step-by-step explanation and the final answer, in plain simple language. Keep paragraphs short. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}`;

  try {
    const text = await callGemini(systemPrompt, userPrompt);
    res.json({ text });
  } catch (error) {
    console.error("Error generating explanation with Gemini:", error);
    res.status(500).json({ error: error.message || "Could not reach the tutor right now." });
  }
});

// Serve frontend fallback for unmatched paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
