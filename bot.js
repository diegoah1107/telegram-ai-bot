require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");
const fs = require("fs");
const path = require("path");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// 📂 FUNCIÓN PARA BUSCAR ARCHIVO
function findFile(fileName, dir = ".") {
  const files = fs.readdirSync(dir);

  for (let file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const result = findFile(fileName, fullPath);
      if (result) return result;
    } else if (file === fileName) {
      return fullPath;
    }
  }

  return null;
}

// 🤖 BOT
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  try {
    // 🔧 EDIT INTELIGENTE
    if (text.startsWith("/edit")) {

      const match = text.match(/archivo:\s*(\S+)/i);
      const fileName = match ? match[1] : null;

      if (!fileName) {
        bot.sendMessage(chatId, "❌ Escribe así: /edit archivo: App.js tu cambio");
        return;
      }

      const filePath = findFile(fileName, "./frontend");

      if (!filePath) {
        bot.sendMessage(chatId, "❌ No encontré ese archivo en el proyecto");
        return;
      }

      const code = fs.readFileSync(filePath, "utf-8");

      const instruction = text.replace(/\/edit/i, "");

      const prompt = `
Eres un ingeniero senior experto.

Tienes este archivo:

${code}

El usuario quiere esto:
${instruction}

Devuelve:
1. Código completo corregido
2. Explicación corta
`;

      const response = await openai.responses.create({
        model: "gpt-5-mini",
        input: prompt,
        max_output_tokens: 800,
      });

      const reply = response.output_text || "Error 😢";

      bot.sendMessage(chatId, reply);
    }

    // NORMAL
    else {
      const response = await openai.responses.create({
        model: "gpt-5-nano",
        input: text,
      });

      bot.sendMessage(chatId, response.output_text);
    }

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