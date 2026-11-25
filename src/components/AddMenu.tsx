// Add-card menu — floating bottom-left launcher plus the shared
// card list used by the right-click context menu.
import {
  StickyNote,
  NotebookPen,
  ListChecks,
  Code2,
  Image as ImageIcon,
  Music,
  Link2,
  LayoutGrid,
  Shapes,
  Plus,
  Command,
} from "lucide-react";
import type { NodeKind } from "../types";
import { Popover } from "./ui";
import type { LucideIcon } from "lucide-react";

export const CARD_DEFS: { kind: NodeKind; label: string; icon: LucideIcon; hint: string }[] = [
  { kind: "sticky", label: "Sticky note", icon: StickyNote, hint: "Quick thought" },
  { kind: "note", label: "Rich note", icon: NotebookPen, hint: "Headings, lists, checklists" },
  { kind: "task", label: "Task list", icon: ListChecks, hint: "Checkboxes + progress" },
  { kind: "code", label: "Code snippet", icon: Code2, hint: "GDScript, TS, Lua…" },
  { kind: "image", label: "Image", icon: ImageIcon, hint: "Upload or URL" },
  { kind: "audio", label: "Audio", icon: Music, hint: "SFX & music sketches" },
  { kind: "link", label: "Web link", icon: Link2, hint: "Reference URL" },
  { kind: "board", label: "Board", icon: LayoutGrid, hint: "Nested sub-board" },
  { kind: "shape", label: "Shape", icon: Shapes, hint: "Flowchart node" },
];

export const DEFAULT_WIDTHS: Record<NodeKind, number> = {
  sticky: 200,
  note: 290,
  task: 280,
  code: 340,
  image: 300,
  audio: 290,
  link: 260,
  board: 190,
  shape: 160,
};

export function CardMenuList({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  return (
    <div>
      {CARD_DEFS.map((c) => (
        <button
          key={c.kind}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-panel2 group"
          onClick={() => onAdd(c.kind)}
        >
          <c.icon size={14} className="text-accent shrink-0" />
          <span className="text-xs text-ink flex-1">{c.label}</span>
          <span className="text-[10px] text-faint group-hover:text-dim">{c.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function AddMenu({
  onAdd,
  onOpenPalette,
}: {
  onAdd: (kind: NodeKind) => void;
  onOpenPalette: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
      <Popover
        widthClass="w-64"
        trigger={({ toggle }) => (
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:bg-accent/85 transition-colors"
            title="Add a card"
          >
            <Plus size={15} /> Add card
          </button>
        )}
      >
        {({ close }) => (
          <div>
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-faint mb-1">
              Double-click canvas for a quick sticky
            </div>
            <CardMenuList
              onAdd={(kind) => {
                onAdd(kind);
                close();
              }}
            />
          </div>
        )}
      </Popover>
      <button
        onClick={onOpenPalette}
        className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl panel-surface text-dim text-xs hover:text-ink"
        title="Command palette (Ctrl+K)"
      >
        <Command size={13} /> K
      </button>
    </div>
  );
}
