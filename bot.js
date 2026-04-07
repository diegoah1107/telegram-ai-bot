require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// 💰 CONTROL DE COSTO
let totalTokens = 0;
const MAX_TOKENS = 200000; // aprox $7 USD

// 🔥 BOT
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // 🚨 límite alcanzado
  if (totalTokens > MAX_TOKENS) {
    bot.sendMessage(chatId, "⚠️ Límite mensual alcanzado (~$7 USD)");
    return;
  }

  let prompt = "";

  // 🔥 DETECTAR GITHUB
  if (text.includes("github.com")) {
    prompt = `
Actúa como ingeniero senior.

Analiza este repositorio: ${text}

Dame:
- Qué hace
- Errores
- Mejoras
- Código ejemplo

Responde directo sin relleno.
`;
  }
  else if (text.startsWith("/fix")) {
    prompt = "Corrige este código y explica corto:\n" + text.replace("/fix", "");
  } 
  else if (text.startsWith("/explain")) {
    prompt = "Explica este código fácil y corto:\n" + text.replace("/explain", "");
  } 
  else if (text.startsWith("/optimize")) {
    prompt = "Optimiza este código:\n" + text.replace("/optimize", "");
  } 
  else {
    prompt = "Responde como programador experto:\n" + text;
  }

  // ⚡ MODELO HÍBRIDO
  let model = "gpt-5-nano";

  if (text.includes("github.com") || text.startsWith("/fix")) {
    model = "gpt-5-mini";
  }

  try {
    const response = await openai.responses.create({
      model: model,
      input: prompt,
      max_output_tokens: 600,
    });

    // 💰 sumar tokens
    if (response.usage) {
      totalTokens += response.usage.total_tokens;
    }

    const reply = response.output_text || "No pude generar respuesta 😢";

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "Error 😢 revisa logs");
  }
});

// 🌐 SERVIDOR (Render)
app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor web corriendo en puerto " + PORT);
});