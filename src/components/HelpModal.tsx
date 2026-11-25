import { Modal, Kbd } from "./ui";
import { useApp } from "../lib/store";

const SHORTCUTS: [string, string][] = [
  ["Double-click canvas", "New sticky note"],
  ["Right-click canvas", "Add any card here"],
  ["Drag from edge dots", "Connect cards"],
  ["Double-click connector", "Rename it inline"],
  ["Ctrl/Cmd + K", "Command palette"],
  ["Ctrl/Cmd + Z", "Undo"],
  ["Ctrl/Cmd + Shift + Z", "Redo"],
  ["Ctrl/Cmd + D", "Duplicate selection"],
  ["Delete / Backspace", "Remove selection"],
  ["Shift + click", "Multi-select"],
  ["Drag empty space", "Marquee select"],
  ["Space + drag / middle drag", "Pan"],
  ["Drop image/audio files", "Instant media cards"],
];

export function HelpModal() {
  const setModal = useApp((s) => s.setModal);
  return (
    <Modal title="Help & shortcuts" onClose={() => setModal(null)} wide>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-1.5 border-b border-line/50">
            <Kbd>{k}</Kbd>
            <span className="text-xs text-dim text-right">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 text-xs text-dim leading-relaxed">
        <p className="mb-2">
          <span className="text-ink font-medium">Where is my data?</span> Everything is saved in
          your browser (IndexedDB) the moment you edit, and synced live peer-to-peer with anyone
          on the same share link. If the owner enabled cloud sync, edits also persist to
          Firestore so nobody misses anything.
        </p>
        <p className="mb-2">
          <span className="text-ink font-medium">Nested boards:</span> add a Board card from the
          add menu and double-click it to drill in. Sub-boards also live in the left sidebar.
        </p>
        <p>
          <span className="text-ink font-medium">Flowcharts:</span> use Shape cards (process /
          decision / start-end / input-output) and connect anything — great for state machines
          and dialogue trees.
        </p>
      </div>
    </Modal>
  );
}
