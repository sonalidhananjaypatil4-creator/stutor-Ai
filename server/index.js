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

// ── Gemini API call with retry logic and model fallback ──
// Try multiple URL patterns + model combos (different API versions have different quota pools)
const GEMINI_ENDPOINTS = (process.env.GEMINI_API_VERSION || 'v1beta') === 'v1'
  ? [
      `https://generativelanguage.googleapis.com/v1/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent`,
    ]
  : [
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent`,
    ];

async function callGemini(systemPrompt, userPrompt, options = {}) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const maxRetries = 2;
  let lastError = null;

  for (const baseUrl of GEMINI_ENDPOINTS) {
    const url = baseUrl + '?key=' + encodeURIComponent(apiKey);
    const modelName = baseUrl.match(/models\/([^:]+)/)?.[1] || 'unknown';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
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
          const body = await response.text().catch(() => '(empty)');
          console.error(`[Gemini] 429 on ${modelName}, body:`, body.substring(0, 500));

          const isQuota = /quota/i.test(body);
          if (isQuota || attempt === maxRetries) {
            if (isQuota) {
              console.error(`[Gemini] QUOTA EXCEEDED on ${modelName}`);
            }
            lastError = new Error(isQuota ? 'DAILY_QUOTA_EXCEEDED' : 'RATE_LIMIT_EXCEEDED');
            break;
          }
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[Gemini] 429 retry ${attempt + 1}/${maxRetries} on ${modelName} in ${Math.round(delay)}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`[Gemini] HTTP ${response.status} on ${modelName}:`, errBody.substring(0, 500));
          const err = new Error(`Gemini HTTP ${response.status}: ${errBody}`);
          if (response.status === 404 || response.status === 400) {
            lastError = err;
            break;
          }
          throw err;
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
        if (attempt === maxRetries) {
          lastError = err;
          break;
        }
        const msg = err && err.message ? err.message : '';
        if (msg.startsWith('Gemini HTTP') && !msg.includes('429')) {
          lastError = err;
          break;
        }
      }
    }

    if (lastError && lastError.message) {
      const m = lastError.message;
      const isEndpointError = m.includes('404') || m.includes('400') || m.includes('429') || m === 'DAILY_QUOTA_EXCEEDED' || m === 'RATE_LIMIT_EXCEEDED';
      if (!isEndpointError) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Could not reach the tutor right now.');
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
    const errMsg = error && error.message ? error.message : '';
    console.error('[Gemini Error]', errMsg || '(no message)');

    if (errMsg === 'DAILY_QUOTA_EXCEEDED') {
      return res.status(429).json({
        error: 'quota_exceeded',
        message: 'Our AI tutor has reached its daily limit. The quota resets at midnight. You can also enable billing at https://console.cloud.google.com to remove this cap.'
      });
    }

    if (errMsg === 'RATE_LIMIT_EXCEEDED' || errMsg.includes('RATE_LIMIT') || errMsg.includes('429')) {
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
  const keyPreview = GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 8) + '...' : 'MISSING';
  const results = [];

  for (const baseUrl of GEMINI_ENDPOINTS) {
    const modelName = baseUrl.match(/models\/([^:]+)/)?.[1] || 'unknown';
    try {
      const url = baseUrl + '?key=' + encodeURIComponent(GEMINI_API_KEY || '');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });
      const body = await response.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
      results.push({ model: modelName, url: baseUrl, status: response.status, ok: response.ok, body: typeof parsed === 'string' ? parsed.substring(0, 300) : parsed });
      if (response.ok) break;
    } catch (err) {
      results.push({ model: modelName, url: baseUrl, status: 'error', ok: false, body: err.message });
    }
  }

  res.json({ keyPrefix: keyPreview, results });
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
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`[Gemini] Trying ${GEMINI_ENDPOINTS.length} endpoint combinations`);
});
