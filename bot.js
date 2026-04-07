require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 BOT TELEGRAM
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  let prompt = "";

  if (text.startsWith("/fix")) {
    prompt = "Corrige este código y explica el error:\n" + text.replace("/fix", "");
  } 
  else if (text.startsWith("/explain")) {
    prompt = "Explica este código de forma sencilla:\n" + text.replace("/explain", "");
  } 
  else if (text.startsWith("/optimize")) {
    prompt = "Optimiza este código:\n" + text.replace("/optimize", "");
  } 
  else {
    prompt = text;
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const reply = response.output[0].content[0].text;

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Error 😢");
  }
});

// 🌐 SERVIDOR PARA RENDER
app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor web corriendo en puerto " + PORT);
});