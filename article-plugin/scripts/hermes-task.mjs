#!/usr/bin/env node
/**
 * hermes-task.mjs — 精简版 Hermes Agent 运行时
 *
 * 仅实现：spawn `hermes chat -q PROMPT -Q` → 等待退出 → 捕获 stdout 作为最终回答
 *
 * 用法（与 codex-task.mjs 接口对齐，便于在 agent 端做最小切换）：
 *   node hermes-task.mjs --cwd <dir> --prompt "text"
 *   node hermes-task.mjs --cwd <dir> --prompt-file <path>
 *   可选：--output-file <path>（推荐，避免 stderr 进度日志与结果混淆）
 *
 * 冒烟测试（可用性检查，不需要 --prompt）：
 *   node hermes-task.mjs --check   → exit 0 表示 hermes 可用，exit 1 表示不可用
 *
 * 与 codex-task.mjs 的差异（Hermes 不支持的 flag 会被静默忽略）：
 *   --image / --images-from-markdown   Hermes chat 仅支持单张 image，本运行时统一不传图
 *   --effort                           Hermes 没有对应概念
 *   --model                            交由 Hermes 全局配置（`hermes model`）决定
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// CLI 参数解析（strict:false → 未知 flag 静默忽略，与 codex-task.mjs 对齐）
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    cwd: { type: "string", default: process.cwd() },
    prompt: { type: "string", default: "" },
    "prompt-file": { type: "string", default: "" },
    "output-file": { type: "string", default: "" },
    image: { type: "string", multiple: true, default: [] },
    "images-from-markdown": { type: "string", multiple: true, default: [] },
    model: { type: "string", default: "" },
    effort: { type: "string", default: "" },
    check: { type: "boolean", default: false },
  },
  strict: false,
});

// ---------------------------------------------------------------------------
// --check：冒烟测试，验证 hermes CLI 是否可正常响应（不需要 --prompt）
// ---------------------------------------------------------------------------

if (args.check) {
  process.stderr.write("[hermes] smoke-testing hermes CLI (30s timeout)...\n");
  const proc = spawn("hermes", ["chat", "-q", "Reply with the single word: ok", "-Q"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  let out = "";
  let err = "";
  proc.stdout.setEncoding("utf8");
  proc.stderr.setEncoding("utf8");
  proc.stdout.on("data", (c) => { out += c; });
  proc.stderr.on("data", (c) => { err += c; });
  const timer = setTimeout(() => {
    proc.kill("SIGTERM");
    process.stderr.write("[hermes] ✗ smoke test timed out after 30s\n");
    process.exit(1);
  }, 30_000);
  proc.on("error", (e) => {
    clearTimeout(timer);
    process.stderr.write(`[hermes] ✗ failed to spawn hermes: ${e.message}\n`);
    process.exit(1);
  });
  proc.on("exit", (code) => {
    clearTimeout(timer);
    if (code !== 0 || !out.trim()) {
      process.stderr.write(`[hermes] ✗ smoke test failed (exit ${code}); stderr: ${err.slice(-200)}\n`);
      process.exit(1);
    }
    process.stderr.write(`[hermes] ✓ hermes is available and responsive\n`);
    process.stdout.write("ok\n");
    process.exit(0);
  });
} else {

const cwd = args.cwd || process.cwd();
let prompt = args.prompt || "";
if (!prompt && args["prompt-file"]) {
  prompt = fs.readFileSync(args["prompt-file"], "utf8");
}
if (!prompt) {
  process.stderr.write("Error: --prompt or --prompt-file is required.\n");
  process.exit(1);
}

// 提示忽略的 flag（仅 stderr，不影响 stdout）
if ((args.image && args.image.length) || (args["images-from-markdown"] && args["images-from-markdown"].length)) {
  process.stderr.write("[hermes] note: --image / --images-from-markdown ignored (Hermes single-image mode not used).\n");
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

const startTime = Date.now();
let heartbeat = null;

function elapsedSec() {
  return ((Date.now() - startTime) / 1000).toFixed(0);
}

process.stderr.write("[hermes] spawning `hermes chat -q ... -Q`...\n");

const proc = spawn("hermes", ["chat", "-q", prompt, "-Q"], {
  cwd,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
});

let stdoutBuf = "";
let stderrBuf = "";

proc.stdout.setEncoding("utf8");
proc.stderr.setEncoding("utf8");

proc.stdout.on("data", (chunk) => {
  stdoutBuf += chunk;
});

proc.stderr.on("data", (chunk) => {
  stderrBuf += chunk;
  // 透传少量 stderr 进度（截断避免噪音）
  if (chunk.length < 400) process.stderr.write(`[hermes stderr] ${chunk}`);
});

heartbeat = setInterval(() => {
  process.stderr.write(`[hermes ${elapsedSec()}s] ♡ still working...\n`);
}, 15_000);
heartbeat.unref?.();

proc.on("error", (err) => {
  if (heartbeat) clearInterval(heartbeat);
  process.stderr.write(`Fatal: failed to spawn hermes: ${err.message}\n`);
  process.exit(1);
});

proc.on("exit", (code, signal) => {
  if (heartbeat) clearInterval(heartbeat);
  const output = stdoutBuf.trim();
  if (code !== 0) {
    process.stderr.write(
      `[hermes ${elapsedSec()}s] ✗ hermes exited (${signal ? `signal ${signal}` : `exit ${code}`}); stderr tail: ${stderrBuf.slice(-400)}\n`
    );
    process.exit(code || 1);
  }
  if (!output) {
    process.stderr.write(`[hermes ${elapsedSec()}s] ✗ hermes returned empty stdout; stderr tail: ${stderrBuf.slice(-400)}\n`);
    process.exit(1);
  }
  if (args["output-file"]) {
    const outPath = path.resolve(cwd, args["output-file"]);
    fs.writeFileSync(outPath, output, "utf8");
    process.stderr.write(`[hermes ${elapsedSec()}s] ✓ result written to ${outPath}\n`);
  } else {
    process.stdout.write(output);
  }
  process.exit(0);
});

} // end else (!args.check)
