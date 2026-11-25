import { useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Upload } from "lucide-react";
import type { CardNode } from "../../types";
import { NodeShell, useCardData } from "./shell";
import { compressImage } from "../../lib/util";
import { useApp } from "../../lib/store";

export function ImageNode({ id }: NodeProps<CardNode>) {
  const { data, patch } = useCardData(id);
  const toast = useApp((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const url = await compressImage(file);
      patch({ url });
    } catch {
      toast("Could not read that image.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NodeShell id={id} kind="image">
      <div className="bg-panel border border-line rounded-xl shadow-lg overflow-hidden">
        {data.url ? (
          <>
            <img
              src={data.url}
              alt={data.caption || "card image"}
              className="block w-full select-none"
              draggable={false}
            />
            <input
              className="nodrag nopan w-full bg-transparent outline-none text-[11px] text-dim placeholder:text-faint px-2.5 py-1.5 border-t border-line"
              placeholder="Caption…"
              value={data.caption ?? ""}
              onChange={(e) => patch({ caption: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <div className="p-3.5 space-y-2">
            <div
              className="border border-dashed border-line2 rounded-lg py-5 text-center cursor-pointer hover:border-accent transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <div className="text-xs text-dim">Processing…</div>
              ) : (
                <>
                  <Upload size={16} className="mx-auto mb-1.5 text-faint" />
                  <div className="text-[11px] text-dim">Click to upload — or drop a file on the canvas</div>
                  <div className="text-[10px] text-faint mt-0.5">big images are auto-compressed</div>
                </>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                className="nodrag nopan flex-1 bg-canvas/60 border border-line rounded-md px-2 py-1 text-[11px] outline-none placeholder:text-faint focus-ring min-w-0"
                placeholder="…or paste an image URL"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && urlDraft.trim()) {
                    patch({ url: urlDraft.trim() });
                    setUrlDraft("");
                  }
                }}
              />
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
            e.target.value = "";
          }}
        />
      </div>
    </NodeShell>
  );
}
