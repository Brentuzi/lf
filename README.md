# Trade Intelligence

Тёмный трейдинговый интерфейс для загрузки истории торгов, фильтрации сделок,
расчёта реализованного/нереализованного PnL, комиссий и построения графиков.

<img width="1362" height="773" alt="image" src="https://github.com/user-attachments/assets/c82bfab3-6ad1-42de-b618-2e3a72400253" />
<img width="1326" height="1139" alt="image" src="https://github.com/user-attachments/assets/dfa3ff64-e653-4f15-a241-3ee39266bea5" />
<img width="1265" height="1032" alt="image" src="https://github.com/user-attachments/assets/e9255023-2f98-4c29-9961-e73df6b1ce61" />

## Быстрый старт

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Безопасность

- Включены security headers (CSP, X-Frame-Options, HSTS и др.) в `next.config.ts`.
- Лимиты на размер данных: 2 МБ файла и 200 000 символов в textarea.
- Данные обрабатываются локально в браузере, без передачи на сервер.

## Supabase (Auth + DB)

1. Создайте проект в Supabase.
2. Включите провайдеры Google и GitHub в **Authentication → Providers**.
3. Скопируйте значения **Project URL** и **anon public key**.
4. Создайте `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=ваш_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_key
```

5. В **SQL Editor** выполните скрипт `supabase/schema.sql`.
6. В приложении создайте сессию трейда и добавляйте сделки внутрь неё.

## Автотесты

```bash
npm run test:e2e
```

Запускается Playwright, который проверяет загрузку истории и фильтры.

## Формат данных

Поддерживается формат из трёх строк на сделку:

```
SOL/USDT Spot Limit Sell 720.700000 USDT 144.14 USDT 5.0000 SOL
0.720700000000 USDT
2026-01-16 22:34:02 16942312 32140321
```

## Deploy на Vercel

1. Загрузите проект в GitHub/GitLab.
2. Перейдите на [Vercel](https://vercel.com/new) и импортируйте репозиторий.
3. Framework: Next.js (определится автоматически).
4. Build Command: `npm run build`.
5. Output Directory: `.next`.
6. Нажмите Deploy.
