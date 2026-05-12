import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI, { toFile } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultExternalEnvPath = path.resolve(__dirname, "..", ".secrets", "gpt-image-2-local-pwa.env");

function loadEnv() {
  const envPath = process.env.ENV_FILE || (fs.existsSync(defaultExternalEnvPath) ? defaultExternalEnvPath : path.join(__dirname, ".env"));
  dotenv.config({ path: envPath, override: true, quiet: true });
  return envPath;
}

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const app = express();

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(dataDir, "uploads");
const outputDir = path.join(dataDir, "outputs");
const logDir = path.join(dataDir, "logs");
const promptDir = path.join(__dirname, "prompts");
const currentPromptPath = path.join(promptDir, "current_prompt.txt");
const promptBuilderSystemPath = path.join(promptDir, "prompt_builder_system.txt");
const promptBuilderPolicyPath = path.join(promptDir, "prompt_builder_policy.md");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });
fs.mkdirSync(promptDir, { recursive: true });

app.use(cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"] }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/outputs", express.static(outputDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 6
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("PNG / JPEG / WebP 画像のみ対応しています。"));
      return;
    }
    cb(null, true);
  }
});

function getApiKey() {
  loadEnv();
  return process.env.OPENAI_API_KEY || "";
}

function getAllowedSizes() {
  return ["1024x1536", "1536x1024", "auto"];
}

function getAllowedModels() {
  return [
    "gpt-image-2",
    "gpt-image-2-2026-04-21",
    "chatgpt-image-latest",
    "gpt-image-1.5",
    "gpt-image-1",
    "gpt-image-1-mini"
  ];
}

function getAllowedOutputFormats() {
  return ["png", "jpeg", "webp"];
}

function getAllowedPromptModels() {
  return ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.5-pro"];
}

function supportsInputFidelity(model) {
  return ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini", "chatgpt-image-latest"].includes(model);
}

function buildImageEditParams({ model, imageInputs, prompt, size, outputFormat }) {
  const params = {
    model,
    image: imageInputs,
    prompt,
    size,
    output_format: outputFormat
  };

  if (!model.startsWith("gpt-image-2")) {
    params.quality = "auto";
  }

  if (supportsInputFidelity(model)) {
    params.input_fidelity = "high";
  }

  return params;
}

function readTextFileIfExists(filePath, fallback = "") {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return fs.readFileSync(filePath, "utf8");
}

function buildPromptBuilderInput({ intent, currentPrompt, policy }) {
  return [
    "# User intent",
    intent,
    "",
    "# Existing execution prompt",
    currentPrompt || "(none)",
    "",
    "# Local prompting policy",
    policy || "(none)"
  ].join("\n");
}

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array("images", 6)(req, res, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function sendError(res, status, message, details = null) {
  res.status(status).json({
    ok: false,
    error: message,
    details
  });
}

function logGenerationError({ err, params, uploadedFiles }) {
  const logEntry = {
    at: new Date().toISOString(),
    error: {
      message: err?.message || "",
      status: err?.status || null,
      code: err?.code || null,
      type: err?.type || err?.error?.type || null,
      param: err?.param || err?.error?.param || null,
      details: err?.error || err?.response?.data || null
    },
    request: {
      model: params?.model || null,
      size: params?.size || null,
      output_format: params?.output_format || null,
      has_quality: Object.hasOwn(params || {}, "quality"),
      quality: params?.quality || null,
      has_input_fidelity: Object.hasOwn(params || {}, "input_fidelity"),
      input_fidelity: params?.input_fidelity || null,
      prompt_length: params?.prompt?.length || 0,
      prompt_preview: params?.prompt?.slice(0, 2000) || "",
      image_count: uploadedFiles?.length || 0,
      images: (uploadedFiles || []).map(file => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }))
    }
  };
  const filename = `generation-error-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const logPath = path.join(logDir, filename);
  fs.writeFileSync(logPath, JSON.stringify(logEntry, null, 2), "utf8");
  return {
    filename,
    logPath
  };
}

function readGenerationLogs(limit = 10) {
  return fs.readdirSync(logDir)
    .filter(file => /^generation-error-.+\.json$/i.test(file))
    .map((file) => {
      const filePath = path.join(logDir, file);
      const stat = fs.statSync(filePath);
      let entry = null;

      try {
        entry = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch {
        entry = null;
      }

      const message = entry?.error?.message || "ログを読み込めませんでした。";
      const code = entry?.error?.code || null;
      const type = entry?.error?.type || null;

      return {
        filename: file,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        message,
        code,
        type,
        model: entry?.request?.model || null,
        size: entry?.request?.size || null,
        imageCount: entry?.request?.image_count || 0,
        promptPreview: entry?.request?.prompt_preview || ""
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit);
}

function toClientError(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return {
        status: 413,
        message: "画像ファイルが大きすぎます。1枚あたり25MB以下にしてください。"
      };
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return {
        status: 400,
        message: "参照画像は最大6枚までです。"
      };
    }

    return {
      status: 400,
      message: `アップロードに失敗しました: ${err.message}`
    };
  }

  if (err?.status || err?.code) {
    if (err?.code === "moderation_blocked" || err?.error?.code === "moderation_blocked") {
      return {
        status: Number(err.status || 400),
        message: "OpenAIの安全判定で画像生成がブロックされました。参照画像またはプロンプトの組み合わせが原因です。プロンプトをより中立的な表現に調整してください。",
        details: err.error || err.response?.data || null
      };
    }

    return {
      status: Number(err.status || 500),
      message: err.message || "OpenAI APIでエラーが発生しました。",
      details: err.error || err.response?.data || null
    };
  }

  if (err?.message) {
    return {
      status: 400,
      message: err.message,
      details: null
    };
  }

  return {
    status: 500,
    message: err?.message || "画像生成に失敗しました。",
    details: err?.response?.data || null
  };
}

app.get("/api/status", (_req, res) => {
  const key = getApiKey();

  res.json({
    ok: true,
    hasApiKey: Boolean(key),
    port: PORT,
    dataDir,
    outputDir,
    allowedSizes: getAllowedSizes(),
    allowedModels: getAllowedModels(),
    allowedOutputFormats: getAllowedOutputFormats(),
    allowedPromptModels: getAllowedPromptModels()
  });
});

app.get("/api/prompt/current", (_req, res) => {
  if (!fs.existsSync(currentPromptPath)) {
    res.status(404).json({
      error: "prompts/current_prompt.txt が見つかりません。プロンプトを書き込んでから読み込んでください。"
    });
    return;
  }

  const prompt = fs.readFileSync(currentPromptPath, "utf8");
  res.json({
    ok: true,
    prompt
  });
});

app.get("/api/download/:filename", (req, res) => {
  const filename = path.basename(String(req.params.filename || ""));

  if (!filename) {
    sendError(res, 400, "ファイル名が指定されていません。");
    return;
  }

  const outputPath = path.join(outputDir, filename);

  if (!fs.existsSync(outputPath)) {
    sendError(res, 404, "指定された生成画像が見つかりません。");
    return;
  }

  res.download(outputPath, filename);
});

app.get("/api/outputs", (_req, res) => {
  const files = fs.readdirSync(outputDir)
    .filter(file => /\.(png|jpe?g|webp)$/i.test(file))
    .map((file) => {
      const stat = fs.statSync(path.join(outputDir, file));
      return {
        filename: file,
        url: `/outputs/${file}`,
        downloadUrl: `/api/download/${encodeURIComponent(file)}`,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  res.json({
    ok: true,
    files
  });
});

app.get("/api/logs", (req, res) => {
  const requestedLimit = Number(req.query?.limit || 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(50, requestedLimit))
    : 10;

  res.json({
    ok: true,
    logs: readGenerationLogs(limit)
  });
});

app.post("/api/prompt/build", async (req, res) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    sendError(res, 400, "OpenAI APIキーが未設定です。");
    return;
  }

  const intent = String(req.body?.intent || "").trim();
  const currentPrompt = String(req.body?.currentPrompt || "").trim();
  const promptModel = String(req.body?.promptModel || "gpt-5.5");

  if (!intent) {
    sendError(res, 400, "日本語指示を入力してください。");
    return;
  }

  if (!getAllowedPromptModels().includes(promptModel)) {
    sendError(res, 400, `未対応のプロンプト作成モデルです: ${promptModel}`);
    return;
  }

  const fallbackSystemPrompt = [
    "Role: You convert casual Japanese image requests into one production-ready English prompt for GPT Image 2 editing with reference images.",
    "",
    "# Goal",
    "Produce the final prompt that will be sent to the image model.",
    "",
    "# Success criteria",
    "- The prompt states the desired visual outcome first.",
    "- The prompt preserves identity and uses reference images as source context.",
    "- The prompt captures composition, subject, style, background, visible text, and constraints that materially affect the image.",
    "- The prompt is concise enough to be usable, but specific enough to guide generation.",
    "",
    "# Constraints",
    "- Do not add explanations, headings, Markdown fences, alternatives, or commentary.",
    "- If visible labels or annotations are requested, require those visible texts to be short Japanese text.",
    "- Do not invent unsupported identity details, names, metrics, or claims.",
    "",
    "# Output",
    "Return only the final English image-generation prompt."
  ].join("\n");

  const systemPrompt = readTextFileIfExists(promptBuilderSystemPath, fallbackSystemPrompt);
  const policy = readTextFileIfExists(promptBuilderPolicyPath);
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model: promptModel,
      instructions: systemPrompt,
      input: buildPromptBuilderInput({ intent, currentPrompt, policy }),
      store: false,
      reasoning: {
        effort: "low"
      },
      text: {
        verbosity: "low"
      }
    });

    const prompt = String(response.output_text || "").trim();

    if (!prompt) {
      sendError(res, 502, "プロンプト作成結果が空でした。", response);
      return;
    }

    fs.writeFileSync(currentPromptPath, `${prompt}\n`, "utf8");

    res.json({
      ok: true,
      prompt,
      promptModel,
      savedTo: "prompts/current_prompt.txt"
    });
  } catch (err) {
    console.error(err);

    const clientError = toClientError(err);
    sendError(res, clientError.status, clientError.message, clientError.details);
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    const clientError = toClientError(err);
    sendError(res, clientError.status, clientError.message, clientError.details);
    return;
  }

  const apiKey = getApiKey();
  const uploadedFiles = req.files || [];

  if (!apiKey) {
    for (const file of uploadedFiles) {
      fs.rm(file.path, { force: true }, () => {});
    }
    sendError(res, 400, "OpenAI APIキーが未設定です。");
    return;
  }

  const prompt = String(req.body?.prompt || "").trim();
  const size = String(req.body?.size || "1024x1536");
  const model = String(req.body?.model || "gpt-image-2");
  const outputFormat = String(req.body?.outputFormat || "png");

  if (!prompt) {
    for (const file of uploadedFiles) {
      fs.rm(file.path, { force: true }, () => {});
    }
    sendError(res, 400, "プロンプトを入力してください。");
    return;
  }

  if (!getAllowedSizes().includes(size)) {
    for (const file of uploadedFiles) {
      fs.rm(file.path, { force: true }, () => {});
    }
    sendError(res, 400, `未対応のサイズです: ${size}`);
    return;
  }

  if (!getAllowedModels().includes(model)) {
    for (const file of uploadedFiles) {
      fs.rm(file.path, { force: true }, () => {});
    }
    sendError(res, 400, `未対応のモデルです: ${model}`);
    return;
  }

  if (!getAllowedOutputFormats().includes(outputFormat)) {
    for (const file of uploadedFiles) {
      fs.rm(file.path, { force: true }, () => {});
    }
    sendError(res, 400, `未対応の出力形式です: ${outputFormat}`);
    return;
  }

  if (uploadedFiles.length === 0) {
    sendError(res, 400, "参照画像を1枚以上アップロードしてください。");
    return;
  }

  const client = new OpenAI({ apiKey });
  let imageEditParams = null;

  try {
    const imageInputs = [];

    for (const file of uploadedFiles) {
      const stream = fs.createReadStream(file.path);
      const imageFile = await toFile(
        stream,
        file.originalname || path.basename(file.path),
        { type: file.mimetype }
      );
      imageInputs.push(imageFile);
    }

    const params = buildImageEditParams({ model, imageInputs, prompt, size, outputFormat });
    imageEditParams = params;

    const result = await client.images.edit(params);

    const b64 = result?.data?.[0]?.b64_json;

    if (!b64) {
      sendError(res, 502, "画像データが返されませんでした。", result);
      return;
    }

    const filename = `generated-${new Date().toISOString().replace(/[:.]/g, "-")}.${outputFormat}`;
    const outputPath = path.join(outputDir, filename);

    fs.writeFileSync(outputPath, Buffer.from(b64, "base64"));

    res.json({
      ok: true,
      filename,
      url: `/outputs/${filename}`,
      downloadUrl: `/api/download/${encodeURIComponent(filename)}`,
      outputDir,
      revisedPrompt: result?.data?.[0]?.revised_prompt || ""
    });
  } catch (err) {
    console.error(err);

    const logged = logGenerationError({
      err,
      params: imageEditParams,
      uploadedFiles
    });
    const clientError = toClientError(err);
    sendError(res, clientError.status, clientError.message, {
      ...(clientError.details || {}),
      logFile: logged.filename
    });
  } finally {
    for (const file of uploadedFiles) {
      fs.rm(file.path, { force: true }, () => {});
    }
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`GPT Image 2 Local PWA: http://${HOST}:${PORT}`);
  console.log(`Outputs directory: ${outputDir}`);
});

server.on("error", (err) => {
  console.error(err);
  process.exitCode = 1;
});
