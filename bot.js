require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

// 🤖 BOT
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

// 🧠 OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 💬 MENSAJES
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  try {
    // 🔧 PROMPT MODE
    if (text.startsWith("/prompt")) {
      const problem = text.replace("/prompt", "");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Convierte el problema en un prompt perfecto para programar.",
          },
          {
            role: "user",
            content: problem,
          },
        ],
      });

      return bot.sendMessage(
        chatId,
        completion.choices[0]?.message?.content || "Sin respuesta"
      );
    }

    // 💬 NORMAL
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: text }],
    });

    bot.sendMessage(
      chatId,
      completion.choices[0]?.message?.content || "Sin respuesta"
    );

  } catch (err) {
    console.log("❌ ERROR:", err.message);
    bot.sendMessage(chatId, "Error 😢");
  }
});