const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
require('dotenv').config({ path: './.env' });
console.log("API KEY:", process.env.OPENAI_API_KEY);
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: text,
    });

    bot.sendMessage(chatId, response.output[0].content[0].text);

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Error 😢");
  }
});