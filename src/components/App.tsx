import { useEffect, useState } from "react";
import { Sparkles, Users, Zap, HardDriveDownload } from "lucide-react";
import { useApp } from "../lib/store";
import { Workspace } from "../lib/workspace";
import { bootstrapStarter } from "../lib/bootstrap";
import { FirebaseSync, parseFirebaseConfig } from "../lib/firebase-sync";
import { FIREBASE_CONFIG } from "../firebase-config";
import { uid } from "../lib/util";
import { Button, Input } from "./ui";
import { TopBar } from "./TopBar";
import { BoardDock } from "./BoardDock";
import { CanvasView } from "./CanvasView";
import { ShareModal } from "./ShareModal";
import { SettingsModal } from "./SettingsModal";
import { CommandPalette } from "./CommandPalette";
import { HelpModal } from "./HelpModal";
import { Toasts } from "./Toasts";
import { CloudBlockedNotice } from "./CloudBlockedNotice";

// ── firebase bootstrap (shared by App init and Settings) ─────
export async function connectFirebase(ws: Workspace, opts?: { autoSignIn?: boolean }) {
  // A config pasted in Settings overrides the baked-in deployment config.
  const pasted = localStorage.getItem("ql-firebase");
  let cfg: Record<string, string> | null = pasted ? parseFirebaseConfig(pasted) : null;
  if (!cfg && FIREBASE_CONFIG) cfg = { ...FIREBASE_CONFIG };
  const store = useApp.getState();
  if (pasted && !cfg) {
    store.setCloud("error", "The saved Firebase config is invalid — re-paste it in Settings.");
    return;
  }
  if (!cfg) {
    store.setFirebase(null);
    store.setCloud("off");
    return;
  }
  store.setCloud("connecting");
  const fb = await FirebaseSync.connect(
    cfg,
    ws,
    {
      onState: (s, msg) => useApp.getState().setCloud(s, msg),
      onUser: (email) => useApp.getState().setSync({ email }),
      onMeta: (meta) => useApp.getState().setCloudMeta(meta),
      getPeers: () => useApp.getState().sync.peers,
    },
    !!opts?.autoSignIn,
  );
  if (fb) useApp.getState().setFirebase(fb);
}

function pushRecent(id: string) {
  try {
    const raw = JSON.parse(localStorage.getItem("ql-recent") || "[]");
    const list: { id: string; at: number }[] = Array.isArray(raw) ? raw : [];
    const next = [{ id, at: Date.now() }, ...list.filter((r) => r.id !== id)].slice(0, 6);
    localStorage.setItem("ql-recent", JSON.stringify(next));
  } catch {
    /* noop */
  }
}

// ── landing screen (no workspace id yet) ──────────────────────
function Landing() {
  const setIdentity = useApp((s) => s.setIdentity);
  const userName = useApp((s) => s.userName);
  const [name, setName] = useState(userName);
  const [joinId, setJoinId] = useState("");
  const [recents, setRecents] = useState<{ id: string; at: number }[]>([]);
  const toast = useApp((s) => s.toast);

  useEffect(() => {
    const id = loadIdentity();
    setName(id.name);
    try {
      setRecents(JSON.parse(localStorage.getItem("ql-recent") || "[]"));
    } catch {
      setRecents([]);
    }
  }, []);

  const start = () => {
    const id = uid() + uid();
    if (name.trim()) setIdentity(name.trim().slice(0, 24));
    localStorage.setItem("ql-last-ws", id);
    location.href = `${location.pathname}?w=${id}`;
  };

  const join = (raw: string) => {
    try {
      const url = new URL(raw.trim(), location.href);
      const id = url.searchParams.get("w");
      if (id && /^[a-zA-Z0-9_-]{6,128}$/.test(id)) {
        if (name.trim()) setIdentity(name.trim().slice(0, 24));
        localStorage.setItem("ql-last-ws", id);
        location.href = `${location.pathname}?w=${id}`;
        return;
      }
    } catch {
      /* not a url */
    }
    toast("Paste a valid Questline share link or workspace id.", "error");
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚔️</div>
          <h1 className="text-3xl font-bold tracking-tight">
            Questline<span className="text-accent">.</span>
          </h1>
          <p className="text-dim text-sm mt-2">
            The game-dev planning board — now fully in your browser. No server, no paywall.
          </p>
        </div>

        <div className="panel-surface rounded-2xl p-6">
          <label className="block mb-4">
            <span className="block text-xs font-medium text-dim mb-1.5">Your display name (collaborators see it live)</span>
            <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eeebsie" />
          </label>
          <Button variant="primary" className="w-full" onClick={start}>
            <Sparkles size={15} /> Create my workspace
          </Button>

          <div className="flex items-center gap-3 my-5 text-[11px] text-faint">
            <div className="h-px flex-1 bg-line" /> or join one<div className="h-px flex-1 bg-line" />
          </div>

          <div className="flex gap-2">
            <Input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Paste a share link or workspace id"
              onKeyDown={(e) => {
                if (e.key === "Enter" && joinId.trim()) join(joinId);
              }}
            />
            <Button onClick={() => join(joinId)}>Join</Button>
          </div>

          {recents.length > 1 ? (
            <div className="mt-5">
              <div className="text-[11px] text-faint mb-2">Recent on this device</div>
              <div className="flex flex-wrap gap-1.5">
                {recents.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    className="px-2 h-7 rounded-lg bg-panel2 border border-line text-xs text-dim hover:text-ink truncate max-w-40"
                    onClick={() => {
                      localStorage.setItem("ql-last-ws", r.id);
                      location.href = `${location.pathname}?w=${r.id}`;
                    }}
                  >
                    {r.id.slice(0, 10)}…
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6 text-center">
          {[
            [Zap, "Live sync", "Peer-to-peer cursors & edits"],
            [Users, "Team boards", "Optional Google-gated cloud"],
            [HardDriveDownload, "Your data", "Saved in your browser"],
          ].map(([Icon, title, desc]) => {
            const I = Icon as any;
            return (
              <div key={title as string} className="panel-surface rounded-xl p-3">
                <I size={16} className="mx-auto mb-1.5 text-accent" />
                <div className="text-xs font-medium">{title as string}</div>
                <div className="text-[10px] text-faint mt-0.5">{desc as string}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function loadIdentity() {
  const name = localStorage.getItem("ql-name") || "";
  const color = localStorage.getItem("ql-color") || "";
  return { name, color };
}

// ── app shell ─────────────────────────────────────────────────
export function App() {
  const [gate, setGate] = useState<"loading" | "landing" | "ready">("loading");
  const modal = useApp((s) => s.modal);
  const setModal = useApp((s) => s.setModal);
  const cloud = useApp((s) => s.sync.cloud);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let id = params.get("w");
    if (!id) id = localStorage.getItem("ql-last-ws");
    if (!id || !/^[a-zA-Z0-9_-]{6,128}$/.test(id)) {
      setGate("landing");
      return;
    }

    localStorage.setItem("ql-last-ws", id);
    if (!location.search.includes("w=")) {
      history.replaceState(null, "", `${location.pathname}?w=${id}`);
    }
    pushRecent(id);

    let cancelled = false;
    const ws = new Workspace(id, {
      onDocChange: () => useApp.getState().bumpRev(),
      onPresence: (p) => useApp.getState().setPresence(p.users, p.remoteSel, p.peers),
      onLocalSaved: (saved) => useApp.getState().setSync({ saved }),
    });
    (window as any).__ql = ws; // debugging hook

    (async () => {
      try {
        await ws.whenSynced;
      } catch {
        /* idb may be unavailable (private mode) — keep going */
      }
      if (cancelled) return;

      useApp.getState().setWorkspace(ws, null);

      // Give live peers / cloud a moment to deliver an existing
      // workspace before deciding this is a brand-new room (fixed
      // bootstrap ids make a concurrent double-bootstrap harmless).
      const sawRemote = await Promise.race([
        ws.firstRemoteUpdate.then(() => true),
        new Promise<boolean>((r) => setTimeout(() => r(false), 2200)),
      ]);
      if (cancelled) return;
      if (ws.boardsMap.size === 0 && !sawRemote) bootstrapStarter(ws);

      const last = localStorage.getItem(`ql-last-board-${id}`);
      const root = ws.rootBoardId() ?? ws.addBoard("Home", "🏠", null);
      useApp.getState().setActiveBoard(last && ws.boardsMap.get(last) ? last : root);

      setGate("ready");
      // Baked-in deployment config or a pasted one — either way, connect.
      // No auto sign-in popup on load; the top-bar pill handles that.
      if (localStorage.getItem("ql-firebase") || FIREBASE_CONFIG) connectFirebase(ws);
    })();

    return () => {
      cancelled = true;
      useApp.getState().setFirebase(null);
      useApp.getState().setCloudMeta(null);
      useApp.getState().setCloud("off");
      ws.destroy();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal("palette");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setModal]);

  if (gate === "landing") return <Landing />;
  if (gate === "loading" || !useApp.getState().workspace) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-pulse mb-3">⚔️</div>
          <div className="text-dim text-sm">Opening your workspace…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0 relative">
        <BoardDock />
        {cloud === "denied" ? <CloudBlockedNotice /> : <CanvasView />}
      </div>
      {modal === "share" ? <ShareModal /> : null}
      {modal === "settings" ? <SettingsModal /> : null}
      {modal === "palette" ? <CommandPalette /> : null}
      {modal === "help" ? <HelpModal /> : null}
      <Toasts />
    </div>
  );
}
