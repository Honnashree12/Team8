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
const requestBuckets = new Map();

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
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
  res.json({ ok: true });
});

app.post("/simplify", async (req, res, next) => {
  try {
    const text = normalizeText(req.body?.text);
    const result = await callGemini([
      "Rewrite the text in dyslexia-friendly plain language.",
      "Keep the original meaning, use shorter sentences, and return only the rewritten text.",
      "",
      text
    ].join("\n"));

    res.json({ result });
  } catch (error) {
    next(error);
  }
});

app.post("/define", async (req, res, next) => {
  try {
    const term = normalizeText(req.body?.term || req.body?.text, 200);
    const context = req.body?.context ? normalizeText(req.body.context, 1200) : "";
    const result = await callGemini([
      "Define the term for a dyslexic reader.",
      "Use simple words, one short example, and return only the definition.",
      context ? `Context: ${context}` : "",
      `Term: ${term}`
    ].filter(Boolean).join("\n"));

    res.json({ result });
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

app.listen(port, () => {
  console.log(`DysAssist Gemini proxy listening on http://127.0.0.1:${port}`);
});

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
