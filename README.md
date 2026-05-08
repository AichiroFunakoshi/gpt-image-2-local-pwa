# GPT Image 2 Local PWA

Macローカルで動かす、自分用の GPT Image 2 画像生成PWAです。

## できること

- 参照画像を最大6枚まで選択、または複数回ドラッグ&ドロップ
- 日本語の口語指示を GPT-5.5 で英語の実行プロンプトへ変換
- `gpt-image-2` などの画像モデルで参照画像から生成
- 生成画像を `data/outputs/` に保存
- APIキーはブラウザへ渡さず、サーバー側だけで読む

## セットアップ

```zsh
npm install
cp .env.example .env
```

`.env` にAPIキーを設定します。

```text
OPENAI_API_KEY=sk-your_api_key_here
PORT=3000
HOST=127.0.0.1
```

起動:

```zsh
npm start
```

ブラウザで開きます。

```text
http://127.0.0.1:3000
```

## 外部envファイル

リポジトリ外にAPIキーを置く場合は `ENV_FILE` を指定できます。

```zsh
ENV_FILE="/path/to/gpt-image-2-local-pwa.env" npm start
```

この作業環境では、次の外部envファイルを自動検出します。

```text
../.secrets/gpt-image-2-local-pwa.env
```

## GitHub運用

`.env`、生成画像、アップロード一時ファイル、ログ、`node_modules` はGitHubへ入れません。

想定運用:

1. ローカルで作業
2. ブランチを作成
3. GitHubへpush
4. Pull Requestを作成
5. GitHub上のCodeRabbitでレビュー
6. 修正またはmerge
7. 他のMacで `git pull`

## ディレクトリ

```text
public/                  PWAフロントエンド
prompts/                 プロンプト作成方針と現在プロンプト
data/uploads/            一時アップロード、Git管理外
data/outputs/            生成画像、Git管理外
data/logs/               エラーログ、Git管理外
```

## 注意

- このPWAはローカル利用前提です。
- GitHub Pages単体でAPIキーを扱う構成にはしません。
- 参照画像とプロンプトは、生成実行時にOpenAI APIへ送信されます。
