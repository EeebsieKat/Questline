import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { CardNode, TaskItem } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { uid } from "../../lib/util";

export function TaskListNode({ id }: NodeProps<CardNode>) {
  const { data, patch, ws } = useCardData(id);
  const items: TaskItem[] = data.items ?? [];
  const [draft, setDraft] = useState("");
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const add = () => {
    if (!draft.trim()) return;
    patch({ items: [...items, { id: uid(), text: draft.trim(), done: false }] });
    setDraft("");
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ items: next });
  };

  return (
    <NodeShell id={id} kind="task">
      <div className="bg-panel border border-line rounded-xl shadow-lg p-3.5">
        <input
          className="nodrag nopan w-full bg-transparent outline-none text-sm font-bold placeholder:text-faint"
          placeholder="Task list title"
          value={data.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
        />

        <div className="mt-2 mb-1.5 h-1.5 rounded-full bg-canvas overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "#84cc16" : "linear-gradient(90deg,#7c8cff,#22d3ee)",
            }}
          />
        </div>
        <div className="text-[10px] text-faint mb-2 text-right">
          {done}/{items.length} done
        </div>

        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={it.id} className="group/item flex items-center gap-1.5 nodrag nopan">
              <input
                type="checkbox"
                className="accent-[#22d3ee]"
                checked={it.done}
                onChange={(e) => ws.updateListItem(id, "items", i, { done: e.target.checked })}
              />
              <input
                className={`flex-1 bg-transparent outline-none text-[12px] min-w-0 ${
                  it.done ? "line-through text-faint" : "text-ink"
                }`}
                value={it.text}
                placeholder="Task…"
                onChange={(e) => ws.updateListItem(id, "items", i, { text: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <div className="flex items-center opacity-0 group-hover/item:opacity-100">
                <button className="p-0.5 text-faint hover:text-ink" title="Move up" onClick={() => move(i, -1)}>
                  <ArrowUp size={10} />
                </button>
                <button className="p-0.5 text-faint hover:text-ink" title="Move down" onClick={() => move(i, 1)}>
                  <ArrowDown size={10} />
                </button>
                <button
                  className="p-0.5 text-faint hover:text-red-400"
                  title="Remove"
                  onClick={() => patch({ items: items.filter((_, x) => x !== i) })}
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 mt-2 nodrag nopan">
          <input
            className="flex-1 bg-canvas/60 border border-line rounded-md px-2 py-1 text-[11px] outline-none placeholder:text-faint focus-ring min-w-0"
            placeholder="Add task + Enter"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button className="p-1 rounded-md text-faint hover:text-accent" onClick={add} title="Add task">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </NodeShell>
  );
}
