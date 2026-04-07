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
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
    });

    bot.sendMessage(chatId, completion.choices[0].message.content);

  } catch (err) {
    console.log(err);
    bot.sendMessage(chatId, "Error 😢");
  }
});});
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor web corriendo en puerto " + PORT);
});