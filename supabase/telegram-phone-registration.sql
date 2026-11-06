-- Add secure phone binding for Telegram Mini App registration.
-- Safe to run more than once.
alter table public.telegram_accounts alter column user_id drop not null;
alter table public.telegram_accounts add column if not exists phone_number text;
create unique index if not exists telegram_accounts_phone_number_uidx
  on public.telegram_accounts (phone_number)
  where phone_number is not null;
