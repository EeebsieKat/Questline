import { useApp } from "../lib/store";
import { Share2, Settings, HelpCircle, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "./ui";
import { BOARD_EMOJIS } from "../lib/palette";
import { useState } from "react";

function SyncPill() {
  const sync = useApp((s) => s.sync);
  const setModal = useApp((s) => s.setModal);

  let color = "#84cc16";
  let label = "Saved locally";
  if (sync.peers > 0 && sync.cloud === "off") label += ` · ${sync.peers} online`;
  let onClick: (() => void) | undefined;

  switch (sync.cloud) {
    case "connecting":
      color = "#facc15";
      label = "Connecting…";
      break;
    case "signed-out":
      color = "#facc15";
      label = "Sign in with Google";
      onClick = () => {
        const fb = useApp.getState().firebase;
        if (fb) fb.signIn();
        else setModal("settings");
      };
      break;
    case "syncing":
      color = "#22d3ee";
      label = "Syncing…";
      break;
    case "synced":
      color = "#84cc16";
      label = sync.peers > 0 ? `Cloud synced · ${sync.peers} online` : "Cloud synced";
      break;
    case "offline":
      color = "#9aa3b8";
      label = "Offline — saved locally";
      break;
    case "error":
      color = "#f87171";
      label = "Cloud error";
      onClick = () => setModal("settings");
      break;
    case "denied":
      color = "#f87171";
      label = "No access";
      break;
    default:
      break;
  }

  return (
    <button
      onClick={onClick}
      title={sync.cloudMsg || (sync.cloud === "off" ? "Everything is saved in this browser. Share the link for live P2P collab; add Firebase in Settings for cloud sync." : label)}
      className="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-panel2 border border-line text-[11px] text-dim hover:text-ink"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${sync.cloud === "syncing" || sync.cloud === "connecting" ? "animate-pulse" : ""}`}
        style={{ backgroundColor: color }}
      />
      {label}
    </button>
  );
}

function Presence() {
  const presence = useApp((s) => s.presence);
  const myName = useApp((s) => s.userName);
  const myColor = useApp((s) => s.userColor);
  const users = presence.slice(0, 5);

  return (
    <div className="flex items-center -space-x-1.5" title={users.map((u) => u.name).join(", ") || "Just you"}>
      <div
        className="h-6 w-6 rounded-full border-2 border-panel flex items-center justify-center text-[9px] font-bold text-black"
        style={{ backgroundColor: myColor }}
        title={`${myName} (you)`}
      >
        {myName.slice(0, 2).toUpperCase()}
      </div>
      {users.map((u) => (
        <div
          key={u.clientId}
          className="h-6 w-6 rounded-full border-2 border-panel flex items-center justify-center text-[9px] font-bold text-black"
          style={{ backgroundColor: u.color }}
          title={u.name}
        >
          {u.name.slice(0, 2).toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function Breadcrumbs() {
  const ws = useApp((s) => s.workspace)!;
  const activeBoardId = useApp((s) => s.activeBoardId);
  const rev = useApp((s) => s.rev);
  const setActiveBoard = useApp((s) => s.setActiveBoard);
  const [editing, setEditing] = useState(false);

  // build breadcrumb chain
  const chain: any[] = [];
  let cur = activeBoardId ? ws.boardsMap.get(activeBoardId) : null;
  let guard = 0;
  while (cur && guard++ < 12) {
    chain.unshift(cur);
    cur = ws.boardsMap.get(cur.get("parentId"));
  }
  void rev;

  const active = chain[chain.length - 1];
  if (!active) return null;

  const commitTitle = (title: string) => {
    if (title.trim() && title !== active.get("title")) {
      ws.updateBoard(active.get("id"), { title: title.trim().slice(0, 60) });
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      {chain.map((b, i) => (
        <div key={b.get("id")} className="flex items-center gap-1 min-w-0">
          {i > 0 ? <span className="text-faint">/</span> : null}
          {i < chain.length - 1 ? (
            <button
              className="px-1.5 h-7 rounded-md text-dim hover:text-ink hover:bg-panel2 truncate max-w-32"
              onClick={() => setActiveBoard(b.get("id"))}
              title={b.get("title")}
            >
              {b.get("icon")} {b.get("title")}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 h-7 rounded-md bg-panel2 border border-line min-w-0">
              <select
                className="bg-transparent outline-none cursor-pointer text-base leading-none appearance-none p-0 w-6 text-center"
                value={active.get("icon")}
                onChange={(e) => ws.updateBoard(active.get("id"), { icon: e.target.value })}
                title="Board icon"
              >
                {BOARD_EMOJIS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              {editing ? (
                <input
                  autoFocus
                  defaultValue={active.get("title")}
                  onBlur={(e) => commitTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="bg-transparent outline-none text-ink text-sm w-40"
                />
              ) : (
                <button
                  className="text-ink font-medium truncate max-w-56"
                  onDoubleClick={() => setEditing(true)}
                  title="Double-click to rename"
                >
                  {active.get("title")}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function TopBar() {
  const setModal = useApp((s) => s.setModal);
  const dockOpen = useApp((s) => s.dockOpen);
  const toggleDock = useApp((s) => s.toggleDock);

  return (
    <header className="h-12 flex items-center gap-3 px-3 border-b border-line bg-panel/80 backdrop-blur z-20 shrink-0">
      <button
        onClick={toggleDock}
        className="p-1.5 rounded-md text-dim hover:text-ink hover:bg-panel2"
        title={dockOpen ? "Hide board list" : "Show board list"}
      >
        {dockOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
      </button>
      <div className="flex items-center gap-1.5 font-bold tracking-tight">
        <span className="text-lg">⚔️</span>
        <span className="hidden sm:block">
          Questline<span className="text-accent">.</span>
        </span>
      </div>
      <div className="w-px h-5 bg-line" />
      <Breadcrumbs />
      <div className="flex-1" />
      <Presence />
      <SyncPill />
      <Button size="sm" variant="primary" onClick={() => setModal("share")}>
        <Share2 size={13} /> Share
      </Button>
      <button
        className="p-2 rounded-md text-dim hover:text-ink hover:bg-panel2"
        onClick={() => setModal("help")}
        title="Help & shortcuts"
      >
        <HelpCircle size={16} />
      </button>
      <button
        className="p-2 rounded-md text-dim hover:text-ink hover:bg-panel2"
        onClick={() => setModal("settings")}
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </header>
  );
}
