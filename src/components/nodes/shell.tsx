// NodeShell — shared card frame: 4-way smart handles, hover
// toolbar (color / tags / duplicate / bring-to-front / delete),
// remote-selection glow, resize grip. Mirrors the original
// Questline node-shell.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { BringToFront, Copy, Palette, Tag as TagIcon, Trash2 } from "lucide-react";
import { useApp } from "../../lib/store";
import { snapshotData } from "../../lib/workspace";
import { CARD_COLORS, STICKY_COLORS, type Swatch } from "../../lib/palette";
import { Popover, Swatches } from "../ui";

export function SmartHandles() {
  const cls = "!min-w-[9px] !min-h-[9px] !w-[9px] !h-[9px]";
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className={cls} isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Right} id="right" className={cls} isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Bottom} id="bottom" className={cls} isConnectableStart isConnectableEnd />
      <Handle type="source" position={Position.Left} id="left" className={cls} isConnectableStart isConnectableEnd />
    </>
  );
}

/** Live snapshot of a card's Yjs data, without global re-renders. */
export function useCardData(nodeId: string) {
  const ws = useApp((s) => s.workspace)!;
  const [data, setData] = useState<Record<string, any>>(() => {
    const n = ws.nodesMap.get(nodeId);
    return n ? snapshotData(n.get("data")) : {};
  });

  useEffect(() => {
    const n = ws.nodesMap.get(nodeId);
    const d = n?.get("data");
    if (!d || typeof d.observeDeep !== "function") return;
    const fn = () => setData(snapshotData(d));
    d.observeDeep(fn);
    return () => d.unobserveDeep(fn);
  }, [ws, nodeId]);

  const patch = (p: Record<string, any>) => ws.updateNodeData(nodeId, p);
  return { data, patch, ws, nodeId };
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      className="p-1 rounded text-dim hover:text-ink hover:bg-panel2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TagPicker({ nodeId, close }: { nodeId: string; close: () => void }) {
  const { data, patch, ws } = useCardData(nodeId);
  const rev = useApp((s) => s.rev);
  void rev;
  const tags = Array.from(ws.tagsMap.values());
  const active: string[] = data.tags ?? [];

  const toggle = (id: string) => {
    patch({ tags: active.includes(id) ? active.filter((t) => t !== id) : [...active, id] });
  };

  return (
    <div>
      <div className="text-[11px] font-semibold text-dim mb-1.5 px-1">Tags</div>
      {tags.length === 0 ? (
        <div className="text-[11px] text-faint px-1 py-1">
          No tags yet — create some in the left sidebar.
        </div>
      ) : (
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {tags.map((t: any) => (
            <button
              key={t.get("id")}
              className="w-full flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-panel2 text-left"
              onClick={() => toggle(t.get("id"))}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.get("color") }} />
              <span className={`text-xs flex-1 ${active.includes(t.get("id")) ? "text-ink" : "text-dim"}`}>
                {t.get("name")}
              </span>
              {active.includes(t.get("id")) ? <span className="text-accent text-[10px]">on</span> : null}
            </button>
          ))}
        </div>
      )}
      <button className="mt-1.5 text-[10px] text-faint hover:text-dim px-1" onClick={close}>
        done
      </button>
    </div>
  );
}

function ResizeGrip({ nodeId }: { nodeId: string }) {
  const ws = useApp((s) => s.workspace)!;
  const { screenToFlowPosition } = useReactFlow();
  const last = useRef(0);

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = screenToFlowPosition({ x: e.clientX, y: e.clientY }).x;
    const n = ws.nodesMap.get(nodeId);
    const startW = n?.get("w") ?? 240;
    const move = (ev: PointerEvent) => {
      const cur = screenToFlowPosition({ x: ev.clientX, y: ev.clientY }).x;
      const w = Math.max(120, Math.round(startW + cur - startX));
      const now = Date.now();
      if (now - last.current > 90) {
        last.current = now;
        ws.updateNode(nodeId, { w });
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const cur = screenToFlowPosition({ x: ev.clientX, y: ev.clientY }).x;
      ws.updateNode(nodeId, { w: Math.max(120, Math.round(startW + cur - startX)) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="nodrag nopan absolute bottom-0.5 right-0.5 w-3.5 h-3.5 cursor-nwse-resize opacity-0 group-hover/card:opacity-70 hover:opacity-100"
      onPointerDown={onDown}
      title="Drag to resize"
    >
      <svg viewBox="0 0 10 10" className="w-full h-full">
        <path d="M9 1 1 9 M9 5 5 9" stroke="currentColor" strokeWidth="1.4" className="text-dim" />
      </svg>
    </div>
  );
}

export function NodeShell({
  id,
  kind,
  children,
  className = "",
  style,
  plain,
}: {
  id: string;
  kind: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  plain?: boolean;
}) {
  const ws = useApp((s) => s.workspace)!;
  const glow = useApp((s) => s.remoteSel[id]);
  const swatches: Swatch[] = kind === "sticky" ? STICKY_COLORS : CARD_COLORS;

  return (
    <div
      className={`group/card relative transition-shadow ${className}`}
      style={{ ...(glow ? ({ "--glow": glow } as CSSProperties) : {}), ...style }}
    >
      <SmartHandles />
      <div
        className={`card-body relative h-full ${
          glow ? "remote-glow" : ""
        } ${plain ? "" : "rounded-xl"}`}
      >
        {children}
      </div>

      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-panel/95 border border-line shadow-xl">
          <Popover
            widthClass="w-52"
            trigger={({ toggle }) => (
              <ToolButton title="Color" onClick={toggle}>
                <Palette size={12} />
              </ToolButton>
            )}
          >
            {({ close }) => (
              <Swatches
                list={swatches}
                onPick={(hex) => {
                  ws.updateNodeData(id, { color: hex });
                  close();
                }}
              />
            )}
          </Popover>
          <Popover
            widthClass="w-48"
            trigger={({ toggle }) => (
              <ToolButton title="Tags" onClick={toggle}>
                <TagIcon size={12} />
              </ToolButton>
            )}
          >
            {({ close }) => <TagPicker nodeId={id} close={close} />}
          </Popover>
          <ToolButton title="Duplicate" onClick={() => ws.duplicateNode(id)}>
            <Copy size={12} />
          </ToolButton>
          <ToolButton title="Bring to front" onClick={() => ws.bringToFront(id)}>
            <BringToFront size={12} />
          </ToolButton>
          <ToolButton title="Delete" onClick={() => ws.deleteNodes([id])}>
            <Trash2 size={12} />
          </ToolButton>
        </div>
      </div>

      <ResizeGrip nodeId={id} />
    </div>
  );
}
