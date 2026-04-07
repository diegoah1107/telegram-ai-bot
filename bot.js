require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");
const fetch = require("node-fetch");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// 💰 CONTROL DE COSTO
let totalTokens = 0;
const MAX_TOKENS = 200000;

// 🔥 LEER ARCHIVOS DE GITHUB
async function getGitHubFile(url) {
  try {
    const rawUrl = url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");

    const res = await fetch(rawUrl);
    return await res.text();
  } catch (err) {
    return null;
  }
}

// 🤖 BOT
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // 🚨 límite
  if (totalTokens > MAX_TOKENS) {
    bot.sendMessage(chatId, "⚠️ Límite mensual alcanzado (~$7 USD)");
    return;
  }

  let prompt = "";

  // 🔥 GITHUB
  if (text.includes("github.com")) {
    let code = "";

    if (text.includes("/blob/")) {
      code = await getGitHubFile(text);
    }

    prompt = `
Actúa como ingeniero senior.

${code ? "Analiza este código:\n" + code : "Analiza este repositorio: " + text}

Dame:
- errores
- mejoras
- código corregido

Responde directo.
`;
  }

  // 🔧 FIX (MEJORADO CON DIFF)
  else if (text.startsWith("/fix")) {
    prompt = `
Corrige este código.

Devuelve:
1. Código corregido
2. Explicación corta
3. Cambios en formato diff

Código:
${text.replace("/fix", "")}
`;
  }

  // 📘 EXPLICAR
  else if (text.startsWith("/explain")) {
    prompt = "Explica este código de forma simple:\n" + text.replace("/explain", "");
  }

  // ⚡ NORMAL
  else {
    prompt = "Responde como programador experto:\n" + text;
  }

  // ⚡ MODELO INTELIGENTE
  let model = "gpt-5-nano";
  let maxTokens = 300;

  if (text.includes("github.com") || text.startsWith("/fix")) {
    model = "gpt-5-mini";
    maxTokens = 600;
  }

  try {
    const response = await openai.responses.create({
      model: model,
      input: prompt,
      max_output_tokens: maxTokens,
    });

    if (response.usage) {
      totalTokens += response.usage.total_tokens;
    }

    const reply = response.output_text || "Error 😢";

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "Error 😢 revisa logs");
  }
});

// 🌐 SERVIDOR
app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});