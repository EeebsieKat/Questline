// Whole-workspace JSON backup export / import (parity with the
// original Questline's one-file backup). Assets embedded in card
// data (data URLs) come along automatically.
import * as Y from "yjs";
import type { Workspace } from "./workspace";
import { uid } from "./util";

export interface BackupFile {
  app: "questline-static";
  version: 2;
  exportedAt: string;
  workspaceId: string;
  boards: any[];
  nodes: any[];
  edges: any[];
  tags: any[];
}

export function exportWorkspace(ws: Workspace): string {
  const backup: BackupFile = {
    app: "questline-static",
    version: 2,
    exportedAt: new Date().toISOString(),
    workspaceId: ws.id,
    boards: Array.from(ws.boardsMap.values()).map(plainMap),
    nodes: Array.from(ws.nodesMap.values()).map(plainNode),
    edges: Array.from(ws.edgesMap.values()).map(plainMap),
    tags: Array.from(ws.tagsMap.values()).map(plainMap),
  };
  return JSON.stringify(backup, null, 2);
}

function plainMap(m: Y.Map<any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of m.entries()) {
    if (v instanceof Y.Map) out[k] = plainMap(v);
    else if (v instanceof Y.Array) out[k] = v.map((el: any) => (el instanceof Y.Map ? plainMap(el) : el));
    else out[k] = v;
  }
  return out;
}

function plainNode(n: Y.Map<any>) {
  const out = plainMap(n);
  if (out.data) out.data = plainMap(n.get("data"));
  return out;
}

/** Import merges foreign content in with fresh ids so nothing collides. */
export function importWorkspace(ws: Workspace, json: string): { ok: boolean; error?: string } {
  let backup: BackupFile;
  try {
    backup = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (backup.app !== "questline-static" || !Array.isArray(backup.boards) || !Array.isArray(backup.nodes)) {
    return { ok: false, error: "That doesn't look like a Questline backup file." };
  }

  const idMap = new Map<string, string>();
  for (const b of backup.boards) idMap.set(b.id, uid());
  for (const n of backup.nodes) idMap.set(n.id, uid());
  for (const e of backup.edges) idMap.set(e.id, uid());
  for (const t of backup.tags ?? []) idMap.set(t.id, uid());

  const foreignRoots = backup.boards.filter((b) => !b.parentId);
  const targetParent = ws.rootBoardId();

  ws.doc.transact(() => {
    for (const t of backup.tags ?? []) {
      const m = new Y.Map<any>();
      m.set("id", idMap.get(t.id)!);
      m.set("name", t.name ?? "tag");
      m.set("color", t.color ?? "#22d3ee");
      ws.tagsMap.set(m.get("id"), m);
    }
    for (const b of backup.boards) {
      const m = new Y.Map<any>();
      m.set("id", idMap.get(b.id)!);
      m.set("title", b.title ?? "Board");
      m.set("icon", b.icon ?? "📋");
      m.set(
        "parentId",
        b.parentId ? (idMap.get(b.parentId) ?? null) : targetParent,
      );
      m.set("color", b.color ?? null);
      ws.boardsMap.set(m.get("id"), m);
    }
    for (const n of backup.nodes) {
      const m = new Y.Map<any>();
      m.set("id", idMap.get(n.id)!);
      m.set("boardId", idMap.get(n.boardId) ?? targetParent ?? "");
      m.set("type", n.type);
      m.set("x", n.x ?? 0);
      m.set("y", n.y ?? 0);
      m.set("w", n.w ?? 240);
      m.set("h", n.h ?? 0);
      m.set("z", n.z ?? 0);
      const d = new Y.Map<any>();
      const data = n.data ?? {};
      for (const [k, v] of Object.entries(data) as [string, any][]) {
        if (Array.isArray(v) && (k === "items" || k === "blocks")) {
          const arr = new Y.Array<any>();
          arr.push(
            v.map((it: any) => {
              const im = new Y.Map<any>();
              for (const [ik, iv] of Object.entries(it)) im.set(ik, iv);
              if (!im.get("id")) im.set("id", uid());
              return im;
            }),
          );
          d.set(k, arr);
        } else if (k === "targetBoardId") {
          d.set(k, idMap.get(v) ?? v);
        } else if (k === "tags") {
          d.set(
            k,
            (v as string[]).map((t) => idMap.get(t) ?? t),
          );
        } else {
          d.set(k, v);
        }
      }
      m.set("data", d);
      ws.nodesMap.set(m.get("id"), m);
    }
    for (const e of backup.edges) {
      if (!idMap.get(e.source) || !idMap.get(e.target)) continue;
      const m = new Y.Map<any>();
      m.set("id", idMap.get(e.id)!);
      m.set("boardId", idMap.get(e.boardId) ?? targetParent ?? "");
      m.set("source", idMap.get(e.source)!);
      m.set("target", idMap.get(e.target)!);
      m.set("sourceHandle", e.sourceHandle ?? "bottom");
      m.set("targetHandle", e.targetHandle ?? "top");
      m.set("etype", e.etype ?? "elbow");
      m.set("label", e.label ?? "");
      m.set("color", e.color ?? null);
      m.set("animated", e.animated ? 1 : 0);
      m.set("arrows", e.arrows ?? "end");
      ws.edgesMap.set(m.get("id"), m);
    }
  }, "local");

  return { ok: true };
}
