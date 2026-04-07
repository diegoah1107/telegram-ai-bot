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

// 🔥 LEER ARCHIVOS DE GITHUB (MEJORADO)
async function getGitHubFile(url) {
  try {
    if (!url.includes("/blob/")) return null;

    const rawUrl = url
      .replace("https://github.com/", "https://raw.githubusercontent.com/")
      .replace("/blob/", "/");

    const res = await fetch(rawUrl);

    if (!res.ok) {
      console.log("Error al obtener archivo:", res.status);
      return null;
    }

    const text = await res.text();
    return text;
  } catch (err) {
    console.log("Error fetch:", err);
    return null;
  }
}

// 🤖 BOT
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (totalTokens > MAX_TOKENS) {
    bot.sendMessage(chatId, "⚠️ Límite mensual alcanzado (~$7 USD)");
    return;
  }

  let prompt = "";

  // 🔧 EDIT
  if (text.startsWith("/edit")) {
    let code = "";
    const match = text.match(/https?:\/\/[^\s]+/);

    if (match && match[0].includes("github.com")) {
      code = await getGitHubFile(match[0]);
    }

    prompt = `
Eres un ingeniero senior.

Modifica este código según la instrucción.

Devuelve:
1. Código nuevo completo
2. Cambios en formato diff
3. Explicación corta

${code ? "Código:\n" + code : "No se pudo leer el archivo"}

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

  // 🌐 GITHUB NORMAL
  else if (text.includes("github.com")) {
    let code = "";
    const match = text.match(/https?:\/\/[^\s]+/);

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

  let model = "gpt-5-nano";
  let maxTokens = 300;

  if (text.startsWith("/edit") || text.startsWith("/fix") || text.includes("github.com")) {
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
    console.log(err);
    bot.sendMessage(chatId, "Error 😢");
  }
});

// 🌐 SERVIDOR
app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});