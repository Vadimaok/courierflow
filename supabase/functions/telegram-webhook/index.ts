import { createClient } from "npm:@supabase/supabase-js@2"
const APP_URL = Deno.env.get("COURIERFLOW_APP_URL") || "https://vadimaok.github.io/courierflow/"
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
async function telegram(method: string, body: Record<string, unknown>) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured")
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API error: ${response.status}`)
  return result
}
Deno.serve(async req => {
  if (req.method !== "POST") return json({ ok: false }, 405)
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")
  const supplied = req.headers.get("x-telegram-bot-api-secret-token")
  if (!expected || !supplied || supplied !== expected) return json({ ok: false, error: "Unauthorized" }, 401)
  try {
    const update = await req.json()
    const message = update.message
    if (!message?.from?.id || !message?.chat?.id) return json({ ok: true })
    const chatId = message.chat.id
    if (message.text === "/start") {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Добро пожаловать в CourierFlow. Подтверди свой номер кнопкой ниже, затем открой приложение.",
        reply_markup: { keyboard: [[{ text: "Поделиться номером телефона", request_contact: true }]], resize_keyboard: true },
      })
      await telegram("sendMessage", {
        chat_id: chatId, text: "Открыть рабочее приложение:",
        reply_markup: { inline_keyboard: [[{ text: "Открыть CourierFlow", web_app: { url: APP_URL } }]] },
      })
      return json({ ok: true })
    }
    const contact = message.contact
    if (contact) {
      if (Number(contact.user_id) !== Number(message.from.id)) {
        await telegram("sendMessage", { chat_id: chatId, text: "Можно привязать только собственный номер. Используй кнопку «Поделиться номером телефона»." })
        return json({ ok: true })
      }
      const rawPhone = String(contact.phone_number || "").replace(/[\s()-]/g, "")
      const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        await telegram("sendMessage", { chat_id: chatId, text: "Не удалось проверить формат номера. Отправь контакт ещё раз." })
        return json({ ok: true })
      }
      const projectUrl = Deno.env.get("SUPABASE_URL")
      const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS")
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || (secretKeys ? JSON.parse(secretKeys).default : undefined)
      if (!projectUrl || !serviceKey) throw new Error("Supabase server credentials are missing")
      const admin = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data: existing, error: lookupError } = await admin.from("telegram_accounts").select("user_id").eq("telegram_id", message.from.id).maybeSingle()
      if (lookupError) throw lookupError
      const { error } = await admin.from("telegram_accounts").upsert({ telegram_id: message.from.id, user_id: existing?.user_id || null, phone_number: phone }, { onConflict: "telegram_id" })
      if (error) {
        if (error.code === "23505") {
          await telegram("sendMessage", { chat_id: chatId, text: "Этот номер уже привязан к другому аккаунту. Обратись к администратору." })
          return json({ ok: true })
        }
        throw error
      }
      if (existing?.user_id) {
        const { error: profileError } = await admin.from("profiles").update({ phone }).eq("id", existing.user_id)
        if (profileError) throw profileError
      }
      await telegram("sendMessage", {
        chat_id: chatId, text: "Номер подтверждён и привязан. Вернись в CourierFlow и нажми «Продолжить».",
        reply_markup: { inline_keyboard: [[{ text: "Открыть CourierFlow", web_app: { url: APP_URL } }]] },
      })
    }
    return json({ ok: true })
  } catch (error) {
    console.error("telegram-webhook:", error)
    return json({ ok: false, error: error instanceof Error ? error.message : "Webhook failed" }, 500)
  }
})
