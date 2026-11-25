import type { NodeProps } from "@xyflow/react";
import type { CardNode } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { STICKY_COLORS, readableOn } from "../../lib/palette";

export function StickyNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const color = data.color ?? STICKY_COLORS[3].hex;
  const textColor = readableOn(color);

  return (
    <NodeShell id={id} kind="sticky">
      <div
        className="rounded-xl shadow-lg p-3 h-full flex"
        style={{ backgroundColor: color, transform: `rotate(${data.rot ?? 0}deg)` }}
      >
        <textarea
          className="nodrag nopan w-full h-full min-h-16 bg-transparent outline-none resize-none text-[13px] leading-snug placeholder:text-black/30"
          style={{ color: textColor }}
          placeholder="Write something…"
          value={data.text ?? ""}
          onChange={(e) => patch({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    </NodeShell>
  );
}
