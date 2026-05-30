const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 8000);
const USE_MOCKS = !GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded. Please wait a minute before retrying.',
  },
});

app.use(apiLimiter);

function safeResponse(res, payload) {
  return res.status(200).json(payload);
}

function createMockSimplification(text) {
  const shortText = text.trim().slice(0, 320);
  return `Simplified text preview: ${shortText}.`;
}

function createMockDefinition(word) {
  return `${word}: A simpler explanation of this term for easier reading.`;
}

async function proxyGeminiRequest(prompt) {
  if (USE_MOCKS) {
    return { mocked: true, result: prompt }; 
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.gemini.example/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}`);
    }

    const json = await response.json();
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

app.post('/simplify', async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Missing text field in request body.' });
  }

  if (USE_MOCKS) {
    return safeResponse(res, {
      mode: 'mock',
      simplified: createMockSimplification(text),
      note: 'No Gemini API key configured yet. This endpoint is running in mock mode.',
    });
  }

  try {
    const prompt = `Please simplify the following text for easier reading while preserving meaning:\n\n${text}`;
    const output = await proxyGeminiRequest(prompt);
    return safeResponse(res, { mode: 'gemini', result: output });
  } catch (error) {
    console.error('[Proxy] /simplify failed:', error);
    return res.status(502).json({ error: 'Simplification service error.' });
  }
});

app.post('/define', async (req, res) => {
  const word = String(req.body.word || '').trim();
  if (!word) {
    return res.status(400).json({ error: 'Missing word field in request body.' });
  }

  if (USE_MOCKS) {
    return safeResponse(res, {
      mode: 'mock',
      definition: createMockDefinition(word),
      note: 'No Gemini API key configured yet. This endpoint is running in mock mode.',
    });
  }

  try {
    const prompt = `Provide a short plain-English definition for the word: ${word}`;
    const output = await proxyGeminiRequest(prompt);
    return safeResponse(res, { mode: 'gemini', result: output });
  } catch (error) {
    console.error('[Proxy] /define failed:', error);
    return res.status(502).json({ error: 'Definition service error.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', geminiConfigured: !USE_MOCKS }));

app.listen(PORT, () => {
  console.log(`Reading assistant proxy listening on http://localhost:${PORT}`);
  console.log(`Gemini API key configured: ${!USE_MOCKS}`);
  console.log(`Request timeout set to ${REQUEST_TIMEOUT_MS}ms`);
});
