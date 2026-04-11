#!/usr/bin/env node
/**
 * codex-task.mjs — 精简版 Codex 运行时
 *
 * 仅实现：spawn codex app-server → JSON-RPC → turn/start → 等待完成 → 输出 finalMessage
 * 不包含：broker、job tracking、review、resume、hooks
 *
 * 用法：
 *   node codex-task.mjs --cwd <dir> --prompt "text"
 *   node codex-task.mjs --cwd <dir> --prompt-file <path>
 *   node codex-task.mjs --cwd <dir> --prompt-file <path> --images-from-markdown <origin.md>
 *   node codex-task.mjs --cwd <dir> --prompt-file <path> --image <img1> --image <img2>
 *   可选：--model <model> --effort <effort>
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import readline from "node:readline";

// ---------------------------------------------------------------------------
// CLI 参数解析
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    cwd: { type: "string", default: process.cwd() },
    prompt: { type: "string", default: "" },
    "prompt-file": { type: "string", default: "" },
    image: { type: "string", multiple: true, default: [] },
    "images-from-markdown": { type: "string", multiple: true, default: [] },
    model: { type: "string", default: "" },
    effort: { type: "string", default: "" },
  },
  strict: false,
});

const cwd = args.cwd || process.cwd();
let prompt = args.prompt || "";
if (!prompt && args["prompt-file"]) {
  prompt = fs.readFileSync(args["prompt-file"], "utf8");
}
if (!prompt) {
  process.stderr.write("Error: --prompt or --prompt-file is required.\n");
  process.exit(1);
}

function extractImageRefsFromMarkdown(markdown) {
  const refs = new Set();
  const markdownImageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(markdownImageRegex)) {
    const ref = match[1]?.trim();
    if (!ref || /^(https?:|data:)/i.test(ref)) continue;
    refs.add(ref);
  }
  return [...refs];
}

function buildTurnInput() {
  const imagePaths = new Set();

  for (const imageArg of args.image || []) {
    const resolved = path.resolve(cwd, imageArg);
    if (fs.existsSync(resolved)) imagePaths.add(resolved);
  }

  for (const markdownPath of args["images-from-markdown"] || []) {
    const resolvedMarkdown = path.resolve(cwd, markdownPath);
    if (!fs.existsSync(resolvedMarkdown)) continue;
    const markdown = fs.readFileSync(resolvedMarkdown, "utf8");
    const baseDir = path.dirname(resolvedMarkdown);
    for (const imageRef of extractImageRefsFromMarkdown(markdown)) {
      const resolvedImage = path.isAbsolute(imageRef) ? imageRef : path.resolve(baseDir, imageRef);
      if (fs.existsSync(resolvedImage)) imagePaths.add(resolvedImage);
    }
  }

  const input = [{ type: "text", text: prompt, text_elements: [] }];
  for (const imagePath of imagePaths) {
    input.push({ type: "localImage", path: imagePath });
  }
  return input;
}

// ---------------------------------------------------------------------------
// JSON-RPC 客户端（精简版，仅 spawn 模式）
// ---------------------------------------------------------------------------

class CodexClient {
  constructor() {
    this.pending = new Map();
    this.nextId = 1;
    this.closed = false;
    this.stderr = "";
    this.proc = null;

    // turn capture state
    this.turnCompleted = false;
    this.lastAgentMessage = "";
    this.error = null;
    this.resolveTurn = null;
    this.rejectTurn = null;
  }

  async connect(workdir) {
    this.proc = spawn("codex", ["app-server"], {
      cwd: workdir,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");

    this.proc.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });

    this.proc.on("error", (err) => {
      this._handleExit(err);
    });

    this.proc.on("exit", (code, signal) => {
      const detail =
        code === 0
          ? null
          : new Error(
              `codex app-server exited unexpectedly (${signal ? `signal ${signal}` : `exit ${code}`}).`
            );
      this._handleExit(detail);
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => this._handleLine(line));

    // initialize handshake
    await this.request("initialize", {
      clientInfo: { title: "Article Plugin Codex Task", name: "article-plugin-codex-task", version: "1.0.0" },
      capabilities: {
        experimentalApi: false,
        optOutNotificationMethods: [
          "item/agentMessage/delta",
          "item/reasoning/summaryTextDelta",
          "item/reasoning/summaryPartAdded",
          "item/reasoning/textDelta",
        ],
      },
    });
    this.notify("initialized", {});
  }

  request(method, params) {
    if (this.closed) throw new Error("Client closed.");
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this._send({ id, method, params });
    });
  }

  notify(method, params = {}) {
    if (!this.closed) this._send({ method, params });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.proc && !this.proc.killed) {
      this.proc.stdin.end();
      setTimeout(() => {
        if (this.proc && !this.proc.killed && this.proc.exitCode === null) {
          this.proc.kill("SIGTERM");
        }
      }, 50).unref?.();
    }
  }

  _send(message) {
    this.proc?.stdin?.write(JSON.stringify(message) + "\n");
  }

  _handleLine(line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    // server request — respond with unsupported
    if (msg.id !== undefined && msg.method) {
      this._send({ id: msg.id, error: { code: -32601, message: `Unsupported: ${msg.method}` } });
      return;
    }

    // response to our request
    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message ?? `RPC ${pending.method} failed.`));
      } else {
        pending.resolve(msg.result ?? {});
      }
      return;
    }

    // notification — handle turn lifecycle
    this._handleNotification(msg);
  }

  _handleNotification(msg) {
    switch (msg.method) {
      case "item/completed":
        if (msg.params?.item?.type === "agentMessage" && msg.params.item.text) {
          this.lastAgentMessage = msg.params.item.text;
        }
        break;
      case "error":
        this.error = msg.params?.error;
        process.stderr.write(`Codex error: ${msg.params?.error?.message ?? "unknown"}\n`);
        break;
      case "turn/completed":
        this.turnCompleted = true;
        if (this.resolveTurn) this.resolveTurn();
        break;
    }
  }

  _handleExit(error) {
    this.closed = true;
    for (const p of this.pending.values()) {
      p.reject(error ?? new Error("Connection closed."));
    }
    this.pending.clear();
    if (this.rejectTurn && !this.turnCompleted) {
      this.rejectTurn(error ?? new Error("Codex exited before turn completed."));
    }
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const client = new CodexClient();

  try {
    await client.connect(cwd);

    // start thread
    const threadResp = await client.request("thread/start", {
      cwd,
      model: args.model || null,
      approvalPolicy: "never",
      sandbox: "read-only",
      serviceName: "article_plugin_codex_task",
      ephemeral: true,
      experimentalRawEvents: false,
    });
    const threadId = threadResp.thread.id;

    // start turn — wait for completion via notification
    const turnDone = new Promise((resolve, reject) => {
      client.resolveTurn = resolve;
      client.rejectTurn = reject;
    });

    const turnResp = await client.request("turn/start", {
      threadId,
      input: buildTurnInput(),
      model: args.model || null,
      effort: args.effort || null,
      outputSchema: null,
    });

    // if turn already completed synchronously
    if (turnResp.turn?.status && turnResp.turn.status !== "inProgress") {
      client.turnCompleted = true;
    }

    if (!client.turnCompleted) {
      await turnDone;
    }

    // output result
    const output = client.lastAgentMessage || "";
    process.stdout.write(output);

    await client.close();
    process.exit(client.error ? 1 : 0);
  } catch (err) {
    process.stderr.write(`Fatal: ${err.message}\n`);
    await client.close().catch(() => {});
    process.exit(1);
  }
}

main();
