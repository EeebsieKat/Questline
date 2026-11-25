import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Check, Copy, Pencil } from "lucide-react";
import type { CardNode } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { useApp } from "../../lib/store";

// highlight.js core + only the languages we ship (small bundle)
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import lua from "highlight.js/lib/languages/lua";
import csharp from "highlight.js/lib/languages/csharp";
import cpp from "highlight.js/lib/languages/cpp";
import glsl from "highlight.js/lib/languages/glsl";
import json from "highlight.js/lib/languages/json";
import shell from "highlight.js/lib/languages/shell";
import plaintext from "highlight.js/lib/languages/plaintext";

// GDScript ships as a compact custom grammar (not bundled with hljs)
function gdscript(hljs: any) {
  return {
    name: "GDScript",
    case_insensitive: true,
    keywords: {
      keyword:
        "and in is not class_name extends func signal enum const static var if elif else for while match return await super self true false null",
      built_in:
        "Vector2 Vector2i Vector3 Vector3i Rect2 Transform2D Color Node Node2D Node3D Control Sprite2D Area2D RigidBody2D KinematicBody2D Input Engine SceneTree Tween Timer PackedScene Resource GD_OS",
    },
    contains: [
      hljs.COMMENT("#", "$", { relevance: 0 }),
      { scope: "string", begin: '"', end: '"', contains: [{ begin: "\\\\." }] },
      { scope: "string", begin: "'", end: "'" },
      { scope: "number", relevance: 0, begin: /\b\d[\d_]*(\.?[\d_]*(e[+-]?\d+)?)\b|0x[0-9a-fA-F_]+/ },
      { scope: "meta", begin: "@[A-Za-z_]+" },
      { scope: "title.function", begin: /\bfunc\s+/, end: /\(/, excludeEnd: true, keywords: "func" },
      { scope: "property", begin: /\$[A-Za-z_][\w\/]*|\$\"[^\"]*\"/ },
    ],
  };
}

let registered = false;
function ensureHljs() {
  if (registered) return;
  hljs.registerLanguage("gdscript", gdscript as any);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("lua", lua);
  hljs.registerLanguage("csharp", csharp);
  hljs.registerLanguage("cpp", cpp);
  hljs.registerLanguage("glsl", glsl);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("shell", shell);
  hljs.registerLanguage("text", plaintext);
  registered = true;
}

const LANGS = [
  ["gdscript", "GDScript"],
  ["typescript", "TypeScript"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["lua", "Lua"],
  ["csharp", "C#"],
  ["cpp", "C++"],
  ["glsl", "GLSL"],
  ["json", "JSON"],
  ["shell", "Shell"],
  ["text", "Text"],
];

export function CodeNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useApp((s) => s.toast);
  ensureHljs();

  const lang = data.lang ?? "gdscript";
  const code = data.code ?? "";

  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language: LANGS.some(([l]) => l === lang) ? lang : "text" }).value;
    } catch {
      const esc: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
      return code.replace(/[&<>]/g, (c: string) => esc[c] || c);
    }
  }, [code, lang]);

  return (
    <NodeShell id={id} kind="code">
      <div className="bg-[#0d1017] border border-line rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line bg-panel/70">
          <input
            className="nodrag nopan flex-1 bg-transparent outline-none text-xs font-semibold placeholder:text-faint min-w-0"
            placeholder="Snippet title"
            value={data.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <select
            className="nodrag nopan bg-transparent text-[10px] text-faint outline-none cursor-pointer"
            value={lang}
            onChange={(e) => patch({ lang: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {LANGS.map(([l, label]) => (
              <option key={l} value={l}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="p-1 rounded text-faint hover:text-accent2"
            title="Copy code"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                },
                () => toast("Copy failed", "error"),
              );
            }}
          >
            {copied ? <Check size={12} className="text-lime-400" /> : <Copy size={12} />}
          </button>
        </div>
        {editing ? (
          <textarea
            autoFocus
            className="nodrag nopan block w-full bg-transparent outline-none p-3 font-mono text-[11px] leading-relaxed resize-none min-h-24"
            value={code}
            onChange={(e) => patch({ code: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            spellCheck={false}
          />
        ) : (
          <div
            className="relative group/code cursor-text p-3 overflow-x-auto"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            <pre className="font-mono text-[11px] leading-relaxed m-0">
              <code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
            <div className="absolute top-1.5 right-2 opacity-0 group-hover/code:opacity-100 text-faint pointer-events-none">
              <Pencil size={11} />
            </div>
          </div>
        )}
      </div>
    </NodeShell>
  );
}
