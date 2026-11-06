# CourierFlow

Telegram-first courier operations mini app.

## Stack

- React + TypeScript + Vite
- Telegram Mini Apps WebApp bridge
- Supabase Auth, PostgreSQL, RLS and Realtime
- Supabase Edge Function for server-side Telegram `initData` verification
- GitHub Actions build and GitHub Pages deployment

## Working MVP

- Email/password account creation and sign-in
- Telegram Mini App authentication through the `telegram-auth` Edge Function (requires `TELEGRAM_BOT_TOKEN` secret)
- Real orders stored in `public.delivery_orders`
- Dispatcher/admin can assign active couriers to new orders
- Couriers can claim available orders and advance their own delivery through picked up → in transit → delivered
- Role-aware order visibility and database-side restrictions
- Realtime refresh for order and shift changes
- Delivery totals and basic courier earnings calculation

## One-time setup

### 1. Enable GitHub Pages

Open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.

The workflow builds the site and deploys it to:

`https://vadimaok.github.io/courierflow/`

### 2. Configure Telegram registration and phone binding

1. Create a bot with [@BotFather](https://t.me/BotFather), then create/enable its Mini App and set its URL to `https://vadimaok.github.io/courierflow/`.
2. In Supabase open **Project → Edge Functions → Secrets** and add:
   - `TELEGRAM_BOT_TOKEN` — the token from BotFather.
   - `TELEGRAM_WEBHOOK_SECRET` — a random secret of 32+ characters (letters, numbers, underscore or hyphen).
   - `COURIERFLOW_APP_URL` — `https://vadimaok.github.io/courierflow/` (optional; this is the default).
3. Configure the bot webhook after adding the secrets. Replace the placeholders and run:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://rimdwjsnvxcggmrauisv.supabase.co/functions/v1/telegram-webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

4. Open the bot in Telegram and press `/start`. The bot provides a contact-sharing button and a CourierFlow launch button. In the Mini App, press **Поделиться номером телефона**, confirm Telegram's native prompt, then press **Продолжить**.
5. Phone numbers are stored server-side and are not readable through the public Data API. The app validates Telegram `initData` on the server; never put the bot token or a Supabase secret/service-role key in browser code or GitHub source files.

If registration says `Failed to fetch`, verify that the app URL is open and that your network can reach `https://rimdwjsnvxcggmrauisv.supabase.co`. The app now displays the server's actual Telegram-auth error instead of silently treating it as a successful signup.

### 3. Create the first administrator

Register and sign in to the app once. Then run one of the following in Supabase SQL Editor.

For an email account:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and u.email = 'YOUR_EMAIL';
```

For a Telegram account (replace the numeric ID with your Telegram user ID):

```sql
update public.profiles p
set role = 'admin'
from public.telegram_accounts t
where p.id = t.user_id
  and t.telegram_id = 123456789;
```

Assign staff roles in the same way, using `dispatcher` or `courier`. Only an administrator should do this.

## Supabase schema

The deployable schema is in `supabase/schema.sql`. The hosted CourierFlow Supabase project already has the migrations applied.

## Current MVP limitations

Live GPS/map provider integration, courier shift creation/management, customer directory, ratings, payout processing, and push notifications are not yet complete. The map screen is intentionally marked as a setup step rather than showing fake courier locations.
