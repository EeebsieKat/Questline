import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, Tag } from "lucide-react";
import { useApp } from "../lib/store";
import { Button, Input, Popover } from "./ui";
import { TAG_COLOR_POOL } from "../lib/palette";

function BoardRow({ boardId, depth }: { boardId: string; depth: number }) {
  const ws = useApp((s) => s.workspace)!;
  const rev = useApp((s) => s.rev);
  const activeBoardId = useApp((s) => s.activeBoardId);
  const setActiveBoard = useApp((s) => s.setActiveBoard);
  const toast = useApp((s) => s.toast);
  const [open, setOpen] = useState(depth < 1);
  const [renaming, setRenaming] = useState(false);
  void rev;

  const b = ws.boardsMap.get(boardId);
  if (!b) return null;
  const children = ws.boardChildren(boardId);
  const isActive = activeBoardId === boardId;

  const del = () => {
    const title = b.get("title");
    const count = countSubtree(ws, boardId);
    if (
      confirm(
        `Delete "${title}"${count > 1 ? ` and its ${count - 1} sub-board(s)` : ""}? All cards on it are removed for everyone.`,
      )
    ) {
      const parent = b.get("parentId");
      ws.deleteBoard(boardId);
      if (isActive && parent) setActiveBoard(parent);
      toast(`Deleted "${title}"`, "info");
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 cursor-pointer ${
          isActive ? "bg-accent/15 text-ink" : "hover:bg-panel2 text-dim hover:text-ink"
        }`}
        style={{ paddingLeft: 4 + depth * 14 }}
        onClick={() => setActiveBoard(boardId)}
      >
        <button
          className="p-0.5 rounded text-faint hover:text-ink"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          {children.length ? (
            open ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span className="inline-block w-[13px]" />
          )}
        </button>
        <span className="text-sm w-5 text-center">{b.get("icon")}</span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={b.get("title")}
            className="flex-1 bg-transparent outline-none text-sm min-w-0 py-1"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              if (e.target.value.trim()) ws.updateBoard(boardId, { title: e.target.value.trim().slice(0, 60) });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span className="flex-1 truncate text-sm py-1.5" onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
            {b.get("title")}
          </span>
        )}
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-faint hover:text-accent"
          title="Add sub-board"
          onClick={(e) => {
            e.stopPropagation();
            const id = ws.addBoard("New board", "📋", boardId);
            setOpen(true);
            setActiveBoard(id);
          }}
        >
          <Plus size={12} />
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-faint hover:text-red-400"
          title="Delete board"
          onClick={(e) => {
            e.stopPropagation();
            del();
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open
        ? children
            .slice()
            .sort((a: any, b2: any) => String(a.get("title")).localeCompare(String(b2.get("title"))))
            .map((c: any) => <BoardRow key={c.get("id")} boardId={c.get("id")} depth={depth + 1} />)
        : null}
    </div>
  );
}

function countSubtree(ws: any, id: string): number {
  let n = 1;
  for (const b of ws.boardsMap.values()) {
    if (b.get("parentId") === id) n += countSubtree(ws, b.get("id"));
  }
  return n;
}

function TagsManager() {
  const ws = useApp((s) => s.workspace)!;
  const rev = useApp((s) => s.rev);
  const toast = useApp((s) => s.toast);
  const [name, setName] = useState("");
  void rev;
  const tags = Array.from(ws.tagsMap.values());

  return (
    <div>
      <div className="text-[11px] font-semibold text-dim mb-2 px-1">Tags</div>
      <div className="max-h-44 overflow-y-auto">
        {tags.map((t: any) => (
          <div key={t.get("id")} className="group flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-panel2">
            <button
              className="h-3 w-3 rounded-full border border-white/20 shrink-0"
              style={{ backgroundColor: t.get("color") }}
              title="Click to change color"
              onClick={() => {
                const next = TAG_COLOR_POOL[(TAG_COLOR_POOL.indexOf(t.get("color")) + 1) % TAG_COLOR_POOL.length];
                ws.updateTag(t.get("id"), { color: next });
              }}
            />
            <span className="flex-1 text-xs text-dim group-hover:text-ink truncate">{t.get("name")}</span>
            <button
              className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-400"
              onClick={() => {
                ws.deleteTag(t.get("id"));
                toast(`Deleted tag "${t.get("name")}"`, "info");
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {tags.length === 0 ? <div className="text-[11px] text-faint px-1.5 py-1">No tags yet</div> : null}
      </div>
      <form
        className="flex gap-1.5 mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          ws.addTag(name.trim().slice(0, 20), TAG_COLOR_POOL[tags.length % TAG_COLOR_POOL.length]);
          setName("");
        }}
      >
        <Input
          className="!h-7 !text-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag…"
        />
        <Button className="!h-7 !px-2" type="submit" size="sm">
          <Plus size={12} />
        </Button>
      </form>
    </div>
  );
}

export function BoardDock() {
  const dockOpen = useApp((s) => s.dockOpen);
  const ws = useApp((s) => s.workspace)!;
  const rev = useApp((s) => s.rev);
  const setActiveBoard = useApp((s) => s.setActiveBoard);
  const [filter, setFilter] = useState("");
  void rev;

  const roots = useMemo(() => {
    const all = Array.from(ws.boardsMap.values());
    if (!filter.trim()) return ws.boardChildren(null);
    const q = filter.toLowerCase();
    return all.filter((b: any) => String(b.get("title")).toLowerCase().includes(q));
  }, [ws, filter, rev]);

  if (!dockOpen) return null;

  return (
    <aside className="w-60 shrink-0 border-r border-line bg-panel/70 backdrop-blur flex flex-col z-10">
      <div className="p-2.5 border-b border-line">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            className="!h-8 !pl-7 !text-xs"
            placeholder="Filter boards…  (Ctrl+K)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {roots.map((b: any) => (
          <BoardRow key={b.get("id")} boardId={b.get("id")} depth={0} />
        ))}
      </div>
      <div className="p-2.5 border-t border-line space-y-2">
        <Button
          className="w-full"
          size="sm"
          onClick={() => setActiveBoard(ws.addBoard("New board", "📋", null))}
        >
          <Plus size={13} /> New board
        </Button>
        <Popover
          widthClass="w-52"
          trigger={({ toggle }) => (
            <Button className="w-full" size="sm" variant="ghost" onClick={toggle}>
              <Tag size={13} /> Manage tags
            </Button>
          )}
        >
          {() => <TagsManager />}
        </Popover>
      </div>
    </aside>
  );
}
