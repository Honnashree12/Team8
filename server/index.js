const express = require("express");
const fs = require("fs");
const path = require("path");

loadEnvFile();

const app = express();
const port = Number(process.env.PORT || 8787);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 12000);
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30);
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const useGemini = process.env.USE_GEMINI === "true";
const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const useGroq = process.env.USE_GROQ === "true";
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const requestBuckets = new Map();

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  const allowedOrigin = getAllowedOrigin(origin);

  if (origin && !allowedOrigin) {
    res.status(403).json({ error: "Origin is not allowed." });
    return;
  }

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(rateLimit);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: useGroq ? "groq" : (useGemini ? "gemini" : "mock"),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY)
  });
});

app.post("/simplify", async (req, res, next) => {
  try {
    const text = normalizeText(req.body?.text);
    let result;
    if (useGroq) {
      const system =
        "You are a plain-English writing assistant. " +
        "Rewrite complex text so it is clear and easy to read at a grade 6–8 level. " +
        "Keep all key information. " +
        "Return ONLY the rewritten text — no preamble, no labels, no commentary.";
      result = await callGroq(system, text, 600);
    } else if (useGemini) {
      result = await callGemini([
        "Rewrite the text in dyslexia-friendly plain language.",
        "Keep the original meaning, use shorter sentences, and return only the rewritten text.",
        "",
        text
      ].join("\n"));
    } else {
      result = mockSimplify(text);
    }

    res.json({ result, mocked: !useGemini && !useGroq });
  } catch (error) {
    next(error);
  }
});

app.post("/define", async (req, res, next) => {
  try {
    const term = normalizeText(req.body?.term || req.body?.text, 200);
    const context = req.body?.context ? normalizeText(req.body.context, 1200) : "";

    let result;
    if (useGemini) {
      try {
        result = await callGemini([
          "Define the term for a dyslexic reader.",
          "Use simple words, one short example, and return only the definition.",
          context ? `Context: ${context}` : "",
          `Term: ${term}`
        ].filter(Boolean).join("\n"));
      } catch (error) {
        console.warn("Gemini define failed, falling back to Free Dictionary API:", error.message);
        try {
          result = await fetchFreeDictionary(term);
        } catch (fallbackError) {
          console.warn("Free Dictionary API fallback failed:", fallbackError.message);
          result = mockDefine(term, context);
        }
      }
    } else {
      try {
        result = await fetchFreeDictionary(term);
      } catch (error) {
        console.warn("Free Dictionary API failed, falling back to mock definition:", error.message);
        result = mockDefine(term, context);
      }
    }

    res.json({ result, mocked: !useGemini });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: status === 500 ? "Server error" : error.message
  });
});

function startServer() {
  return app.listen(port, () => {
    console.log(`DysAssist Gemini proxy listening on http://127.0.0.1:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

function normalizeText(value, maxLength = 8000) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error("A non-empty text value is required.");
    error.status = 400;
    throw error;
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseAllowedOrigins(value) {
  if (!value) {
    return {
      exact: new Set(["http://127.0.0.1:8787", "http://localhost:8787"]),
      allowChromeExtensions: true
    };
  }

  const origins = value.split(",").map(origin => origin.trim()).filter(Boolean);
  return {
    exact: new Set(origins.filter(origin => origin !== "chrome-extension://*")),
    allowChromeExtensions: origins.includes("chrome-extension://*")
  };
}

function getAllowedOrigin(origin) {
  if (!origin) return null;
  if (allowedOrigins.exact.has(origin)) return origin;
  if (allowedOrigins.allowChromeExtensions && origin.startsWith("chrome-extension://")) {
    return origin;
  }
  return null;
}

function mockSimplify(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) return text;
  return sentences.slice(0, 3).join(" ");
}

function mockDefine(term, context) {
  const trimmedTerm = term.replace(/[.?!:;]+$/g, "");
  const contextHint = context ? " The meaning can depend on the page context." : "";
  return `${trimmedTerm} means an important word or idea in this text.${contextHint}`;
}

async function fetchFreeDictionary(word) {
  if (!word || word.trim().length < 2) {
    throw new Error("Word too short");
  }

  const clean = word.toLowerCase().replace(/[^a-z'-]/g, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      {
        headers: { "Accept": "application/json" },
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`Free Dictionary API returned status ${response.status}`);
    }

    const data = await response.json();
    const entry = data?.[0];
    if (!entry) {
      throw new Error("No entry found");
    }

    const meaning = entry.meanings?.[0];
    const def = meaning?.definitions?.[0];
    if (!def?.definition) {
      throw new Error("No definition found");
    }

    const pos = meaning.partOfSpeech ? `(${meaning.partOfSpeech}) ` : "";
    const example = def.example ? ` — e.g. "${def.example}"` : "";
    const phonetic = entry.phonetic ? ` ${entry.phonetic}` : "";

    return `${phonetic ? phonetic + "  " : ""}${pos}${def.definition}${example}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(systemPrompt, userContent, maxTokens = 600) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error = new Error("GROQ_API_KEY is not configured.");
    error.status = 500;
    throw error;
  }

  const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Groq request failed.");
      error.status = response.status;
      throw error;
    }

    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) {
      const error = new Error("Groq returned an empty response.");
      error.status = 502;
      throw error;
    }

    return text;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Groq request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "local";
  const now = Date.now();
  const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + rateLimitWindowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + rateLimitWindowMs;
  }

  bucket.count += 1;
  requestBuckets.set(key, bucket);

  res.setHeader("X-RateLimit-Limit", String(rateLimitMaxRequests));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(rateLimitMaxRequests - bucket.count, 0)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > rateLimitMaxRequests) {
    res.status(429).json({ error: "Too many requests. Please try again soon." });
    return;
  }

  next();
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured.");
    error.status = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 512
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Gemini request failed.");
      error.status = response.status;
      throw error;
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!text) {
      const error = new Error("Gemini returned an empty response.");
      error.status = 502;
      throw error;
    }

    return text;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Gemini request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  app,
  getAllowedOrigin,
  mockDefine,
  mockSimplify,
  normalizeText,
  startServer
};
