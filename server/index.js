import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in the environment.');
}

// ── Request queue: space requests 2.5s apart (stays under 15 RPM free tier) ──
class GeminiQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minGapMs = 2500;
  }

  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const now = Date.now();
    if (now - this.lastRequestTime < this.minGapMs) {
      await new Promise(r => setTimeout(r, this.minGapMs - (now - this.lastRequestTime)));
    }
    const { taskFn, resolve, reject } = this.queue.shift();
    try {
      const result = await taskFn();
      this.lastRequestTime = Date.now();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.processing = false;
      if (this.queue.length > 0) setImmediate(() => this.process());
    }
  }
}

const geminiQueue = new GeminiQueue();

// ── Gemini API call with retry logic ──
async function callGemini(systemPrompt, userPrompt, options = {}) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens || 800,
            temperature: options.temperature || 0.7
          }
        })
      });

      if (response.status === 429) {
        if (attempt === maxRetries) throw new Error('RATE_LIMIT_EXCEEDED');
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.log(`[Gemini] 429, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[Gemini] HTTP ${response.status} body:`, errBody.substring(0, 500));
        throw new Error(`Gemini HTTP ${response.status}: ${errBody}`);
      }

      const data = await response.json();

      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('No response was generated (it may have been blocked for safety reasons).');
      }

      const text = candidate.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No readable text returned by the tutor.');
      }

      return text;

    } catch (err) {
      if (attempt === maxRetries) throw err;
      const msg = err && err.message ? err.message : '';
      if (msg.startsWith('Gemini HTTP') && !msg.includes('429')) {
        throw err; // Don't retry on non-429 HTTP errors
      }
    }
  }
}

// ── Request validation middleware ──
function validateInputs(req, res, next) {
  const { question, attempt } = req.body;

  if (typeof question !== 'string' || typeof attempt !== 'string') {
    return res.status(400).json({ error: 'Invalid inputs. Both question and attempt must be strings.' });
  }

  const trimmedQuestion = question.trim();
  const trimmedAttempt = attempt.trim();

  if (!trimmedQuestion) {
    return res.status(400).json({ error: 'Question cannot be empty.' });
  }

  if (!trimmedAttempt) {
    return res.status(400).json({ error: 'Attempt cannot be empty.' });
  }

  const combinedLength = trimmedQuestion.length + trimmedAttempt.length;
  if (combinedLength > 4000) {
    return res.status(400).json({ error: 'Input too long. Combined text of question and attempt must not exceed 4000 characters.' });
  }

  req.validatedData = { question: trimmedQuestion, attempt: trimmedAttempt };
  next();
}

// ── Unified error handler for Gemini calls ──
async function handleGeminiRequest(req, res, systemPrompt, userPrompt) {
  try {
    const text = await geminiQueue.enqueue(() => callGemini(systemPrompt, userPrompt));
    res.json({ text });
  } catch (error) {
    console.error('[Gemini Error]', error.message);

    if (error.message === 'RATE_LIMIT_EXCEEDED') {
      return res.status(429).json({
        error: 'rate_limit',
        message: 'Our AI tutor is busy right now. Please wait 20 seconds and try again.'
      });
    }

    // Check for 429 embedded in the error string
    if (error.message.includes('429') || error.message.includes('RATE_LIMIT')) {
      return res.status(429).json({
        error: 'rate_limit',
        message: 'Our AI tutor is busy right now. Please wait 20 seconds and try again.'
      });
    }

    const friendlyMessage = (error && error.message)
      ? error.message
      : 'Could not reach the tutor right now.';
    res.status(500).json({
      error: 'internal_error',
      message: friendlyMessage
    });
  }
}

// ── Diagnostic endpoint ──
app.get('/api/check', async (req, res) => {
  const keyPreview = GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 6) + '...' : 'MISSING';
  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY ? 'HIDDEN' : 'MISSING'}`;

  console.log(`[Check] Model: ${model}, Key prefix: ${keyPreview}`);

  // Test call with a minimal prompt
  try {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY || '' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say OK' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });

    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch (e) { parsed = body; }

    console.log(`[Check] Gemini responded with status ${response.status}:`, typeof parsed === 'string' ? parsed.substring(0, 200) : JSON.stringify(parsed).substring(0, 200));

    res.json({
      status: response.status,
      ok: response.ok,
      model,
      keyPrefix: keyPreview,
      response: parsed
    });
  } catch (err) {
    console.error('[Check] Error:', err.message);
    res.status(500).json({ error: err.message, model, keyPrefix: keyPreview });
  }
});

// ── Routes ──

// POST /api/hint
app.post('/api/hint', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  console.log(`[API] Hint requested. Q-len: ${question.length}, A-len: ${attempt.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student has already attempted the problem. Look at what they tried, briefly say what's on the right track and what's off, then give ONE small nudge toward the next step. Do NOT give the final answer. Under 80 words, warm and direct, no headers or bullet points. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum. End your response with a short, warm check-in question to see if the student understood, like 'Does that make sense so far, or do you still have a doubt about any part of it?' Vary the phrasing naturally — don't use identical wording every time.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}`;

  await handleGeminiRequest(req, res, systemPrompt, userPrompt);
});

// POST /api/explain
app.post('/api/explain', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  console.log(`[API] Explanation requested. Q-len: ${question.length}, A-len: ${attempt.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student attempted the problem and got a hint but is still stuck. Now give the full step-by-step explanation and the final answer, in plain simple language. Keep paragraphs short. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum. End your response with a short, warm check-in question to see if the student understood, like 'Does that make sense so far, or do you still have a doubt about any part of it?' Vary the phrasing naturally — don't use identical wording every time.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}`;

  await handleGeminiRequest(req, res, systemPrompt, userPrompt);
});

// POST /api/deepen
app.post('/api/deepen', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  const { previousExplanation } = req.body;

  if (typeof previousExplanation !== 'string' || !previousExplanation.trim()) {
    return res.status(400).json({ error: 'previousExplanation is required.' });
  }

  console.log(`[API] Deepen requested. Q-len: ${question.length}, A-len: ${attempt.length}, Prev-explain-len: ${previousExplanation.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student wants to understand this more deeply. Building on the explanation already given (below), go further — add more depth, a related real-world example, an edge case, or the 'why' behind the concept, rather than repeating what was already explained. Keep it appropriately concise, not overwhelming. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}\n\nPrevious Explanation Given:\n${previousExplanation}`;

  await handleGeminiRequest(req, res, systemPrompt, userPrompt);
});

// Serve frontend fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}  Model: ${GEMINI_MODEL}`);
});
