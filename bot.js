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

// 🌐 SERVER (Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Jarvis activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});

// 🗄️ DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🔥 CREAR TABLAS
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memory (
      id SERIAL PRIMARY KEY,
      chat_id TEXT,
      key TEXT,
      value TEXT
    );
  `);
}
initDB();

// 💾 GUARDAR MENSAJES
async function saveMessage(chatId, role, content) {
  await pool.query(
    "INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)",
    [chatId, role, content]
  );
}

// 📜 OBTENER HISTORIAL
async function getMemory(chatId) {
  const res = await pool.query(
    "SELECT role, content FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 12",
    [chatId]
  );
  return res.rows.reverse();
}

// 🧠 MEMORIA INTELIGENTE (tipo notas)
async function saveNote(chatId, key, value) {
  await pool.query(
    "INSERT INTO memory (chat_id, key, value) VALUES ($1,$2,$3)",
    [chatId, key, value]
  );
}

async function getNotes(chatId) {
  const res = await pool.query(
    "SELECT key, value FROM memory WHERE chat_id=$1",
    [chatId]
  );
  return res.rows;
}

// 🧠 DETECTOR MODELO
function detectModel(text) {
  const t = text.toLowerCase();

  if (
    t.includes("arquitectura") ||
    t.includes("sistema completo")
  ) return "gpt-5-mini";

  if (
    t.includes("error") ||
    t.includes("bug") ||
    t.includes("react") ||
    t.includes("node")
  ) return "gpt-4o-mini";

  return "gpt-5-nano";
}

// 🧠 DETECTOR MEMORIA IMPORTANTE
function detectImportant(text) {
  const t = text.toLowerCase();

  if (t.includes("mi proyecto")) return "proyecto";
  if (t.includes("trabajo en")) return "stack";
  if (t.includes("uso")) return "tecnologia";

  return null;
}

// 💬 MENSAJES
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  bot.sendChatAction(chatId, "typing");

  try {
    await saveMessage(chatId, "user", text);

    // 🧠 GUARDAR INFO IMPORTANTE
    const key = detectImportant(text);
    if (key) {
      await saveNote(chatId, key, text);
    }

    const memory = await getMemory(chatId);
    const notes = await getNotes(chatId);

    // 🧠 CONSTRUIR CONTEXTO
    const contextNotes = notes.map(n => `${n.key}: ${n.value}`).join("\n");

    const lower = text.toLowerCase();

    const isPrompt =
      lower.includes("prompt") ||
      lower.includes("hazme un prompt") ||
      lower.includes("genera un prompt");

    // 🤖 JARVIS PERSONALIDAD
    const systemMessage = {
      role: "system",
      content: isPrompt
        ? `
Eres Jarvis, experto en prompts avanzados.

Convierte el problema en un prompt perfecto.

Contexto del usuario:
${contextNotes}

Entrega un prompt listo para copiar.
Natural, claro, poderoso.
`
        : `
Eres Jarvis, asistente personal inteligente.

Hablas como humano, no robot.
Eres claro, directo y útil.

Conoces al usuario:
${contextNotes}

Reglas:
- sé natural
- responde como experto real
- si es código: solución completa
- explica breve
- guía paso a paso si hace falta
`,
    };

    const model = detectModel(text);

    let reply = "";

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [systemMessage, ...memory],
      });

      reply =
        completion?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.log("OpenAI error:", err.message);
    }

    if (!reply) {
      reply = "⚠️ No pude responder bien, intenta reformular.";
    }

    await saveMessage(chatId, "assistant", reply);

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "Error 😢");
  }
});