import { useRef, useState } from "react";
import { Cloud, CloudOff, Download, LogOut, RotateCcw, Upload, RefreshCw } from "lucide-react";
import { useApp, randomUserColor } from "../lib/store";
import { Modal, Button, Input, TextArea, Field, Divider, Swatches } from "./ui";
import { USER_COLORS } from "../lib/palette";
import { exportWorkspace, importWorkspace } from "../lib/exportImport";
import { downloadFile } from "../lib/util";
import { connectFirebase } from "./App";
import { bootstrapStarter } from "../lib/bootstrap";
import { FIRESTORE_RULES } from "../lib/rules";
import { copyText } from "../lib/util";

export function SettingsModal() {
  const ws = useApp((s) => s.workspace)!;
  const setModal = useApp((s) => s.setModal);
  const userName = useApp((s) => s.userName);
  const userColor = useApp((s) => s.userColor);
  const setIdentity = useApp((s) => s.setIdentity);
  const sync = useApp((s) => s.sync);
  const fb = useApp((s) => s.firebase);
  const setFirebase = useApp((s) => s.setFirebase);
  const setCloud = useApp((s) => s.setCloud);
  const setCloudMeta = useApp((s) => s.setCloudMeta);
  const setActiveBoard = useApp((s) => s.setActiveBoard);
  const toast = useApp((s) => s.toast);

  const [name, setName] = useState(userName);
  const [cfg, setCfg] = useState(localStorage.getItem("ql-firebase") ?? "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveConfig = async () => {
    const raw = cfg.trim();
    if (!raw) {
      toast("Paste your Firebase config first (or Disconnect to remove it).", "error");
      return;
    }
    setBusy(true);
    localStorage.setItem("ql-firebase", raw);
    // reset any existing session first
    if (fb) {
      fb.destroy();
      setFirebase(null);
    }
    setCloud("connecting");
    await connectFirebase(ws);
    setBusy(false);
  };

  const disconnect = async () => {
    localStorage.removeItem("ql-firebase");
    await fb?.signOut().catch(() => undefined);
    fb?.destroy();
    setFirebase(null);
    setCloudMeta(null);
    setCloud("off");
    ws.setRoomSecret(null);
    toast("Cloud sync disconnected — back to local + P2P.", "info");
  };

  return (
    <Modal title="Settings" onClose={() => setModal(null)} wide>
      <div className="grid sm:grid-cols-2 gap-x-8">
        {/* ── profile ── */}
        <div>
          <Field label="Display name (seen by collaborators)">
            <div className="flex gap-2">
              <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
              <Button
                onClick={() => {
                  if (name.trim()) setIdentity(name.trim().slice(0, 24));
                  toast("Name saved.", "success");
                }}
              >
                Save
              </Button>
            </div>
          </Field>
          <Field label="Cursor color">
            <div className="flex items-center gap-2">
              <Swatches
                list={USER_COLORS.map((hex, i) => ({ id: `u${i}`, name: hex, hex }))}
                value={userColor}
                onPick={(hex) => setIdentity(userName, hex)}
              />
              <button
                className="ml-1 px-2 h-6 rounded-md bg-panel2 border border-line text-[10px] text-dim hover:text-ink"
                onClick={() => setIdentity(userName, randomUserColor())}
              >
                random
              </button>
            </div>
          </Field>

          <Divider />
          <div className="text-xs font-semibold text-dim mb-2">Data</div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                downloadFile(`questline-backup-${ws.id}.json`, exportWorkspace(ws));
                toast("Backup downloaded.", "success");
              }}
            >
              <Download size={13} /> Export backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> Import backup
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (
                  confirm(
                    "Factory reset? This wipes ALL boards, cards and tags for EVERYONE on this workspace and restores the starter content.",
                  )
                ) {
                  ws.factoryReset(bootstrapStarter);
                  const root = ws.rootBoardId();
                  if (root) setActiveBoard(root);
                  toast("Workspace reset to the starter content.", "success");
                  setModal(null);
                }
              }}
            >
              <RotateCcw size={13} /> Factory reset
            </Button>
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
        </div>

        {/* ── cloud sync ── */}
        <div>
          <div className="text-xs font-semibold text-dim mb-2">Cloud sync (optional)</div>
          <div
            className={`text-[11px] px-2.5 py-2 rounded-lg border mb-3 leading-relaxed ${
              sync.cloud === "synced"
                ? "bg-lime-400/10 border-lime-400/30 text-lime-200"
                : sync.cloud === "error" || sync.cloud === "denied"
                  ? "bg-red-400/10 border-red-400/30 text-red-300"
                  : sync.cloud === "off"
                    ? "bg-panel2 border-line text-dim"
                    : "bg-amber-400/10 border-amber-400/30 text-amber-200"
            }`}
          >
            {sync.cloud === "off" && "Not configured — running local + P2P only."}
            {sync.cloud === "connecting" && "Connecting…"}
            {sync.cloud === "signed-out" && (sync.cloudMsg || "Sign-in required.")}
            {sync.cloud === "syncing" && "Syncing your edits to the cloud…"}
            {sync.cloud === "synced" && `Synced as ${sync.email ?? "you"}.`}
            {sync.cloud === "offline" && (sync.cloudMsg || "Offline — will sync when back online.")}
            {sync.cloud === "error" && (sync.cloudMsg || "Cloud error.")}
            {sync.cloud === "denied" && "Signed in, but this account isn't invited to this workspace."}
          </div>

          <Field
            label="Firebase web app config"
            hint={
              <>
                Firebase console → Project settings → Your apps → SDK setup and configuration.
                Paste the whole <code className="text-accent2">firebaseConfig</code> object. Free
                tier is plenty.{" "}
                <button
                  className="text-accent hover:underline"
                  onClick={() => {
                    copyText(FIRESTORE_RULES);
                    toast("Rules copied — paste in Firestore → Rules.", "success");
                  }}
                >
                  Copy the required Firestore rules
                </button>{" "}
                first.
              </>
            }
          >
            <TextArea
              rows={5}
              className="font-mono !text-[10px]"
              placeholder={`{\n  "apiKey": "AIza…",\n  "projectId": "my-questline",\n  "appId": "1:…",\n  "authDomain": "….firebaseapp.com"\n}`}
              value={cfg}
              onChange={(e) => setCfg(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={saveConfig}>
              {busy ? <RefreshCw size={13} className="animate-spin" /> : <Cloud size={13} />}
              {busy ? "Connecting…" : "Save & connect"}
            </Button>
            {fb ? (
              <>
                <Button variant="ghost" onClick={() => fb.signOut()}>
                  <LogOut size={13} /> Sign out
                </Button>
                <Button variant="danger" onClick={disconnect}>
                  <CloudOff size={13} /> Disconnect
                </Button>
              </>
            ) : null}
          </div>

          <Divider />
          <div className="text-[11px] text-faint leading-relaxed">
            Setup checklist: 1) create a free Firebase project → 2) add a Web app and copy the
            config → 3) enable <span className="text-dim">Authentication → Google</span> and add{" "}
            <code className="text-accent2">{location.host}</code> to its authorized domains → 4)
            create <span className="text-dim">Firestore Database</span> (production mode) and
            publish the rules above → 5) paste the config here. Invite teammates from the Share
            dialog. Full walkthrough in the README.
          </div>
        </div>
      </div>
    </Modal>
  );
}
