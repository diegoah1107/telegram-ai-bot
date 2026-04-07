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

// 🔥 LEER ARCHIVOS DE GITHUB (ARREGLADO)
async function getGitHubFile(url) {
  try {
    let rawUrl = url;

    if (url.includes("github.com")) {
      rawUrl = url
        .replace("github.com", "raw.githubusercontent.com")
        .replace("/blob/", "/");
    }

    console.log("RAW URL:", rawUrl);

    const res = await fetch(rawUrl);

    if (!res.ok) {
      console.log("GitHub error:", res.status);
      return null;
    }

    const text = await res.text();

    // 🔥 LIMITAR TAMAÑO (IMPORTANTE)
    return text.substring(0, 4000);

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

    // 🔧 EDIT (GITHUB)
    if (text.startsWith("/edit")) {
      const match = text.match(/https?:\/\/[^\s]+/);
      const url = match ? match[0].trim() : null;

      let code = null;

      if (url) {
        code = await getGitHubFile(url);
      }

      if (!code) {
        bot.sendMessage(chatId, "❌ No pude leer el archivo. Verifica que el link sea correcto y público.");
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

    // 🌐 ANALIZAR GITHUB
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

    // ⚡ NORMAL
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

    const reply = response.output_text || "Error 😢";

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