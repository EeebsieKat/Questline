import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ExternalLink, Link2 } from "lucide-react";
import type { CardNode } from "../../types";
import { NodeShell, useCardData } from "./shell";

export function LinkNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const [showEdit, setShowEdit] = useState(!data.href);

  const open = () => {
    if (data.href) window.open(data.href, "_blank", "noopener,noreferrer");
  };

  return (
    <NodeShell id={id} kind="link">
      <div className="bg-panel border border-line rounded-xl shadow-lg p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
            <Link2 size={14} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              className="nodrag nopan w-full bg-transparent outline-none text-[13px] font-semibold placeholder:text-faint"
              placeholder="Link title"
              value={data.title ?? ""}
              onChange={(e) => patch({ title: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div className="text-[11px] text-accent2 truncate">{data.href || "no url yet"}</div>
          </div>
          {data.href ? (
            <button
              className="nodrag nopan p-1.5 rounded-md bg-panel2 border border-line text-dim hover:text-ink shrink-0"
              onClick={open}
              title="Open in new tab"
            >
              <ExternalLink size={13} />
            </button>
          ) : null}
        </div>

        <textarea
          rows={1}
          className="nodrag nopan w-full bg-transparent outline-none resize-none text-[11px] text-dim placeholder:text-faint mt-1.5"
          placeholder="Short description…"
          value={data.desc ?? ""}
          onChange={(e) => patch({ desc: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
        />

        {showEdit || !data.href ? (
          <input
            className="nodrag nopan w-full bg-canvas/60 border border-line rounded-md px-2 py-1 text-[11px] outline-none placeholder:text-faint focus-ring mt-1.5"
            placeholder="https://…"
            value={data.href ?? ""}
            onChange={(e) => patch({ href: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") setShowEdit(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            className="text-[10px] text-faint hover:text-dim mt-1 nodrag nopan"
            onClick={() => setShowEdit(true)}
          >
            edit url
          </button>
        )}
      </div>
    </NodeShell>
  );
}
