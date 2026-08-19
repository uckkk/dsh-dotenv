// dsh-dotenv — .env 解析/序列化（支持注释、引号、export 前缀）。纯 Node。
import { defineTool } from "@deepseek-ai/dsh-tools";

const name = ".env 工具";
const inject = ["tools"];

/** 解析 .env 文本为对象。支持 # 注释、KEY=VALUE、export KEY=、单/双引号、行内注释。 */
function parseDotenv(text) {
  const result = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    let body = line;
    if (body.startsWith("export ")) body = body.slice(7).trim();
    const eq = body.indexOf("=");
    if (eq === -1) continue;
    let key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    // 去掉引号并保留内部转义
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const q = value[0];
      value = value.slice(1, -1);
      if (q === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      // 行内注释（# 前有空格）
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
      value = value.trim();
    }
    result[key] = value;
  }
  return result;
}

/** 对象序列化为 .env 文本。 */
function stringifyDotenv(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    const v = String(value);
    lines.push(`${key}="${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

async function apply(ctx, _config) {
  ctx.tools.register(defineTool({
    name: "dotenv_parse",
    description: "解析 .env 文本为对象。支持 # 注释、KEY=VALUE、export 前缀、单/双引号值、行内注释。",
    parameters: { text: { type: "string", required: true, description: ".env 文本。" } },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { data: { type: "object", required: true, additionalProperties: true } },
      },
      render: (_a, v) => [{ type: "text", text: Object.entries(v.data).map(([k, val]) => `${k}=${val}`).join("\n") }],
    },
    execute: async (args) => ({ data: parseDotenv(args.text) }),
  }));

  ctx.tools.register(defineTool({
    name: "dotenv_stringify",
    description: "把对象序列化为 .env 文本（键值带双引号，转义内部引号与换行）。",
    parameters: { data: { type: "object", required: true, additionalProperties: true, description: "环境变量对象。" } },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { text: { type: "string", required: true } },
      },
      render: (_a, v) => [{ type: "text", text: v.text }],
    },
    execute: async (args) => ({ text: stringifyDotenv(args.data) }),
  }));
}

export { apply, inject, name };
