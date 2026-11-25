import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { Modal } from "./ui";
import { CARD_DEFS } from "./AddMenu";
import { exportWorkspace, importWorkspace } from "../lib/exportImport";
import { downloadFile } from "../lib/util";
import { Command, CornerDownLeft } from "lucide-react";

interface Entry {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  run: () => void;
}

export function CommandPalette() {
  const ws = useApp((s) => s.workspace)!;
  const rev = useApp((s) => s.rev);
  const setModal = useApp((s) => s.setModal);
  const setActiveBoard = useApp((s) => s.setActiveBoard);
  const snap = useApp((s) => s.snap);
  const setSnap = useApp((s) => s.setSnap);
  const toggleDock = useApp((s) => s.toggleDock);
  const toast = useApp((s) => s.toast);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  void rev;

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];

    for (const b of ws.boardsMap.values()) {
      list.push({
        id: `board-${b.get("id")}`,
        label: `${b.get("icon")} ${b.get("title")}`,
        hint: "board",
        run: () => setActiveBoard(b.get("id")),
      });
    }

    for (const c of CARD_DEFS) {
      list.push({
        id: `add-${c.kind}`,
        label: `Add ${c.label.toLowerCase()}`,
        hint: c.hint,
        icon: "+",
        run: () => window.dispatchEvent(new CustomEvent("ql-add-card", { detail: c.kind })),
      });
    }

    list.push(
      { id: "new-board", label: "New board", icon: "+", run: () => setActiveBoard(ws.addBoard("New board", "📋", null)) },
      { id: "new-sub", label: "New sub-board here", icon: "+", run: () => setActiveBoard(ws.addBoard("New board", "📋", useApp.getState().activeBoardId)) },
      { id: "share", label: "Share this workspace", run: () => setModal("share") },
      { id: "settings", label: "Open settings", run: () => setModal("settings") },
      {
        id: "export",
        label: "Export backup (JSON)",
        run: () => {
          downloadFile(`questline-backup-${ws.id}.json`, exportWorkspace(ws));
          toast("Backup downloaded.", "success");
        },
      },
      { id: "import", label: "Import backup…", run: () => fileRef.current?.click() },
      { id: "snap", label: snap ? "Turn off snap to grid" : "Turn on snap to grid", run: () => setSnap(!snap) },
      { id: "dock", label: "Toggle board sidebar", run: () => toggleDock() },
      { id: "undo", label: "Undo", run: () => ws.undo.undo() },
      { id: "redo", label: "Redo", run: () => ws.undo.redo() },
    );

    return list;
  }, [ws, snap, setSnap, setModal, setActiveBoard, toggleDock, toast]);

  // "add card" actions need to run after the palette closes (they
  // need the canvas), so dispatch a custom event the canvas listens to
  useEffect(() => {
    const onAddCard = (e: Event) => {
      const kind = (e as CustomEvent).detail;
      const b = useApp.getState().activeBoardId;
      const jitter = () => Math.random() * 60 - 30;
      const extras: Record<string, any> = {};
      if (kind === "sticky") extras.color = "#bae6fd";
      if (kind === "code") { extras.lang = "gdscript"; extras.title = "Snippet"; }
      if (kind === "shape") { extras.shape = "process"; extras.shapeText = "State"; }
      if (kind === "board") {
        const boardId = ws.addBoard("New board", "📋", b || null);
        ws.addNode(b, "board", 140 + jitter(), 140 + jitter(), { targetBoardId: boardId }, 190);
        return;
      }
      const widths: Record<string, number> = {
        sticky: 200, note: 290, task: 280, code: 340, image: 300, audio: 290, link: 260, board: 190, shape: 160,
      };
      ws.addNode(b, kind, 140 + jitter(), 140 + jitter(), extras, widths[kind] ?? 240);
    };
    window.addEventListener("ql-add-card", onAddCard);
    return () => window.removeEventListener("ql-add-card", onAddCard);
  }, [ws]);

  const filtered = entries.filter((e) => e.label.toLowerCase().includes(q.toLowerCase()));
  const safeActive = Math.min(active, Math.max(0, filtered.length - 1));

  const runEntry = (e: Entry) => {
    setModal(null);
    setTimeout(() => e.run(), 10);
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Command size={13} /> Command palette
        </span>
      }
      onClose={() => setModal(null)}
      wide
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, filtered.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          }
          if (e.key === "Enter" && filtered[safeActive]) {
            e.preventDefault();
            runEntry(filtered[safeActive]);
          }
        }}
        placeholder="Jump to a board or run an action…"
        className="w-full bg-canvas border border-line rounded-lg px-3 h-10 text-sm text-ink placeholder:text-faint outline-none focus-ring mb-3"
      />
      <div ref={listRef} className="max-h-80 overflow-y-auto -mx-1 px-1">
        {filtered.map((e, i) => (
          <button
            key={e.id}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left ${
              i === safeActive ? "bg-accent/15" : "hover:bg-panel2"
            }`}
            onMouseEnter={() => setActive(i)}
            onClick={() => runEntry(e)}
          >
            {e.icon ? (
              <span className="text-accent font-bold text-xs w-4 text-center">{e.icon}</span>
            ) : (
              <span className="w-4 text-center text-[10px] text-faint">↳</span>
            )}
            <span className="text-[13px] text-ink flex-1 truncate">{e.label}</span>
            {e.hint ? <span className="text-[10px] text-faint">{e.hint}</span> : null}
            {i === safeActive ? <CornerDownLeft size={11} className="text-faint" /> : null}
          </button>
        ))}
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-faint py-6">Nothing matches “{q}”</div>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            const res = importWorkspace(ws, await f.text());
            toast(res.ok ? "Backup imported — check the board list." : res.error!, res.ok ? "success" : "error");
          }
          e.target.value = "";
        }}
      />
    </Modal>
  );
}
