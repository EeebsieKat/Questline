import { useState } from "react";
import { Copy, CloudOff, UserPlus, X, ShieldCheck } from "lucide-react";
import { useApp } from "../lib/store";
import { Modal, Button, Input, Divider } from "./ui";
import { copyText } from "../lib/util";
import { FIRESTORE_RULES } from "../lib/rules";

export function ShareModal() {
  const ws = useApp((s) => s.workspace)!;
  const setModal = useApp((s) => s.setModal);
  const sync = useApp((s) => s.sync);
  const fb = useApp((s) => s.firebase);
  const cloudMeta = useApp((s) => s.cloudMeta);
  const toast = useApp((s) => s.toast);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);

  const link = `${location.origin}${location.pathname}?w=${ws.id}`;
  const collaborators = cloudMeta?.collaborators ?? [];
  const isOwner = !!fb?.isOwner;

  const doInvite = async () => {
    if (!fb || !invite.trim()) return;
    setBusy(true);
    const err = await fb.invite(invite);
    setBusy(false);
    if (err) toast(err, "error");
    else {
      toast(`Invited ${invite.trim()} — they can open the link and sign in.`, "success");
      setInvite("");
    }
  };

  return (
    <Modal title="Share this workspace" onClose={() => setModal(null)}>
      <label className="block mb-1.5">
        <span className="block text-xs font-medium text-dim mb-1.5">Workspace link</span>
        <div className="flex gap-2">
          <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono !text-[11px]" />
          <Button
            onClick={() => {
              copyText(link);
              toast("Link copied to clipboard.", "success");
            }}
          >
            <Copy size={13} /> Copy
          </Button>
        </div>
        <span className="block text-[11px] text-faint mt-1.5 leading-relaxed">
          Anyone with this link joins the same board — live cursors and instant sync over peer-to-peer WebRTC.
        </span>
      </label>

      <Divider />

      {sync.cloud === "off" ? (
        <div className="rounded-xl border border-line bg-panel2/60 p-3.5">
          <div className="flex items-center gap-2 mb-1.5 text-sm font-medium">
            <CloudOff size={15} className="text-amber-400" /> Local + P2P mode
          </div>
          <p className="text-xs text-dim leading-relaxed mb-2.5">
            Right now edits sync live only while people are online at the same time, and each
            person's browser keeps its own copy. <span className="text-ink">Sync also works when
            nobody's online</span> by connecting a free Firebase project — then you can also gate
            the workspace by Google account and invite teammates by email.
          </p>
          <Button variant="primary" onClick={() => setModal("settings")}>
            Set up cloud sync (free, ~10 min)
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <ShieldCheck size={15} className={sync.cloud === "synced" ? "text-lime-400" : "text-amber-400"} />
            Cloud-gated workspace
            {sync.cloud === "denied" ? <span className="text-[11px] text-red-400">— your account isn't invited</span> : null}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Input
              placeholder="teammate@gmail.com"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doInvite()}
              type="email"
            />
            <Button variant="primary" disabled={!fb || !invite.trim() || busy} onClick={doInvite}>
              <UserPlus size={13} /> Invite
            </Button>
          </div>

          {isOwner ? (
            <div className="text-[11px] text-faint mb-3 leading-relaxed">
              Tip: paste these Firestore rules in the Firebase console if you haven't already.{" "}
              <button
                className="text-accent hover:underline"
                onClick={() => {
                  copyText(FIRESTORE_RULES);
                  toast("Rules copied — paste them in Firestore → Rules.", "success");
                }}
              >
                Copy rules
              </button>
            </div>
          ) : null}

          <div className="text-[11px] font-semibold text-dim mb-1.5 px-0.5">
            Collaborators ({collaborators.length})
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {collaborators.map((email) => (
              <div key={email} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-panel2/60 border border-line">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
                <span className="text-xs text-ink flex-1 truncate">{email}</span>
                {email === cloudMeta?.ownerEmail ? (
                  <span className="text-[10px] text-accent border border-accent/40 rounded px-1.5 py-0.5">owner</span>
                ) : null}
                {isOwner && email !== cloudMeta?.ownerEmail ? (
                  <button
                    className="text-faint hover:text-red-400"
                    title="Remove"
                    onClick={() => fb?.removeCollaborator(email)}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
