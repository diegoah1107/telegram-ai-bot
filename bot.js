require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");
const { Pool } = require("pg");

// 🌐 SERVER
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🤖 BOT (SIN POLLING)
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

// 🧠 OPENAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
}
initDB();

// SAVE
async function saveMessage(chatId, role, content) {
  await pool.query(
    "INSERT INTO messages (chat_id, role, content) VALUES ($1,$2,$3)",
    [chatId, role, content]
  );
}

// GET MEMORY
async function getMemory(chatId) {
  const res = await pool.query(
    "SELECT role, content FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 10",
    [chatId]
  );
  return res.rows.reverse();
}

// 🧠 DETECTAR MODELO
function detectModel(text) {
  const t = text.toLowerCase();

  if (t.includes("error") || t.includes("bug")) return "gpt-4o-mini";
  return "gpt-5-nano";
}

// 📩 WEBHOOK
app.post(`/webhook/${process.env.TELEGRAM_TOKEN}`, async (req, res) => {
  const msg = req.body.message;

  if (!msg || !msg.text) {
    return res.sendStatus(200);
  }

  const chatId = msg.chat.id.toString();
  const text = msg.text;

  try {
    await bot.sendChatAction(chatId, "typing");

    await saveMessage(chatId, "user", text);
    const memory = await getMemory(chatId);

    const lower = text.toLowerCase();

    // 🔥 DETECTOR DE PROMPT MEJORADO
    const isPrompt =
      lower.includes("prompt") ||
      lower.includes("hazme un prompt") ||
      lower.includes("crea un prompt") ||
      lower.includes("genera un prompt") ||
      lower.includes("dame un prompt");

    let systemMessage;

    if (isPrompt) {
      systemMessage = {
        role: "system",
        content: `
Eres un experto en crear prompts para IA.

Convierte lo que diga el usuario en un prompt PERFECTO.

Debe incluir:
- contexto claro
- problema detallado
- resultado esperado
- instrucciones precisas

Entrega SOLO el prompt listo para copiar.
`,
      };
    } else {
      systemMessage = {
        role: "system",
        content: `
Eres Jarvis.

Hablas natural como humano y eres experto en programación.

Responde claro, útil y sin rodeos.
`,
      };
    }

    let reply = "";

    try {
      const completion = await openai.chat.completions.create({
        model: detectModel(text),
        messages: [systemMessage, ...memory],
      });

      reply =
        completion?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.log("OpenAI error:", err.message);
    }

    // 🔥 SI VIENE VACÍO (CLAVE)
    if (!reply) {
      if (isPrompt) {
        reply =
          "⚠️ No pude generar el prompt. Intenta describir mejor el problema.";
      } else {
        reply =
          "😅 No pude responder bien, intenta escribirlo diferente.";
      }
    }

    await saveMessage(chatId, "assistant", reply);

    await bot.sendMessage(chatId, reply);

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "Error 😢");
  }

  res.sendStatus(200);
});

// HOME
app.get("/", (req, res) => {
  res.send("Jarvis webhook activo 🚀");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});