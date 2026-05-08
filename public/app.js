const $ = (id) => document.getElementById(id);

const templatePrompt = `Use the attached reference images as the source references.

Goal:
Create a high-resolution, clean, photorealistic cosplay character reference sheet for future image generation consistency.
This image is a practical reference sheet, not a glamour portrait.

Output language rule:
All visible titles, labels, annotations, and callouts inside the generated character sheet must be written in Japanese only.
Use short, readable Japanese labels.

Identity rule:
Preserve the identity of the person in the reference images.
Do not create a new face.
Do not make the person look like a different model.
Do not over-beautify the face until the original identity is lost.
The final result must look like the same person wearing the requested cosplay.

Required sections:
1. Large full-body front view on the left.
Japanese label: 「ベース全身・正面」

2. Facial expression variations in the upper-right area:
「笑顔」
「やわらかい表情」
「クール・無表情」
「少し照れた表情」

3. Angle variations:
「左向き（3/4）」
「右向き（3/4）」
「左側面」
「右側面」

4. Full-body costume turnaround:
「全身正面」
「全身背面」
「全身左側面」
「全身右側面」

5. Detail callout panels:
「顔・メイク」
「髪飾り」
「フリル襟」
「黒リボン」
「エプロン」
「白オーバーニーは膝上丈」
「黒い丸靴」
「背面ディテール」

Composition:
Use a white or very light gray background.
Use a structured grid layout.
Prioritize full-body visibility, side views, back view, shoes, accessories, and consistent identity.
Do not crop the feet.
Do not omit the back view.

Final output:
A high-resolution character reference sheet with Japanese labels, useful as a stable reference image for future generations.`;

async function refreshStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();

  $("status").textContent = data.hasApiKey
    ? "APIキー設定済み"
    : "APIキー未設定";
}

function showResult(data) {
  $("result").innerHTML = "";

  const img = document.createElement("img");
  img.src = data.url;

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const downloadLink = document.createElement("a");
  downloadLink.href = data.downloadUrl || data.url;
  downloadLink.download = data.filename;
  downloadLink.textContent = "PNGをダウンロード";

  const openLink = document.createElement("a");
  openLink.href = data.url;
  openLink.target = "_blank";
  openLink.rel = "noopener";
  openLink.textContent = "画像を開く";

  const pathNote = document.createElement("div");
  pathNote.className = "result-path";
  pathNote.textContent = `保存先: data/outputs/${data.filename}`;

  actions.appendChild(downloadLink);
  actions.appendChild(openLink);
  $("result").appendChild(img);
  $("result").appendChild(actions);
  $("result").appendChild(pathNote);
}

$("loadTemplate").addEventListener("click", () => {
  $("prompt").value = templatePrompt;
});

$("loadCurrentPrompt").addEventListener("click", async () => {
  $("message").textContent = "現在のプロンプトを読み込み中...";

  try {
    const res = await fetch("/api/prompt/current");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "プロンプトの読み込みに失敗しました。");
    }

    $("prompt").value = data.prompt || "";
    $("message").textContent = "現在のプロンプトを読み込みました。";
  } catch (err) {
    $("message").textContent = `エラー: ${err.message}`;
  }
});

$("buildPrompt").addEventListener("click", async () => {
  const intent = $("intent").value.trim();

  if (!intent) {
    $("message").textContent = "日本語指示を入力してください。";
    return;
  }

  const confirmed = window.confirm(
    "日本語指示をOpenAI APIへ送信して、画像生成用の英語プロンプトを作成します。\n" +
    `プロンプト作成モデル: ${$("promptModel").value}\n\n` +
    "参照画像はこの段階では送信しません。実行しますか？"
  );

  if (!confirmed) {
    $("message").textContent = "プロンプト作成をキャンセルしました。";
    return;
  }

  $("buildPrompt").disabled = true;
  $("message").textContent = "実行プロンプトを作成中です...";

  try {
    const res = await fetch("/api/prompt/build", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent,
        currentPrompt: $("prompt").value,
        promptModel: $("promptModel").value
      })
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : { error: await res.text() };

    if (!res.ok) {
      const details = data.details ? `\n${JSON.stringify(data.details, null, 2)}` : "";
      throw new Error(`${data.error || "プロンプト作成に失敗しました。"}${details}`);
    }

    $("prompt").value = data.prompt || "";
    $("message").textContent = "実行プロンプトを作成し、current_prompt.txt に保存しました。";
  } catch (err) {
    $("message").textContent = `エラー: ${err.message}`;
  } finally {
    $("buildPrompt").disabled = false;
  }
});

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxImageCount = 6;
let selectedImageFiles = [];

function renderPreview() {
  const preview = $("preview");
  preview.innerHTML = "";

  $("imageCount").textContent = `${selectedImageFiles.length}枚選択中`;
  $("clearImages").disabled = selectedImageFiles.length === 0;

  selectedImageFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "preview-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);

    const meta = document.createElement("div");
    meta.className = "preview-meta";
    meta.textContent = `${index + 1}. ${file.name}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-image";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      selectedImageFiles.splice(index, 1);
      renderPreview();
      $("message").textContent = `${selectedImageFiles.length}枚の参照画像を設定しました。`;
    });

    item.appendChild(img);
    item.appendChild(meta);
    item.appendChild(remove);
    preview.appendChild(item);
  });
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function addImageFiles(files) {
  const imageFiles = Array.from(files).filter(file => allowedImageTypes.has(file.type));

  if (!imageFiles.length) {
    $("message").textContent = "PNG / JPEG / WebP 画像を選択してください。";
    return;
  }

  const existingKeys = new Set(selectedImageFiles.map(fileKey));
  const addedFiles = [];

  for (const file of imageFiles) {
    if (selectedImageFiles.length + addedFiles.length >= maxImageCount) {
      break;
    }

    const key = fileKey(file);
    if (!existingKeys.has(key)) {
      addedFiles.push(file);
      existingKeys.add(key);
    }
  }

  selectedImageFiles = selectedImageFiles.concat(addedFiles);
  $("images").value = "";
  renderPreview();

  const ignoredInvalidCount = Array.from(files).length - imageFiles.length;
  const ignoredLimitCount = imageFiles.length - addedFiles.length;
  const notes = [];

  if (addedFiles.length) {
    notes.push(`${addedFiles.length}枚追加しました。現在${selectedImageFiles.length}枚です。`);
  } else {
    notes.push("追加できる新しい画像はありませんでした。");
  }

  if (ignoredInvalidCount > 0) {
    notes.push(`${ignoredInvalidCount}件は対応外形式のため除外しました。`);
  }

  if (ignoredLimitCount > 0) {
    notes.push(`重複または上限${maxImageCount}枚のため${ignoredLimitCount}枚を追加しませんでした。`);
  }

  $("message").textContent = notes.join("\n");
}

$("images").addEventListener("change", () => {
  addImageFiles($("images").files);
});

$("clearImages").addEventListener("click", () => {
  selectedImageFiles = [];
  $("images").value = "";
  renderPreview();
  $("message").textContent = "参照画像をクリアしました。";
});

const dropZone = $("dropZone");

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragover");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragover");
  addImageFiles(event.dataTransfer.files);
});

$("generate").addEventListener("click", async () => {
  const prompt = $("prompt").value.trim();

  if (!selectedImageFiles.length) {
    $("message").textContent = "参照画像を1枚以上選択してください。";
    return;
  }

  if (!prompt) {
    $("message").textContent = "プロンプトを入力してください。";
    return;
  }

  const confirmed = window.confirm(
    `参照画像${selectedImageFiles.length}枚とプロンプトをOpenAI APIへ送信して画像生成します。\n` +
    `モデル: ${$("model").value}\n` +
    `サイズ: ${$("size").value}\n\n` +
    "実行しますか？"
  );

  if (!confirmed) {
    $("message").textContent = "生成をキャンセルしました。";
    return;
  }

  const form = new FormData();

  for (const file of selectedImageFiles) {
    form.append("images", file);
  }

  form.append("prompt", prompt);
  form.append("size", $("size").value);
  form.append("model", $("model").value);
  form.append("outputFormat", "png");

  $("generate").disabled = true;
  $("message").textContent = "生成中です。数十秒〜数分かかる場合があります。";
  $("result").innerHTML = "";

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      body: form
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : { error: await res.text() };

    if (!res.ok) {
      const details = data.details ? `\n${JSON.stringify(data.details, null, 2)}` : "";
      throw new Error(`${data.error || "生成に失敗しました。"}${details}`);
    }

    $("message").textContent = "生成完了。";

    showResult(data);
  } catch (err) {
    $("message").textContent = `エラー: ${err.message}`;
  } finally {
    $("generate").disabled = false;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

refreshStatus().catch(() => {
  $("status").textContent = "状態確認エラー";
});

renderPreview();
