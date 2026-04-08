require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");
const { Pool } = require("pg");

// 🤖 BOT
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

// 🧠 OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🌐 SERVER (Render fix)
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});

// 🗄️ DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// crear tabla
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id TEXT,
      role TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDB();

// guardar mensaje
async function saveMessage(chatId, role, content) {
  await pool.query(
    "INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)",
    [chatId, role, content]
  );
}

// obtener memoria
async function getMemory(chatId) {
  const res = await pool.query(
    "SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 12",
    [chatId]
  );
  return res.rows.reverse();
}

// 🧠 DETECTOR INTELIGENTE
function detectModel(text) {
  const t = text.toLowerCase();

  const isError =
    t.includes("error") ||
    t.includes("bug") ||
    t.includes("no funciona") ||
    t.includes("fix") ||
    t.includes("arreglar");

  const isCode =
    t.includes("react") ||
    t.includes("node") ||
    t.includes("javascript") ||
    t.includes("api") ||
    t.includes("backend") ||
    t.includes("frontend");

  const isAdvanced =
    t.includes("arquitectura") ||
    t.includes("escalable") ||
    t.includes("sistema completo");

  if (isAdvanced) return "gpt-5-mini";
  if (isError || isCode) return "gpt-4o-mini";

  return "gpt-5-nano";
}

// 💬 MENSAJES
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  try {
    // guardar usuario
    await saveMessage(chatId, "user", text);

    // memoria
    const memory = await getMemory(chatId);

    // detectar prompt
    const isPrompt =
      text.toLowerCase().includes("prompt") ||
      text.toLowerCase().includes("hazme");

    // sistema
    const systemMessage = isPrompt
      ? {
          role: "system",
          content: `
Eres un experto en prompts para programación.

Convierte cualquier problema en un prompt perfecto para IA que incluya:
- contexto claro
- problema detallado
- solución esperada
- código si aplica
- instrucciones precisas

Entrega SOLO el prompt listo para copiar.
          `,
        }
      : {
          role: "system",
          content: `
Eres un ingeniero senior experto en:
- React
- Node.js
- APIs
- debugging

Responde claro, directo, útil y sin relleno.
Si es código:
- da solución completa
- explica breve
          `,
        };

    // modelo inteligente
    const model = detectModel(text);

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [systemMessage, ...memory],
    });

    const reply =
      completion.choices[0]?.message?.content || "Sin respuesta";

    // guardar respuesta
    await saveMessage(chatId, "assistant", reply);

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("❌ ERROR:", err);
    bot.sendMessage(chatId, "Error 😢");
  }
});