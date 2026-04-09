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

// 🌐 SERVER
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Jarvis activo 🚀"));
app.listen(PORT, () => console.log("Servidor corriendo"));

// 🗄️ DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// INIT
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

// SAVE
async function saveMessage(chatId, role, content) {
  await pool.query(
    "INSERT INTO messages (chat_id, role, content) VALUES ($1,$2,$3)",
    [chatId, role, content]
  );
}

async function getMemory(chatId) {
  const res = await pool.query(
    "SELECT role, content FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 12",
    [chatId]
  );
  return res.rows.reverse();
}

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

// 🧠 DETECTORES
function detectModel(text) {
  const t = text.toLowerCase();

  if (t.includes("arquitectura")) return "gpt-5-mini";
  if (t.includes("error") || t.includes("bug") || t.includes("react"))
    return "gpt-4o-mini";

  return "gpt-5-nano";
}

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

  // 👇 RESPUESTA INMEDIATA (CLAVE)
  bot.sendChatAction(chatId, "typing");

  try {
    await saveMessage(chatId, "user", text);

    // guardar info importante
    const key = detectImportant(text);
    if (key) await saveNote(chatId, key, text);

    const memory = await getMemory(chatId);
    const notes = await getNotes(chatId);

    const contextNotes = notes.map(n => `${n.key}: ${n.value}`).join("\n");

    const lower = text.toLowerCase();

    const isPrompt =
      lower.includes("prompt") ||
      lower.includes("hazme un prompt");

    // 🧠 PERSONALIDAD HUMANA + PRO
    const systemMessage = {
      role: "system",
      content: isPrompt
        ? `
Eres Jarvis.

Convierte lo que diga el usuario en un prompt perfecto.

Contexto:
${contextNotes}

Hazlo claro, natural y potente.
Entrega solo el prompt.
`
        : `
Eres Jarvis, un asistente personal inteligente y cercano.

Tu estilo:
- hablas como amigo (natural, relajado)
- pero cuando toca, eres experto en programación
- entiendes contexto del usuario
- no eres robot

Contexto del usuario:
${contextNotes}

Reglas:
- si es casual → responde como amigo
- si es código → responde como dev senior
- sé claro, útil y directo
- no des respuestas genéricas
`,
    };

    const model = detectModel(text);

    // 🔁 REINTENTO AUTOMÁTICO
    async function getAIResponse() {
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [systemMessage, ...memory],
        });

        return completion?.choices?.[0]?.message?.content?.trim();
      } catch (err) {
        console.log("OpenAI error:", err.message);
        return null;
      }
    }

    let reply = await getAIResponse();

    // 🔁 retry si falla
    if (!reply) {
      console.log("Reintentando...");
      reply = await getAIResponse();
    }

    if (!reply) {
      reply = "😅 Se me fue la onda un segundo, intenta otra vez";
    }

    await saveMessage(chatId, "assistant", reply);

    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "Error 😢");
  }
});