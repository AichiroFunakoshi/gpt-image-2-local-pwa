#!/bin/zsh
set -e

echo "== GPT Image 2 Local PWA setup =="

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew が見つかりません。インストールします。"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ -d "/opt/homebrew/bin" ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

brew install node git

npm install

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo ".env を作成しました。OPENAI_API_KEY を設定してください。"
fi

echo ""
echo "セットアップ完了。起動します。"
echo "ブラウザで http://127.0.0.1:3000 を開いてください。"
npm start
