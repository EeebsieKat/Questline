import { useApp } from "../lib/store";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "./ui";
import { copyText } from "../lib/util";

// Shown instead of the canvas when cloud rules say: signed in, but
// this Google account isn't on the board's collaborator list.
export function CloudBlockedNotice() {
  const fb = useApp((s) => s.firebase);
  const sync = useApp((s) => s.sync);
  const cloudMeta = useApp((s) => s.cloudMeta);
  const toast = useApp((s) => s.toast);
  const email = sync.email ?? (fb as any)?.email ?? "your account";

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="panel-surface rounded-2xl p-8 max-w-md text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-bold mb-1">You're not on this board yet</h2>
        <p className="text-sm text-dim mb-4">
          This workspace is cloud-gated by its owner{cloudMeta ? ` (${cloudMeta.ownerEmail})` : ""}. Ask them to invite:
        </p>
        <div className="flex items-center gap-2 justify-center mb-6">
          <code className="text-sm bg-canvas border border-line rounded-lg px-3 py-1.5 text-accent2">{email}</code>
          <Button
            size="sm"
            onClick={() => {
              copyText(email);
              toast("Email copied", "success");
            }}
          >
            Copy
          </Button>
        </div>
        <div className="flex gap-2 justify-center">
          <Button
            variant="subtle"
            onClick={() => {
              fb?.signOut();
              location.reload();
            }}
          >
            <LogOut size={14} /> Switch account
          </Button>
          <Button variant="ghost" onClick={() => location.reload()}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
