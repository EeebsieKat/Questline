import { useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import type { CardNode, NoteBlock, NoteBlockType } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { uid } from "../../lib/util";

const BLOCK_STYLES: Record<NoteBlockType, string> = {
  h1: "text-base font-bold",
  h2: "text-sm font-bold",
  h3: "text-xs font-semibold uppercase tracking-wide",
  p: "text-[13px]",
  bullet: "text-[13px]",
  check: "text-[13px]",
};

const TYPE_OPTIONS: { type: NoteBlockType; label: string }[] = [
  { type: "h1", label: "Heading 1" },
  { type: "h2", label: "Heading 2" },
  { type: "h3", label: "Heading 3" },
  { type: "p", label: "Paragraph" },
  { type: "bullet", label: "Bullet" },
  { type: "check", label: "Checklist" },
];

function Block({
  nodeId,
  index,
  block,
  onEnter,
  onBackspaceEmpty,
  focusSeq,
}: {
  nodeId: string;
  index: number;
  block: NoteBlock;
  onEnter: (idx: number) => void;
  onBackspaceEmpty: (idx: number) => void;
  focusSeq: { idx: number; seq: number } | null;
}) {
  const { data, patch, ws } = useCardData(nodeId);
  const ref = useRef<HTMLTextAreaElement>(null);
  const blocks: NoteBlock[] = data.blocks ?? [];

  // focus this block when freshly inserted
  if (focusSeq && focusSeq.idx === index && ref.current && document.activeElement !== ref.current) {
    ref.current.focus();
  }

  const setText = (text: string) => ws.updateListItem(nodeId, "blocks", index, { text });

  const input = (
    <textarea
      ref={ref}
      rows={1}
      className={`nodrag nopan w-full bg-transparent outline-none resize-none placeholder:text-faint ${BLOCK_STYLES[block.type]}`}
      value={block.text}
      placeholder={block.type === "check" ? "To-do…" : "Type…"}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onEnter(index);
        }
        if (e.key === "Backspace" && !block.text && blocks.length > 1) {
          e.preventDefault();
          onBackspaceEmpty(index);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );

  const typeSwitch = (
    <div className="group/tbtn relative shrink-0">
      <ChevronDown size={12} className="text-faint mt-1 cursor-pointer opacity-0 group-hover/blk:opacity-100" />
      <div className="absolute left-0 top-3 z-30 hidden group-hover/tbtn-hover:block">
        <div className="panel-surface rounded-lg p-1 shadow-xl w-32">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.type}
              className="w-full text-left px-2 py-1 rounded text-[11px] text-dim hover:text-ink hover:bg-panel2"
              onClick={() => {
                const next = blocks.map((b, i) => (i === index ? { ...b, type: o.type } : b));
                patch({ blocks: next });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (block.type === "bullet") {
    return (
      <div className="group/blk flex items-start gap-1.5">
        <span className="text-dim text-xs mt-0.5 select-none">•</span>
        {input}
        {typeSwitch}
      </div>
    );
  }
  if (block.type === "check") {
    return (
      <div className="group/blk flex items-start gap-1.5">
        <input
          type="checkbox"
          className="nodrag nopan mt-1 accent-[#22d3ee]"
          checked={!!block.checked}
          onChange={(e) => ws.updateListItem(nodeId, "blocks", index, { checked: e.target.checked })}
        />
        <div className={`flex-1 ${block.checked ? "opacity-60" : ""}`}>{input}</div>
        {typeSwitch}
      </div>
    );
  }
  return (
    <div className="group/blk flex items-start gap-1.5">
      {input}
      {typeSwitch}
    </div>
  );
}

export function TextNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const blocks: NoteBlock[] = data.blocks ?? [];
  const [focus, setFocus] = useState<{ idx: number; seq: number } | null>(null);
  const lastSeq = useRef(0);

  const insertBlock = (idx: number) => {
    const cur = blocks[idx];
    const next: NoteBlock[] = [...blocks];
    next.splice(idx + 1, 0, {
      id: uid(),
      type: cur?.type === "check" || cur?.type === "bullet" ? cur.type : "p",
      text: "",
    });
    patch({ blocks: next });
    lastSeq.current += 1;
    setFocus({ idx: idx + 1, seq: lastSeq.current });
  };

  const removeBlock = (idx: number) => {
    if (blocks.length <= 1) return;
    patch({ blocks: blocks.filter((_, i) => i !== idx) });
    lastSeq.current += 1;
    setFocus({ idx: Math.max(0, idx - 1), seq: lastSeq.current });
  };

  return (
    <NodeShell id={id} kind="note">
      <div className="bg-panel border border-line rounded-xl shadow-lg p-3.5">
        <input
          className="nodrag nopan w-full bg-transparent outline-none text-sm font-bold placeholder:text-faint mb-1.5"
          placeholder="Untitled note"
          value={data.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <div className="space-y-0.5">
          {blocks.map((b, i) => (
            <Block
              key={b.id}
              nodeId={id}
              index={i}
              block={b}
              onEnter={insertBlock}
              onBackspaceEmpty={removeBlock}
              focusSeq={focus}
            />
          ))}
        </div>
        <button
          className="nodrag nopan text-[11px] text-faint hover:text-dim mt-1.5"
          onClick={() => insertBlock(blocks.length - 1)}
        >
          + add block
        </button>
      </div>
    </NodeShell>
  );
}
