import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  applyEdgeChanges,
  applyNodeChanges,
  useStore,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import { Magnet } from "lucide-react";
import { useApp } from "../lib/store";
import type { CardNode, FlowEdge, NodeKind } from "../types";
import { FlowEdge as FlowEdgeC } from "./FlowEdge";
import { StickyNode } from "./nodes/StickyNode";
import { TextNode } from "./nodes/TextNode";
import { TaskListNode } from "./nodes/TaskListNode";
import { CodeNode } from "./nodes/CodeNode";
import { ImageNode } from "./nodes/ImageNode";
import { AudioNode } from "./nodes/AudioNode";
import { LinkNode } from "./nodes/LinkNode";
import { BoardNode } from "./nodes/BoardNode";
import { ShapeNode } from "./nodes/ShapeNode";
import { AddMenu, CardMenuList, DEFAULT_WIDTHS } from "./AddMenu";
import { compressImage, fileToDataURL, throttle } from "../lib/util";
import { importWorkspace } from "../lib/exportImport";

const nodeTypes = {
  sticky: StickyNode,
  note: TextNode,
  task: TaskListNode,
  code: CodeNode,
  image: ImageNode,
  audio: AudioNode,
  link: LinkNode,
  board: BoardNode,
  shape: ShapeNode,
};

const edgeTypes = { ql: FlowEdgeC };

interface Guide {
  axis: "x" | "y";
  pos: number;
  from: number;
  to: number;
}

// ── remote cursors ────────────────────────────────────────────
function CursorLayer() {
  const ws = useApp((s) => s.workspace);
  const activeBoardId = useApp((s) => s.activeBoardId);
  const [states, setStates] = useState<[number, any][]>([]);
  const transform = useStore((s: any) => s.transform as [number, number, number]);

  useEffect(() => {
    if (!ws?.awareness) return;
    const fn = () => setStates(Array.from(ws.awareness.getStates().entries()));
    fn();
    ws.awareness.on("change", fn);
    return () => ws.awareness.off("change", fn);
  }, [ws]);

  if (!ws) return null;
  const [tx, ty, zoom] = transform;
  const cursors = states.filter(
    ([cid, st]) => cid !== ws.doc.clientID && st?.cursor && st.board === activeBoardId,
  );

  return (
    <>
      {cursors.map(([cid, st]) => {
        const x = st.cursor.x * zoom + tx;
        const y = st.cursor.y * zoom + ty;
        return (
          <div key={cid} className="cursor-dot" style={{ transform: `translate(${x}px, ${y}px)` }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))" }}>
              <path d="M1 1 L1 13 L4.2 9.8 L6.5 15 L8.6 14 L6.4 9 L11 9 Z" fill={st.user?.color ?? "#22d3ee"} stroke="#0b0e14" strokeWidth="1" />
            </svg>
            <span
              className="absolute left-3.5 top-3.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-black whitespace-nowrap"
              style={{ backgroundColor: st.user?.color ?? "#22d3ee" }}
            >
              {st.user?.name ?? "?"}
            </span>
          </div>
        );
      })}
    </>
  );
}

// ── alignment guides ──────────────────────────────────────────
function GuidesLayer({ guides }: { guides: Guide[] }) {
  const transform = useStore((s: any) => s.transform as [number, number, number]);
  const [tx, ty, zoom] = transform;
  return (
    <>
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <div
            key={i}
            className="guide-line"
            style={{ left: g.pos * zoom + tx, top: g.from * zoom + ty, width: 1, height: (g.to - g.from) * zoom }}
          />
        ) : (
          <div
            key={i}
            className="guide-line"
            style={{ top: g.pos * zoom + ty, left: g.from * zoom + tx, height: 1, width: (g.to - g.from) * zoom }}
          />
        ),
      )}
    </>
  );
}

// ── main canvas ───────────────────────────────────────────────
export function CanvasView() {
  const ws = useApp((s) => s.workspace)!;
  const activeBoardId = useApp((s) => s.activeBoardId);
  const rev = useApp((s) => s.rev);
  const snapOn = useApp((s) => s.snap);
  const setSnap = useApp((s) => s.setSnap);
  const setModal = useApp((s) => s.setModal);
  const toast = useApp((s) => s.toast);

  const [rfNodes, setRfNodes] = useState<CardNode[]>([]);
  const [rfEdges, setRfEdges] = useState<FlowEdge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; flow: { x: number; y: number } } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const rfRef = useRef<ReactFlowInstance<CardNode, FlowEdge> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<Set<string>>(new Set());
  const dataCache = useRef(new Map<string, { nodeId: string }>());
  const camAppliedRef = useRef(false);

  const getData = (id: string) => {
    let d = dataCache.current.get(id);
    if (!d) {
      d = { nodeId: id };
      dataCache.current.set(id, d);
    }
    return d;
  };

  // ── reconcile ydoc → react flow ────────────────────────────
  const lastBoardRef = useRef<string>("");
  useEffect(() => {
    // board switch → reset camera state
    if (lastBoardRef.current !== activeBoardId) {
      lastBoardRef.current = activeBoardId;
      camAppliedRef.current = false;
    }

    const nodes: CardNode[] = [];
    for (const n of ws.nodesMap.values()) {
      if (n.get("boardId") !== activeBoardId) continue;
      const id: string = n.get("id");
      nodes.push({
        id,
        type: n.get("type"),
        position: { x: n.get("x") ?? 0, y: n.get("y") ?? 0 },
        data: getData(id),
        style: { width: n.get("w") ?? 240, zIndex: n.get("z") ?? 0 },
      });
    }
    const edges: FlowEdge[] = [];
    for (const e of ws.edgesMap.values()) {
      if (e.get("boardId") !== activeBoardId) continue;
      const color: string | undefined = e.get("color") ?? undefined;
      const arrows: any = e.get("arrows") ?? "end";
      const marker = {
        type: MarkerType.ArrowClosed,
        color: color ?? "#7d8aa8",
        width: 15,
        height: 15,
      };
      edges.push({
        id: e.get("id"),
        source: e.get("source"),
        target: e.get("target"),
        sourceHandle: e.get("sourceHandle") ?? undefined,
        targetHandle: e.get("targetHandle") ?? undefined,
        type: "ql",
        data: {
          etype: e.get("etype") ?? "elbow",
          label: e.get("label") ?? "",
          color,
          animated: !!e.get("animated"),
          arrows,
        },
        markerStart: arrows === "start" || arrows === "both" ? marker : undefined,
        markerEnd: arrows === "end" || arrows === "both" ? marker : undefined,
      });
    }
    setRfNodes((prev) =>
      nodes.map((n) => {
        const cur = prev.find((p) => p.id === n.id);
        if (draggingRef.current.has(n.id) && cur) {
          return { ...n, position: cur.position, dragging: true };
        }
        return cur ? { ...n, selected: cur.selected, dragging: cur.dragging } : n;
      }),
    );
    setRfEdges((prev) =>
      edges.map((e) => {
        const cur = prev.find((p) => p.id === e.id);
        return cur ? { ...e, selected: cur.selected } : e;
      }),
    );

    // first paint of this board → restore camera or fit
    if (!camAppliedRef.current && nodes.length > 0 && rfRef.current) {
      camAppliedRef.current = true;
      try {
        const cams = JSON.parse(localStorage.getItem(`ql-cam-${ws.id}`) || "{}");
        const cam = cams[activeBoardId];
        if (cam) rfRef.current.setViewport(cam, { duration: 0 });
        else rfRef.current.fitView({ padding: 0.25, maxZoom: 1.3, duration: 200 });
      } catch {
        rfRef.current.fitView({ padding: 0.25, maxZoom: 1.3 });
      }
    }
  }, [rev, activeBoardId, ws]);

  // ── node/edge change handlers ──────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      const removes = changes.filter((c) => c.type === "remove") as any[];
      if (removes.length) ws.deleteNodes(removes.map((r) => r.id));
      setRfNodes((prev) => {
        const next = applyNodeChanges(changes, prev);
        for (const ch of changes as any[]) {
          if (ch.type !== "position" || !ch.id) continue;
          const n = next.find((x) => x.id === ch.id);
          if (!n) continue;
          if (ch.dragging === true) {
            draggingRef.current.add(ch.id);
            ws.setNodePosition(ch.id, n.position.x, n.position.y, 140);
          } else if (ch.dragging === false) {
            draggingRef.current.delete(ch.id);
            ws.updateNode(ch.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) });
          }
        }
        return next;
      });
    },
    [ws],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      for (const ch of changes) {
        if (ch.type === "remove") ws.deleteEdge(ch.id);
      }
      setRfEdges((prev) => applyEdgeChanges(changes, prev));
    },
    [ws],
  );

  const onConnect = useCallback(
    (conn: any) => {
      if (conn.source === conn.target) return;
      ws.addEdge(activeBoardId, conn.source, conn.target, conn.sourceHandle ?? "bottom", conn.targetHandle ?? "top");
    },
    [ws, activeBoardId],
  );

  const onSelectionChange = useCallback(
    ({ nodes, edges }: OnSelectionChangeParams) => {
      ws.setSelection(nodes.map((n) => n.id));
      setSelectedEdgeId(edges.length === 1 ? (edges[0].id as string) : null);
    },
    [ws],
  );

  // ── snapping + guides during drag ───────────────────────────
  const onNodeDrag = useCallback(
    (_e: any, _node: any, draggedNodes: CardNode[]) => {
      if (!snapOn || draggedNodes.length !== 1) {
        if (guides.length) setGuides([]);
        return;
      }
      const node = draggedNodes[0];
      const others = rfNodes.filter((n) => n.id !== node.id);
      const zoom = rfRef.current?.getZoom() ?? 1;
      const th = 6 / zoom;
      const w = node.measured?.width ?? (node.style?.width as number) ?? 200;
      const h = node.measured?.height ?? 120;

      let bestDx: number | null = null;
      let bestDy: number | null = null;
      let guideX: Guide | null = null;
      let guideY: Guide | null = null;

      const myXs = [node.position.x, node.position.x + w / 2, node.position.x + w];
      const myYs = [node.position.y, node.position.y + h / 2, node.position.y + h];

      for (const o of others) {
        const ow = o.measured?.width ?? 200;
        const oh = o.measured?.height ?? 100;
        const oXs = [o.position.x, o.position.x + ow / 2, o.position.x + ow];
        const oYs = [o.position.y, o.position.y + oh / 2, o.position.y + oh];
        for (const m of myXs) {
          for (const t of oXs) {
            const d = t - m;
            if (Math.abs(d) <= th && (bestDx === null || Math.abs(d) < Math.abs(bestDx))) {
              bestDx = d;
              const from = Math.min(node.position.y, o.position.y);
              const to = Math.max(node.position.y + h, o.position.y + oh);
              guideX = { axis: "x", pos: t, from, to };
            }
          }
        }
        for (const m of myYs) {
          for (const t of oYs) {
            const d = t - m;
            if (Math.abs(d) <= th && (bestDy === null || Math.abs(d) < Math.abs(bestDy))) {
              bestDy = d;
              const from = Math.min(node.position.x, o.position.x);
              const to = Math.max(node.position.x + w, o.position.x + ow);
              guideY = { axis: "y", pos: t, from, to };
            }
          }
        }
      }

      if (bestDx !== null || bestDy !== null) {
        const dx = bestDx ?? 0;
        const dy = bestDy ?? 0;
        setRfNodes((nds) =>
          nds.map((n) =>
            n.id === node.id ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n,
          ),
        );
      }
      setGuides([guideX, guideY].filter(Boolean) as Guide[]);
    },
    [snapOn, rfNodes, guides.length],
  );

  // ── camera persistence ──────────────────────────────────────
  const onMoveEnd = useCallback(
    (_e: any, viewport: Viewport) => {
      if (!camAppliedRef.current) return;
      try {
        const cams = JSON.parse(localStorage.getItem(`ql-cam-${ws.id}`) || "{}");
        cams[activeBoardId] = viewport;
        localStorage.setItem(`ql-cam-${ws.id}`, JSON.stringify(cams));
      } catch {
        /* noop */
      }
    },
    [ws.id, activeBoardId],
  );

  // ── add cards ───────────────────────────────────────────────
  const flowCenter = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const rf = rfRef.current;
    if (rect && rf) return rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return { x: 120, y: 120 };
  };

  const addCard = (kind: NodeKind, at?: { x: number; y: number }) => {
    const pos = at ?? flowCenter();
    const jitter = () => (Math.random() * 60 - 30);
    if (kind === "board") {
      const boardId = ws.addBoard("New board", "📋", activeBoardId || null);
      ws.addNode(activeBoardId, "board", pos.x + jitter(), pos.y + jitter(), { targetBoardId: boardId }, 190);
      return;
    }
    const extras: Record<string, any> = {};
    if (kind === "sticky") extras.color = "#bae6fd";
    if (kind === "code") {
      extras.lang = "gdscript";
      extras.title = "Snippet";
    }
    if (kind === "shape") {
      extras.shape = "process";
      extras.shapeText = "State";
    }
    ws.addNode(activeBoardId, kind, pos.x + jitter(), pos.y + jitter(), extras, DEFAULT_WIDTHS[kind]);
  };

  // ── double-click empty canvas → sticky ──────────────────────
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".react-flow__node") || t.closest("input,textarea")) return;
      const rf = rfRef.current;
      if (!rf) return;
      addCard("sticky", rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ws, activeBoardId],
  );

  // ── file drop ───────────────────────────────────────────────
  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const rf = rfRef.current;
      if (!rf) return;
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const files = Array.from(e.dataTransfer.files);
      for (const f of files) {
        if (f.type.startsWith("image/")) {
          if (f.size > 4_500_000) {
            toast("Image too large (over 4.5 MB) — use a URL instead.", "error");
            continue;
          }
          try {
            const url = await compressImage(f);
            ws.addNode(activeBoardId, "image", pos.x + 20, pos.y + 20, { url, caption: "" }, 300);
          } catch {
            toast("Could not read that image.", "error");
          }
        } else if (f.type.startsWith("audio/")) {
          if (f.size > 1_400_000) {
            toast("Audio too large — keep uploads under ~1.4 MB (use a URL).", "error");
            continue;
          }
          const url = await fileToDataURL(f);
          ws.addNode(activeBoardId, "audio", pos.x + 20, pos.y + 20, { url, name: f.name }, 290);
        } else if (f.name.endsWith(".json")) {
          try {
            const text = await f.text();
            const res = importWorkspace(ws, text);
            toast(res.ok ? "Backup imported — check the board list." : res.error!, res.ok ? "success" : "error");
          } catch {
            toast("Could not read that file.", "error");
          }
        } else {
          toast(`"${f.name}" — only images, audio and Questline backups can be dropped.`, "error");
        }
      }
    },
    [ws, activeBoardId, toast],
  );

  // ── local cursor broadcast ──────────────────────────────────
  const onMouseMove = useMemo(
    () =>
      throttle((e: React.MouseEvent) => {
        const rf = rfRef.current;
        if (!rf) return;
        ws.setCursor(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }, 50),
    [ws],
  );

  // ── keyboard shortcuts (when no modal is open) ──────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("input,textarea,select,[contenteditable='true']")) return;
      if (useApp.getState().modal) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ws.undo.redo();
        else ws.undo.undo();
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        ws.undo.redo();
      } else if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const selected = rfNodes.filter((n) => n.selected).map((n) => n.id);
        for (const id of selected) ws.duplicateNode(id);
      } else if (e.key === "Escape") {
        setCtxMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ws, rfNodes]);

  const selectedEdge = selectedEdgeId ? ws.edgesMap.get(selectedEdgeId) : null;

  return (
    <div
      ref={wrapRef}
      className="flex-1 min-w-0 relative"
      onMouseMove={onMouseMove}
      onMouseLeave={() => ws.setCursor(null)}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest(".react-flow__node")) return; // let node textareas work
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={() => setGuides([])}
        onMoveEnd={onMoveEnd}
        onInit={(rf) => {
          rfRef.current = rf;
          // if nodes already loaded (board switch back), fit now
          if (rfNodes.length > 0) {
            camAppliedRef.current = true;
            try {
              const cams = JSON.parse(localStorage.getItem(`ql-cam-${ws.id}`) || "{}");
              const cam = cams[activeBoardId];
              if (cam) rf.setViewport(cam, { duration: 0 });
              else rf.fitView({ padding: 0.25, maxZoom: 1.3 });
            } catch {
              rf.fitView({ padding: 0.25, maxZoom: 1.3 });
            }
          }
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          const rf = rfRef.current;
          const flow = rf ? rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) : { x: 100, y: 100 };
          setCtxMenu({ x: e.clientX, y: e.clientY, flow });
        }}
        onPaneClick={() => setCtxMenu(null)}
        panOnScroll
        panOnDrag={[1]}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={3}
        snapToGrid={snapOn}
        snapGrid={[16, 16]}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Shift", "Meta"]}
        proOptions={{ hideAttribution: false }}
        className="bg-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color="#232a3c" />
        <Controls showInteractive={false} position="bottom-left" style={{ left: 16, bottom: 64 }} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === "sticky" ? "#22d3ee" : "#3a4361")}
          maskColor="rgb(11 14 20 / 0.78)"
          style={{ width: 170, height: 110 }}
        />
        <Panel position="top-right">
          <button
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg border text-[11px] ${
              snapOn
                ? "bg-accent/15 border-accent/40 text-accent"
                : "bg-panel/80 border-line text-dim hover:text-ink"
            }`}
            onClick={() => setSnap(!snapOn)}
            title="Snap to grid + smart alignment guides"
          >
            <Magnet size={12} /> Snap
          </button>
        </Panel>
        <CursorLayer />
        <GuidesLayer guides={guides} />
      </ReactFlow>

      <AddMenu onAdd={addCard} onOpenPalette={() => setModal("palette")} />

      {ctxMenu ? (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setCtxMenu(null)} onContextMenu={(e) => e.preventDefault()} />
          <div
            className="fixed z-50 panel-surface rounded-xl p-1.5 w-52 shadow-2xl fade-in"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 220),
              top: Math.min(ctxMenu.y, window.innerHeight - 380),
            }}
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-faint">Add here</div>
            <CardMenuList onAdd={(kind) => addCard(kind, ctxMenu.flow)} />
          </div>
        </>
      ) : null}

      {selectedEdge ? (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 panel-surface rounded-xl px-3 py-2 flex items-center gap-2.5 shadow-2xl fade-in flex-wrap justify-center">
          <input
            className="bg-canvas border border-line rounded-md px-2 py-1 text-[11px] w-28 outline-none focus-ring"
            placeholder="Label…"
            defaultValue={selectedEdge.get("label") ?? ""}
            key={`${selectedEdgeId}-label`}
            onKeyDown={(e) => {
              if (e.key === "Enter") ws.updateEdge(selectedEdgeId!, { label: (e.target as HTMLInputElement).value });
            }}
            onBlur={(e) => ws.updateEdge(selectedEdgeId!, { label: e.target.value })}
          />
          <div className="flex items-center gap-1">
            {["#7d8aa8", "#f87171", "#fb923c", "#4ade80", "#22d3ee", "#60a5fa", "#a78bfa"].map((c) => (
              <button
                key={c}
                className={`h-4 w-4 rounded ${selectedEdge.get("color") === c ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => ws.updateEdge(selectedEdgeId!, { color: c })}
                title="Connector color"
              />
            ))}
          </div>
          <select
            className="bg-canvas border border-line rounded-md px-1.5 py-1 text-[11px] text-ink outline-none"
            value={selectedEdge.get("etype") ?? "elbow"}
            onChange={(e) => ws.updateEdge(selectedEdgeId!, { etype: e.target.value })}
            title="Line style"
          >
            <option value="elbow">Elbow</option>
            <option value="steps">Steps</option>
            <option value="bezier">Bezier</option>
            <option value="straight">Straight</option>
          </select>
          <select
            className="bg-canvas border border-line rounded-md px-1.5 py-1 text-[11px] text-ink outline-none"
            value={selectedEdge.get("arrows") ?? "end"}
            onChange={(e) => ws.updateEdge(selectedEdgeId!, { arrows: e.target.value })}
            title="Arrowheads"
          >
            <option value="end">→</option>
            <option value="both">↔</option>
            <option value="start">←</option>
            <option value="none">—</option>
          </select>
          <button
            className={`px-2 py-1 rounded-md text-[11px] border ${
              selectedEdge.get("animated")
                ? "bg-accent/15 border-accent/40 text-accent"
                : "bg-panel2 border-line text-dim hover:text-ink"
            }`}
            onClick={() => ws.updateEdge(selectedEdgeId!, { animated: selectedEdge.get("animated") ? 0 : 1 })}
            title="Animated dashes"
          >
            ⚡ animated
          </button>
          <button
            className="px-2 py-1 rounded-md text-[11px] bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
            onClick={() => ws.deleteEdge(selectedEdgeId!)}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
