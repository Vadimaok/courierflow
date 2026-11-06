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

### 2. Configure Telegram authentication

1. Create a bot with [@BotFather](https://t.me/BotFather).
2. In Supabase open **Project → Edge Functions → Secrets**.
3. Add `TELEGRAM_BOT_TOKEN` with the token from BotFather.
4. In BotFather create a Mini App (or configure the bot menu button) and set the URL to the GitHub Pages URL above.

Never put the bot token or a Supabase secret/service-role key in browser code or GitHub source files.

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
