# gpt-image-2-local-pwa 作業申し送り

## 正しい作業方針

このプロジェクトの実作業は、各Macの純ローカルcloneで行います。GitHubの `main` を正として同期し、iCloud Drive 側の旧フォルダは申し送り/アーカイブ参照として扱います。

推奨作業ディレクトリ:

```zsh
cd "/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa"
npm start
```

以後の作業は必ず上記ディレクトリを基準にしてください。

この方針を優先する理由:

- 両方のMacで `git pull --ff-only` により同じ状態へ揃えられる
- iCloud Drive の同期遅延、`.git` ロック、古いファイル同期による事故を避けられる
- GitHub上の履歴を正本にするため、古いローカルデータで新しいデータを上書きしにくい

iCloud Drive 側で長時間のdev server起動、npm install、通常のgit作業は原則避けてください。必要がある場合でも、GitHub `main` とローカルcloneの状態を確認してから行ってください。

iCloud Drive 側の申し送り:

```text
/Users/inaminetetsuo/Library/Mobile Documents/com~apple~CloudDocs/AI-Workspace/gpt-image-2-local-pwa/LOCAL_WORKFLOW_HANDOFF.md
```

## 現在の目的

Macローカルで動かす GPT Image 画像生成PWAです。

- 参照画像を最大6枚までアップロード、またはドラッグ＆ドロップする
- 画像は複数回に分けて追加できる。フロント側は `selectedImageFiles` で選択状態を保持する
- 英語プロンプトを入力、または `prompts/current_prompt.txt` から読み込む
- 日本語の口語指示を入力し、OpenAIテキストモデルで英語の実行プロンプトに変換する
- プロンプト作成時は、作成前の実行プロンプトと作成後の英語プロンプトを画面上で比較できる
- 画像内ラベルや注釈は日本語で出力させる
- OpenAI API の画像編集APIを使って生成する
- 生成結果をブラウザに表示する
- 生成PNGを `data/outputs/` に保存する
- 生成履歴と生成エラーログを画面から確認する
- APIキーはブラウザには渡さず、サーバー側で `ENV_FILE`、外部 `.secrets`、またはローカル `.env` から読む

## 重要な制約

- `.env` の中身やAPIキーは表示しない
- `.env` をGit管理に含めない
- APIキー入りenvはリポジトリ外の `../.secrets/gpt-image-2-local-pwa.env` へ退避済み
- APIキーをフロントエンド、localStorage、sessionStorageに保存しない
- UIは日本語のままにする
- 実画像生成APIは、ユーザーが明示的に許可するまで呼ばない
- 画像生成を実行する場合、参照画像がOpenAIへ送信されることを確認してから行う
- 低トークン運用を優先する。GitHub PR確認は対象PR番号だけに限定し、巨大JSONは出力しない
- CodeRabbit確認は `npm run pr:summary -- <PR番号>` を優先し、必要項目だけ確認する

## 現在の主な構成

- `server.js`
  - Expressサーバー
  - `ENV_FILE` があればそれを読み、なければ `../.secrets/gpt-image-2-local-pwa.env`、最後にローカル `.env` を読む
  - `GET /api/status`
  - `GET /api/prompt/current`
  - `GET /api/download/:filename`
  - `GET /api/outputs`
  - `GET /api/logs`
  - `POST /api/prompt/build`
  - `POST /api/generate`
  - `POST /api/prompt/build` は `prompts/prompt_builder_system.txt` を読み、Responses APIで日本語指示を英語の実行プロンプトへ変換し、`prompts/current_prompt.txt` に保存する
  - OpenAI Node SDKで `client.images.edit({ image: imageInputs, ... })` を呼ぶ
  - 複数画像は `image: imageInputs` の配列で渡す
  - multer / OpenAI / バリデーションエラーはJSONで返す
  - 一時アップロードは `data/uploads/`
  - 生成結果は `data/outputs/`
  - 生成失敗時の診断ログは `data/logs/`
  - `/api/logs` はUI用の要約だけを返し、プロンプト本文プレビューは返さない

- `public/index.html`
  - APIキーは `.env` 手動設定案内のみ
  - 参照画像はクリック選択 + ドラッグ＆ドロップ対応
  - 日本語指示欄とプロンプト作成ボタンあり
  - プロンプト確認欄あり。作成前/作成後を比較し、コピー・反映・作成前に戻す操作ができる
  - モデル選択あり
  - サイズ選択あり
  - 「現在のプロンプトを読み込む」ボタンあり
  - 生成履歴と生成エラー履歴あり

- `public/app.js`
  - `/api/status` でAPIキー設定有無だけ表示
  - `/api/prompt/build` で日本語指示から英語の実行プロンプトを作成
  - プロンプト作成後、作成前と作成後を `promptReview` に保持して比較表示する
  - `/api/prompt/current` からプロンプト読み込み
  - `/api/outputs` と `/api/logs` から履歴を表示する
  - 参照画像のクリック選択、ドラッグ＆ドロップ、プレビュー
  - 生成時に `FormData` で `images`, `prompt`, `model`, `size`, `outputFormat` を送信

- `public/style.css`
  - 日本語UI
  - ドロップゾーン表示あり

- `prompts/current_prompt.txt`
  - Codexから長文プロンプトを書き込むためのファイル
  - `/api/prompt/build` の生成結果もここに保存される
  - PWA画面の「現在のプロンプトを読み込む」で読み込む

- `prompts/prompt_builder_system.txt`
  - 日本語指示を英語の実行プロンプトへ変換するためのシステムプロンプト
  - GPT-5.5ガイドに合わせて outcome-first / success criteria / constraints / output / stop rules の短い構造にしている
  - 将来GPT Image 2向けの公式プロンプト構造が公開されたら、このファイルや追加のガイドファイルを更新する

- `prompts/prompt_builder_policy.md`
  - `GPT5-5プロンプティングガイド` 内の3ファイルから、このアプリのプロンプト作成に関係する方針を要約したローカルポリシー
  - `/api/prompt/build` は `prompt_builder_system.txt` を `instructions`、このポリシーとユーザー入力を `input` に渡す
  - Responses APIでは `store: false`、`reasoning.effort: low`、`text.verbosity: low` を使う

## モデルとサイズ

許可モデル:

- `gpt-image-2`
- `gpt-image-2-2026-04-21`
- `chatgpt-image-latest`
- `gpt-image-1.5`
- `gpt-image-1`
- `gpt-image-1-mini`

`gpt-image-2` と `gpt-image-2-2026-04-21` は `/v1/models` でこのAPIキーから利用可能なことを確認済み。OpenAI SDK 6.20.0 の型定義の列挙にはまだ含まれていないが、`model` は任意文字列も受け付けるため `client.images.edit()` にそのまま渡す。

`chatgpt-image-latest` も `/v1/models` で利用可能。ダッシュボード相当の挙動確認用にUI選択肢へ残している。

`input_fidelity` は `gpt-image-2` / `gpt-image-2-2026-04-21` では送らない。実APIで `invalid_input_fidelity_model` になるため、`server.js` の `supportsInputFidelity()` で対応モデルだけに限定している。

プロンプト作成モデル:

- `gpt-5.5`（デフォルト）
- `gpt-5.4-mini`
- `gpt-5.4`
- `gpt-5.5-pro`

サイズ:

- デフォルトはスマホ縦長 `1024x1536`
- `1536x1024` と `auto` も選択可能
- 正方形 `1024x1024` は回避するためUIとサーバー許可リストから外している

## 起動確認手順

```zsh
cd "/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa"
npm start
```

別端末またはCodexから確認:

```zsh
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/status
```

期待値:

- `/` が `200 OK` で `index.html` を返す
- `/api/status` が `200 OK`
- `hasApiKey` は true/false のみ確認し、キーの値は表示しない

## よくある問題

### `/api/status` は返るが `/` が `Cannot GET /` になる

古い作業場所や別プロセスからサーバーが起動している可能性が高いです。現在の正しい作業場所は純ローカルcloneです。

対処:

1. `lsof -nP -iTCP:3000 -sTCP:LISTEN` でPIDを確認
2. 古いローカル開発サーバーを停止
3. `/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa` から `npm start`

### ブラウザに古いUIが出る

PWAのservice workerキャッシュが残っている可能性があります。`public/service-worker.js` はネットワーク優先に修正済みですが、必要ならブラウザを再読み込みしてください。

## 次に作業を再開するときのCodexへの指示例

```text
以下の申し送りを読んで、このプロジェクトの作業を続けてください。
/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa/HANDOFF.md

作業ディレクトリは以下です。
/Users/inaminetetsuo/Projects/gpt-image-2-local-pwa

APIキーは表示しないでください。
実画像生成APIは、私が明示的に許可するまで呼ばないでください。
```

## 直近の推奨タスク

1. PWA画面で参照画像をドラッグ＆ドロップできるか確認する
2. プロンプト作成の確認UIで、作成前/作成後/反映/復元/コピーの動作を確認する
3. 画像生成を実行する前に、モデル `gpt-image-2`、サイズ `1024x1536`、参照画像枚数を確認する
4. ユーザーの明示許可後にのみ生成ボタンを押す
