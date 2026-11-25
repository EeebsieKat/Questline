import { useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Music, Upload } from "lucide-react";
import type { CardNode } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { fileToDataURL } from "../../lib/util";
import { useApp } from "../../lib/store";

export function AudioNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const toast = useApp((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState("");

  return (
    <NodeShell id={id} kind="audio">
      <div className="bg-panel border border-line rounded-xl shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Music size={13} className="text-accent2 shrink-0" />
          <input
            className="nodrag nopan flex-1 bg-transparent outline-none text-xs font-semibold placeholder:text-faint min-w-0"
            placeholder="sfx_jump.ogg"
            value={data.name ?? ""}
            onChange={(e) => patch({ name: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>

        {data.url ? (
          <audio controls preload="metadata" src={data.url} className="nodrag nopan w-full h-8" />
        ) : (
          <div className="flex gap-1.5">
            <button
              className="nodrag nopan flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-panel2 border border-line text-[11px] text-dim hover:text-ink"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={11} /> Upload
            </button>
            <input
              className="nodrag nopan flex-1 bg-canvas/60 border border-line rounded-md px-2 py-1 text-[11px] outline-none placeholder:text-faint focus-ring min-w-0"
              placeholder="…or paste audio URL"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlDraft.trim()) {
                  patch({ url: urlDraft.trim(), name: data.name || urlDraft.split("/").pop() || "audio" });
                  setUrlDraft("");
                }
              }}
            />
          </div>
        )}

        <div className="text-[10px] text-faint">
          keep uploads under ~1.4 MB so they stay syncable — larger files belong on a URL
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 1_400_000) {
              toast("Audio too large (max ~1.4 MB) — host it somewhere and paste the URL instead.", "error");
              e.target.value = "";
              return;
            }
            try {
              const url = await fileToDataURL(f);
              patch({ url, name: data.name || f.name });
            } catch {
              toast("Could not read that audio file.", "error");
            }
            e.target.value = "";
          }}
        />
      </div>
    </NodeShell>
  );
}
