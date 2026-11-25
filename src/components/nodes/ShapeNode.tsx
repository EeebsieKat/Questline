import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import type { CardNode, ShapeKind } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { readableOn } from "../../lib/palette";

// Flowchart shapes: process / decision / start-end / input-output.
export function ShapeNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const kind: ShapeKind = (data.shape as ShapeKind) ?? "process";
  const color = data.color ?? "#22d3ee";
  const textColor = readableOn(color);

  const shapeStyle: Record<ShapeKind, string> = {
    process: "rounded-lg",
    decision: "",
    "start-end": "rounded-full",
    "input-output": "",
  };

  const innerStyle: React.CSSProperties =
    kind === "decision"
      ? { backgroundColor: color, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }
      : kind === "input-output"
        ? { backgroundColor: color, clipPath: "polygon(14% 0%, 100% 0%, 86% 100%, 0% 100%)" }
        : { backgroundColor: color };

  const startEdit = () => {
    setDraft(data.shapeText ?? "");
    setEditing(true);
  };
  const commit = () => {
    patch({ shapeText: draft });
    setEditing(false);
  };

  return (
    <NodeShell id={id} kind="shape" plain>
      <div className={`relative h-24 w-full ${shapeStyle[kind]}`}>
        <div className="absolute inset-0 shadow-lg" style={innerStyle} />
        <div className="absolute inset-0 flex items-center justify-center">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag nopan bg-transparent text-center text-xs font-semibold outline-none w-4/5"
              style={{ color: textColor }}
              placeholder="…"
            />
          ) : (
            <button
              onDoubleClick={startEdit}
              className="nodrag nopan max-w-[80%] truncate text-center text-xs font-semibold cursor-text"
              style={{ color: textColor }}
              title="Double-click to label"
            >
              {data.shapeText || "…"}
            </button>
          )}
        </div>
      </div>
    </NodeShell>
  );
}
