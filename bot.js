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

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: text }],
    });

    bot.sendMessage(
      chatId,
      completion.choices[0]?.message?.content || "Sin respuesta"
    );
  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Error 😢");
  }
});