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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash';

if (!OPENROUTER_API_KEY) {
  console.warn('WARNING: OPENROUTER_API_KEY is not defined in the environment.');
}

// ── Request queue ──
class AIQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minGapMs = 500;
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

const aiQueue = new AIQueue();

// ── OpenRouter API call ──
async function callAI(systemPrompt, userPrompt) {
  const apiKey = OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
          'HTTP-Referer': 'https://stutor-ai.onrender.com',
          'X-Title': 'Show Your Work First'
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1024,
          temperature: 0.7,
          stream: false
        })
      });

      if (response.status === 429) {
        if (attempt === maxRetries) throw new Error('RATE_LIMIT_EXCEEDED');
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.log(`[OpenRouter] 429, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[OpenRouter] HTTP ${response.status}:`, errBody.substring(0, 500));
        throw new Error(`OpenRouter API error (${response.status})`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error('No readable text returned by the tutor.');
      }

      return text;

    } catch (err) {
      if (attempt === maxRetries) throw err;
      const msg = err && err.message ? err.message : '';
      if (!msg.includes('429') && !msg.includes('RATE_LIMIT')) {
        throw err;
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

// ── Unified error handler ──
async function handleAIRequest(req, res, systemPrompt, userPrompt) {
  try {
    const text = await aiQueue.enqueue(() => callAI(systemPrompt, userPrompt));
    res.json({ text });
  } catch (error) {
    const errMsg = error && error.message ? error.message : '';
    console.error('[AI Error]', errMsg || '(no message)');

    if (errMsg === 'RATE_LIMIT_EXCEEDED' || errMsg.includes('429') || errMsg.includes('RATE_LIMIT')) {
      return res.status(429).json({
        error: 'rate_limit',
        message: 'Our AI tutor is busy right now. Please wait 20 seconds and try again.'
      });
    }

    res.status(500).json({
      error: 'internal_error',
      message: errMsg || 'Could not reach the tutor right now.'
    });
  }
}

// ── Diagnostic endpoint ──
app.get('/api/check', async (req, res) => {
  const keyPreview = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.substring(0, 12) + '...' : 'MISSING';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
        'HTTP-Referer': 'https://stutor-ai.onrender.com',
        'X-Title': 'Show Your Work First'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10,
        stream: false
      })
    });
    const body = await response.text();
    res.json({
      provider: 'openrouter',
      model: OPENROUTER_MODEL,
      keyPrefix: keyPreview,
      status: response.status,
      ok: response.ok,
      body: body.substring(0, 500)
    });
  } catch (err) {
    res.json({ provider: 'openrouter', model: OPENROUTER_MODEL, keyPrefix: keyPreview, error: err.message });
  }
});

// ── Routes ──

app.post('/api/hint', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  console.log(`[API] Hint requested. Q-len: ${question.length}, A-len: ${attempt.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student has already attempted the problem. Look at what they tried, briefly say what's on the right track and what's off, then give ONE small nudge toward the next step. Do NOT give the final answer. Under 80 words, warm and direct, no headers or bullet points. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum. End your response with a short, warm check-in question to see if the student understood, like 'Does that make sense so far, or do you still have a doubt about any part of it?' Vary the phrasing naturally — don't use identical wording every time.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}`;

  await handleAIRequest(req, res, systemPrompt, userPrompt);
});

app.post('/api/explain', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  console.log(`[API] Explanation requested. Q-len: ${question.length}, A-len: ${attempt.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student attempted the problem and got a hint but is still stuck. Now give the full step-by-step explanation and the final answer, in plain simple language. Keep paragraphs short. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum. End your response with a short, warm check-in question to see if the student understood, like 'Does that make sense so far, or do you still have a doubt about any part of it?' Vary the phrasing naturally — don't use identical wording every time.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}`;

  await handleAIRequest(req, res, systemPrompt, userPrompt);
});

app.post('/api/deepen', validateInputs, async (req, res) => {
  const { question, attempt } = req.validatedData;
  const { previousExplanation } = req.body;

  if (typeof previousExplanation !== 'string' || !previousExplanation.trim()) {
    return res.status(400).json({ error: 'previousExplanation is required.' });
  }

  console.log(`[API] Deepen requested. Q-len: ${question.length}, A-len: ${attempt.length}, Prev-explain-len: ${previousExplanation.length}`);

  const systemPrompt = `You are a patient tutor for an Indian school student. The student wants to understand this more deeply. Building on the explanation already given (below), go further — add more depth, a related real-world example, an edge case, or the 'why' behind the concept, rather than repeating what was already explained. Keep it appropriately concise, not overwhelming. When writing any mathematical expressions, wrap them in dollar signs using LaTeX notation, e.g. $\\sqrt{5}$ for square root, $x^2$ for exponents, $\\frac{a}{b}$ for fractions. This is required for correct rendering. If this concept can be usefully shown as a diagram (a process, a sequence of steps, a comparison, a cause-and-effect chain, a flow), include a Mermaid diagram wrapped in a code block starting with three backticks and 'mermaid', ending with three backticks. Use simple flowchart or sequence diagram syntax. Only include a diagram when it genuinely helps understanding — skip it for purely computational questions. Keep diagrams simple: 4-6 nodes maximum.`;
  const userPrompt = `Student's Question:\n${question}\n\nStudent's Attempt:\n${attempt}\n\nPrevious Explanation Given:\n${previousExplanation}`;

  await handleAIRequest(req, res, systemPrompt, userPrompt);
});

// Serve frontend fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}  AI: OpenRouter (${OPENROUTER_MODEL})`);
});
