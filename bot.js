require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");
const fs = require("fs");

// 🤖 BOT
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

// 🧠 OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🌐 SERVER (Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});

// 📁 MEMORIA
const MEMORY_FILE = "memory.json";

// cargar memoria
function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) return {};
  return JSON.parse(fs.readFileSync(MEMORY_FILE));
}

// guardar memoria
function saveMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// 💬 MENSAJES
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  try {
    let memory = loadMemory();

    if (!memory[chatId]) {
      memory[chatId] = [];
    }

    // guardar mensaje usuario
    memory[chatId].push({ role: "user", content: text });

    // limitar memoria (últimos 10 mensajes)
    memory[chatId] = memory[chatId].slice(-10);

    // 🔥 detectar si quiere prompt
    const isPrompt = text.toLowerCase().includes("prompt");

    const systemMessage = isPrompt
      ? {
          role: "system",
          content: `
Eres un experto en prompts para programación.

Convierte el problema en un prompt perfecto que incluya:
- contexto
- solución
- código
- explicación
          `,
        }
      : {
          role: "system",
          content: "Responde claro, útil y como experto.",
        };

    // 🧠 elegir modelo inteligente
    const isComplex =
      text.includes("error") ||
      text.includes("bug") ||
      text.includes("no funciona");

    const model = isComplex ? "gpt-4o-mini" : "gpt-5-nano";

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [systemMessage, ...memory[chatId]],
    });

    const reply =
      completion.choices[0]?.message?.content || "Sin respuesta";

    // guardar respuesta
    memory[chatId].push({ role: "assistant", content: reply });

    saveMemory(memory);

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Error 😢");
  }
});