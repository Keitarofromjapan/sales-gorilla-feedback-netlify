# Sales Gorilla Feedback

営業提案・商談メモをAIがレビューするNetlify向けMVPです。

## ローカル起動

```bash
npm install
cp .env.example .env
# .env に OPENAI_API_KEY を設定
npm run dev
```

## Netlify設定

Build command:

```bash
npm run build
```

Publish directory:

```bash
dist
```

Functions directory:

```bash
netlify/functions
```

## Netlify環境変数

Netlify管理画面で以下を追加してください。

- `OPENAI_API_KEY`
- `OPENAI_MODEL` 任意。未設定の場合は `gpt-4.1-mini`

注意：APIキーはフロントエンドには置かず、Netlify Functions側で使います。
