import type { NodeProps } from "@xyflow/react";
import { ChevronRight } from "lucide-react";
import type { CardNode } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { useApp } from "../../lib/store";

// A card that represents (and opens) a nested sub-board.
export function BoardNode({ id }: NodeProps<CardNode>) {
  const { data } = useCardData(id);
  const ws = useApp((s) => s.workspace)!;
  const rev = useApp((s) => s.rev);
  const setActiveBoard = useApp((s) => s.setActiveBoard);
  void rev;

  const target = data.targetBoardId ? ws.boardsMap.get(data.targetBoardId) : null;
  let count = 0;
  if (target) {
    for (const n of ws.nodesMap.values()) if (n.get("boardId") === data.targetBoardId) count++;
  }

  return (
    <div className="group/card relative" onDoubleClick={() => target && setActiveBoard(target.get("id"))}>
      <NodeShell id={id} kind="board" plain>
        <div
          className={`rounded-xl shadow-lg overflow-hidden border ${
            target ? "border-accent/40 bg-gradient-to-b from-accent/15 to-panel cursor-pointer" : "border-red-500/40 bg-panel"
          }`}
          title={target ? "Double-click to open this board" : "This board was deleted"}
        >
          <div className="p-3 flex items-center gap-2.5">
            <span className="text-xl">{target ? target.get("icon") : "❔"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">
                {target ? target.get("title") : "Missing board"}
              </div>
              <div className="text-[10px] text-dim">
                {target ? `${count} card${count === 1 ? "" : "s"} · double-click to open` : "deleted"}
              </div>
            </div>
            {target ? <ChevronRight size={14} className="text-accent" /> : null}
          </div>
        </div>
      </NodeShell>
    </div>
  );
}
