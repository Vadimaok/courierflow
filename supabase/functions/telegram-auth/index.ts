import { createClient } from "npm:@supabase/supabase-js@2"
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")
async function sign(keyBytes: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name:"HMAC", hash:"SHA-256" }, false, ["sign"])
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)))
}
async function verify(initData: string, token: string) {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) throw new Error("Telegram signature is missing")
  params.delete("hash"); params.delete("signature")
  const check = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n")
  const secret = await sign(new TextEncoder().encode("WebAppData"), token)
  const expected = hex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]), new TextEncoder().encode(check)))
  if (expected.length !== hash.length) throw new Error("Invalid Telegram signature")
  let diff=0; for(let i=0;i<expected.length;i++) diff |= expected.charCodeAt(i)^hash.charCodeAt(i)
  if(diff) throw new Error("Invalid Telegram signature")
  const authDate=Number(params.get("auth_date")||0)
  if(!authDate || Date.now()/1000-authDate>86400 || authDate>Date.now()/1000+60) throw new Error("Telegram authorization expired")
  const raw=params.get("user"); if(!raw) throw new Error("Telegram user missing")
  const user=JSON.parse(raw); if(!Number.isSafeInteger(Number(user.id))) throw new Error("Invalid Telegram user id")
  return user
}
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors})
  if(req.method!=="POST") return json({error:"Method not allowed"},405)
  try {
    const {initData}=await req.json()
    if(typeof initData!=="string" || !initData) return json({error:"initData is required"},400)
    const botToken=Deno.env.get("TELEGRAM_BOT_TOKEN")
    if(!botToken) return json({error:"Add TELEGRAM_BOT_TOKEN to Supabase Edge Function secrets."},503)
    const url=Deno.env.get("SUPABASE_URL")
    const secretKeys=Deno.env.get("SUPABASE_SECRET_KEYS")
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || (secretKeys ? JSON.parse(secretKeys).default : undefined)
    if(!url || !serviceKey) return json({error:"Supabase server credentials are missing"},500)
    const tg=await verify(initData,botToken)
    const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})
    const {data:existing,error:lookupError}=await admin.from("telegram_accounts").select("user_id").eq("telegram_id",tg.id).maybeSingle()
    if(lookupError) throw lookupError
    let userId=existing?.user_id as string|undefined
    const fullName=[tg.first_name,tg.last_name].filter(Boolean).join(" ") || tg.username || "Telegram user"
    const email=`telegram_${tg.id}@telegram.courierflow.invalid`
    if(!userId) {
      const random=crypto.getRandomValues(new Uint8Array(32))
      const password=hex(random.buffer)+"aA1!"
      const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,telegram_id:tg.id,telegram_username:tg.username||null}})
      if(createError) throw createError
      userId=created.user.id
      const {error:insertError}=await admin.from("telegram_accounts").insert({telegram_id:tg.id,user_id:userId})
      if(insertError) throw insertError
    }
    const {error:updateError}=await admin.auth.admin.updateUserById(userId,{user_metadata:{full_name:fullName,telegram_id:tg.id,telegram_username:tg.username||null}})
    if(updateError) throw updateError
    const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email})
    if(linkError) throw linkError
    const tokenHash=link.properties?.hashed_token
    if(!tokenHash) throw new Error("Supabase did not return a one-time token")
    return json({token_hash:tokenHash})
  } catch(error) {
    console.error("telegram-auth:",error)
    return json({error:error instanceof Error?error.message:"Authentication failed"},400)
  }
})
