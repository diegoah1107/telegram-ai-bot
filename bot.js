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
      .replace("https://github.com/", "https://raw.githubusercontent.com/")
      .replace("/blob/", "/");

    const res = await fetch(rawUrl);

    if (!res.ok) {
      console.log("GitHub error:", res.status);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.log("Fetch error:", err);
    return null;
  }
}

// 🤖 BOT
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  try {
    if (totalTokens > MAX_TOKENS) {
      bot.sendMessage(chatId, "⚠️ Límite mensual alcanzado");
      return;
    }

    let prompt = "";

    // 🔧 EDIT
    if (text.startsWith("/edit")) {
      const match = text.match(/https?:\/\/[^\s]+/);
      let code = null;

      if (match) {
        code = await getGitHubFile(match[0]);
      }

      if (!code) {
        bot.sendMessage(chatId, "❌ No pude leer el archivo. Verifica el link.");
        return;
      }

      prompt = `
Eres un ingeniero senior.

Modifica este código.

Devuelve:
1. Código nuevo completo
2. Cambios en formato diff
3. Explicación corta

Código:
${code}

Instrucción:
${text.replace("/edit", "")}
`;
    }

    // 🔧 FIX
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

    // 📘 EXPLAIN
    else if (text.startsWith("/explain")) {
      prompt = "Explica este código:\n" + text.replace("/explain", "");
    }

    // 🌐 GITHUB
    else if (text.includes("github.com")) {
      const match = text.match(/https?:\/\/[^\s]+/);
      let code = null;

      if (match && match[0].includes("/blob/")) {
        code = await getGitHubFile(match[0]);
      }

      prompt = `
Analiza este código:

${code || text}

Dame errores y mejoras.
`;
    }

    else {
      prompt = "Responde como programador experto:\n" + text;
    }

    let model = "gpt-5-mini";
    let maxTokens = 600;

    const response = await openai.responses.create({
      model: model,
      input: prompt,
      max_output_tokens: maxTokens,
    });

    const reply = response.output_text || "No hubo respuesta";

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("ERROR REAL:", err);
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