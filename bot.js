require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const express = require("express");
const { Pool } = require("pg");

// 🤖 TELEGRAM BOT
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

// 🧠 OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🌐 SERVER PARA RENDER
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Jarvis activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});

// 🗄️ BASE DE DATOS
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
    "INSERT INTO messages (chat_id, role, content) VALUES ($1,$2,$3)",
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

// 🧠 GUARDAR DATOS IMPORTANTES
async function saveNote(chatId, key, value) {
  await pool.query(
    "INSERT INTO memory (chat_id, key, value) VALUES ($1,$2,$3)",
    [chatId, key, value]
  );
}

// 🧠 OBTENER DATOS IMPORTANTES
async function getNotes(chatId) {
  const res = await pool.query(
    "SELECT key, value FROM memory WHERE chat_id=$1",
    [chatId]
  );
  return res.rows;
}

// 🧠 DETECTAR MODELO
function detectModel(text) {
  const t = text.toLowerCase();

  if (t.includes("arquitectura")) return "gpt-5-mini";

  if (
    t.includes("error") ||
    t.includes("bug") ||
    t.includes("react") ||
    t.includes("node")
  ) {
    return "gpt-4o-mini";
  }

  return "gpt-5-nano";
}

// 🧠 DETECTAR INFO IMPORTANTE
function detectImportant(text) {
  const t = text.toLowerCase();

  if (t.includes("mi proyecto")) return "proyecto";
  if (t.includes("trabajo en")) return "stack";
  if (t.includes("uso")) return "tecnologia";

  return null;
}

// 🔥 COLA PARA EVITAR BLOQUEOS
const processing = new Set();

// 💬 MENSAJES
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  // evitar mensajes simultáneos
  if (processing.has(chatId)) {
    console.log("⏳ Esperando turno...");
    return;
  }

  processing.add(chatId);

  bot.sendChatAction(chatId, "typing");

  try {
    await saveMessage(chatId, "user", text);

    // guardar info importante
    const key = detectImportant(text);
    if (key) {
      await saveNote(chatId, key, text);
    }

    const memory = await getMemory(chatId);
    const notes = await getNotes(chatId);

    const contextNotes = notes.map(n => `${n.key}: ${n.value}`).join("\n");

    const lower = text.toLowerCase();

    const isPrompt =
      lower.includes("prompt") ||
      lower.includes("hazme un prompt");

    // 🧠 PERSONALIDAD JARVIS
    const systemMessage = {
      role: "system",
      content: isPrompt
        ? `
Eres Jarvis, experto en prompts.

Convierte lo que diga el usuario en un prompt perfecto.

Contexto del usuario:
${contextNotes}

Entrega SOLO el prompt, claro, natural y potente.
`
        : `
Eres Jarvis, asistente personal inteligente.

Hablas como humano (no robot).
Eres cercano, pero también experto en programación.

Contexto del usuario:
${contextNotes}

Reglas:
- si es casual → responde como amigo
- si es código → responde como dev senior
- sé claro y útil
`,
    };

    const model = detectModel(text);

    let replied = false;

    // ⏱️ timeout seguridad
    const timeout = setTimeout(() => {
      if (!replied) {
        bot.sendMessage(chatId, "⚠️ Tardé mucho, intenta otra vez");
        replied = true;
      }
    }, 10000);

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

    clearTimeout(timeout);

    if (!reply) {
      reply = "😅 No pude responder bien, intenta otra vez";
    }

    if (!replied) {
      await saveMessage(chatId, "assistant", reply);
      bot.sendMessage(chatId, reply);
      replied = true;
    }

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "Error 😢");
  } finally {
    processing.delete(chatId);
  }
});