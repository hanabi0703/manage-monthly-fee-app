# 月謝管理アプリ

チームの月謝・会計を管理するアプリです。

## できること

- 日付 × メンバー名の一覧表で、誰がその日に月謝／ビジター料金を払ったか確認できる
- 支払い記録の入力（日付・名前・金額・区分）
- 月謝額の変更履歴を管理し、標準額との差額をメンバーごとの繰越金／未払金として自動計算
- 誰でも見られるメンバーページで、支払い履歴・繰越金額・未払金の有無を確認できる

## セットアップ

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

http://localhost:3000 を開いてください。

## 技術構成

- Next.js (App Router) / TypeScript
- Prisma + SQLite
- Tailwind CSS
