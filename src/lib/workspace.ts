// ─────────────────────────────────────────────────────────────
// Workspace — the collaborative data core.
//
// One Yjs document per workspace, holding boards, nodes (cards),
// edges (connectors) and tags. Three sync layers:
//   1. y-indexeddb  → instant local saves (always on)
//   2. y-webrtc     → live peer-to-peer sync + presence (always on)
//   3. FirebaseSync → optional cloud persistence + Google accounts
// All edits go through here with origin "local" so undo/redo and
// remote-merge behave.
// ─────────────────────────────────────────────────────────────
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import type { PresenceUser, CardData, NodeKind, EdgeStyleKind, ArrowMode } from "../types";
import { uid } from "./util";
import { USER_COLORS, pickUserColor, STICKY_COLORS, CARD_COLORS } from "./palette";

export const DEFAULT_SIGNALING = [
  "wss://signaling.yjs.dev",
  "wss://y-webrtc-signaling-eu.fly.dev",
];

export interface WorkspaceHooks {
  onDocChange: () => void;
  onPresence: (info: {
    users: PresenceUser[];
    remoteSel: Record<string, string>;
    peers: number;
  }) => void;
  onLocalSaved: (saved: boolean) => void;
}

export interface Identity {
  name: string;
  color: string;
}

export class Workspace {
  readonly id: string;
  readonly doc = new Y.Doc();
  readonly boardsMap: Y.Map<any>;
  readonly nodesMap: Y.Map<any>;
  readonly edgesMap: Y.Map<any>;
  readonly tagsMap: Y.Map<any>;
  undo: Y.UndoManager;
  awareness: any;

  private idb: IndexeddbPersistence;
  private webrtc: WebrtcProvider | null = null;
  private roomSecret: string | null = null;
  private hooks: WorkspaceHooks;
  private destroyed = false;
  private posThrottle = new Map<string, number>();
  private remoteResolve: (() => void) | null = null;
  /** resolves the first time a change arrives from any other peer / cloud */
  readonly firstRemoteUpdate: Promise<void>;

  constructor(id: string, hooks: WorkspaceHooks) {
    this.id = id;
    this.hooks = hooks;
    this.firstRemoteUpdate = new Promise<void>((resolve) => {
      this.remoteResolve = resolve;
    });
    this.boardsMap = this.doc.getMap("boards");
    this.nodesMap = this.doc.getMap("nodes");
    this.edgesMap = this.doc.getMap("edges");
    this.tagsMap = this.doc.getMap("tags");

    this.undo = new Y.UndoManager([this.boardsMap, this.nodesMap, this.edgesMap, this.tagsMap], {
      trackedOrigins: new Set(["local"]),
      captureTimeout: 350,
    });

    // any change anywhere → single throttled notification to the app
    let scheduled = false;
    const emit = () => {
      if (this.destroyed || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        this.hooks.onDocChange();
      });
    };
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      void update;
      if (origin !== "firebase") emit();
      // remote content arriving? (peer provider instance or firebase string)
      if (this.remoteResolve && origin !== "local" && origin !== "bootstrap" && origin !== this.idb) {
        this.remoteResolve();
      }
    });
    this.boardsMap.observeDeep(emit);
    this.nodesMap.observeDeep(emit);
    this.edgesMap.observeDeep(emit);
    this.tagsMap.observeDeep(emit);

    // 1) local persistence
    this.idb = new IndexeddbPersistence(`questline-ws-${id}`, this.doc);
    this.idb.on("synced", () => this.hooks.onLocalSaved(true));
    this.idb.on("save", () => this.hooks.onLocalSaved(true));

    // 2) live sync (room may be upgraded with a secret once cloud loads)
    this.setupWebrtc();
  }

  /** resolves once the local IndexedDB copy has been merged in */
  get whenSynced(): Promise<void> {
    return this.idb.whenSynced.then(() => undefined);
  }

  private _presenceChanged = () => this.emitPresence();

  // ── webrtc ────────────────────────────────────────────────
  private webrtcRoom(): string {
    return this.roomSecret ? `questline:${this.id}:${this.roomSecret}` : `questline:${this.id}`;
  }

  private setupWebrtc() {
    if (this.destroyed) return;
    const signaling = this.getSignaling();
    this.webrtc = new WebrtcProvider(this.webrtcRoom(), this.doc, {
      signaling,
      maxConns: 20,
      filterBcConns: true,
    });
    // re-attach presence to the fresh awareness, carrying over local state
    const prev = this.awareness;
    this.awareness = this.webrtc.awareness;
    if (prev) {
      const local = prev.getLocalState?.();
      if (local) this.awareness.setLocalState(local);
      try { prev.off("change", this._presenceChanged); } catch { /* noop */ }
    } else {
      this.awareness.setLocalStateField("user", { name: "…", color: USER_COLORS[0] });
    }
    this.awareness.on("change", this._presenceChanged);
    this.emitPresence();
  }

  setRoomSecret(secret: string | null) {
    if (this.roomSecret === secret) return;
    this.roomSecret = secret;
    this.webrtc?.destroy();
    this.webrtc = null;
    this.setupWebrtc();
  }

  private getSignaling(): string[] {
    try {
      const custom = JSON.parse(localStorage.getItem("ql-signaling") || "null");
      if (Array.isArray(custom) && custom.length) return custom;
    } catch {
      /* ignore */
    }
    return DEFAULT_SIGNALING;
  }

  // ── presence ──────────────────────────────────────────────
  setIdentity(identity: Identity) {
    this.awareness?.setLocalStateField("user", {
      name: identity.name,
      color: identity.color,
    });
  }

  setBoard(boardId: string) {
    this.awareness?.setLocalStateField("board", boardId);
    this.awareness?.setLocalStateField("cursor", null);
  }

  setCursor(pos: { x: number; y: number } | null) {
    this.awareness?.setLocalStateField("cursor", pos);
  }

  setSelection(ids: string[]) {
    this.awareness?.setLocalStateField("sel", ids);
  }

  private emitPresence() {
    if (this.destroyed) return;
    const states: Map<number, any> = this.awareness?.getStates?.() ?? new Map();
    const myClient = this.doc.clientID;
    const users: PresenceUser[] = [];
    const remoteSel: Record<string, string> = {};
    let peers = 0;
    for (const [clientId, state] of states) {
      peers++;
      const u = state?.user;
      if (!u?.name) continue;
      if (clientId !== myClient) {
        users.push({ clientId, name: u.name, color: u.color || pickUserColor(u.name) });
        if (Array.isArray(state.sel)) {
          for (const id of state.sel) remoteSel[id] = u.color || "#22d3ee";
        }
      }
    }
    this.hooks.onPresence({ users, remoteSel, peers: Math.max(0, peers - 1) });
  }

  // ── boards ────────────────────────────────────────────────
  addBoard(title: string, icon: string, parentId: string | null): string {
    const id = uid();
    this.doc.transact(() => {
      const m = new Y.Map<any>();
      m.set("id", id);
      m.set("title", title);
      m.set("icon", icon);
      m.set("parentId", parentId);
      m.set("color", null);
      this.boardsMap.set(id, m);
    }, "local");
    return id;
  }

  updateBoard(id: string, patch: Record<string, any>) {
    const b = this.boardsMap.get(id);
    if (!b) return;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) b.set(k, v);
    }, "local");
  }

  deleteBoard(id: string) {
    const doomed = new Set<string>();
    const walk = (bid: string) => {
      if (doomed.has(bid)) return;
      doomed.add(bid);
      for (const b of this.boardsMap.values()) {
        if (b.get("parentId") === bid) walk(b.get("id"));
      }
    };
    walk(id);
    this.doc.transact(() => {
      for (const [nid, n] of this.nodesMap.entries()) {
        if (doomed.has(n.get("boardId")) || doomed.has(n.get("data")?.get?.("targetBoardId"))) {
          this.nodesMap.delete(nid);
        }
      }
      for (const [eid, e] of this.edgesMap.entries()) {
        if (doomed.has(e.get("boardId"))) this.edgesMap.delete(eid);
      }
      for (const bid of doomed) this.boardsMap.delete(bid);
    }, "local");
  }

  boardChildren(parentId: string | null): any[] {
    const out: any[] = [];
    for (const b of this.boardsMap.values()) {
      if ((b.get("parentId") ?? null) === parentId) out.push(b);
    }
    return out;
  }

  rootBoardId(): string | null {
    for (const b of this.boardsMap.values()) {
      if (!b.get("parentId")) return b.get("id");
    }
    return null;
  }

  // ── nodes (cards) ─────────────────────────────────────────
  addNode(
    boardId: string,
    type: NodeKind,
    x: number,
    y: number,
    data: Partial<CardData> = {},
    w = 240,
  ): string {
    const id = uid();
    this.doc.transact(() => {
      const n = new Y.Map<any>();
      n.set("id", id);
      n.set("boardId", boardId);
      n.set("type", type);
      n.set("x", Math.round(x));
      n.set("y", Math.round(y));
      n.set("w", w);
      n.set("h", 0);
      n.set("z", this.nextZ(boardId));
      const d = new Y.Map<any>();
      this.applyData(d, data);
      n.set("data", d);
      this.nodesMap.set(id, n);
    }, "local");
    return id;
  }

  private applyData(d: Y.Map<any>, data: Partial<CardData> & Record<string, any>) {
    const { items, blocks, ...rest } = data as any;
    for (const [k, v] of Object.entries(rest)) d.set(k, v);
    if (items) d.set("items", toYArray(items, ["id", "text", "done"]));
    if (blocks) d.set("blocks", toYArray(blocks, ["id", "type", "text", "checked"]));
  }

  updateNode(id: string, patch: Record<string, any>) {
    const n = this.nodesMap.get(id);
    if (!n) return;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) n.set(k, v);
    }, "local");
  }

  /** throttled live position writes during drag (origin "local") */
  setNodePosition(id: string, x: number, y: number, throttleMs = 0) {
    if (throttleMs > 0) {
      const now = Date.now();
      const last = this.posThrottle.get(id) ?? 0;
      if (now - last < throttleMs) return;
      this.posThrottle.set(id, now);
    }
    this.updateNode(id, { x: Math.round(x), y: Math.round(y) });
  }

  updateNodeData(id: string, patch: Partial<CardData> & Record<string, any>) {
    const n = this.nodesMap.get(id);
    const d = n?.get("data");
    if (!d) return;
    this.doc.transact(() => {
      const { items, blocks, ...rest } = patch as any;
      for (const [k, v] of Object.entries(rest)) d.set(k, v);
      if (items) replaceYArray(d, "items", items, ["id", "text", "done"]);
      if (blocks) replaceYArray(d, "blocks", blocks, ["id", "type", "text", "checked"]);
    }, "local");
  }

  /** granular update of one item inside a list (task items / note blocks) */
  updateListItem(id: string, key: "items" | "blocks", idx: number, patch: Record<string, any>) {
    const n = this.nodesMap.get(id);
    const arr = n?.get("data")?.get?.(key);
    if (!arr || typeof arr.get !== "function") return;
    const item = arr.get(idx);
    if (item instanceof Y.Map) {
      this.doc.transact(() => {
        for (const [k, v] of Object.entries(patch)) item.set(k, v);
      }, "local");
    }
  }

  deleteNodes(ids: string[]) {
    if (!ids.length) return;
    const idSet = new Set(ids);
    this.doc.transact(() => {
      for (const id of ids) this.nodesMap.delete(id);
      for (const [eid, e] of this.edgesMap.entries()) {
        if (idSet.has(e.get("source")) || idSet.has(e.get("target"))) {
          this.edgesMap.delete(eid);
        }
      }
    }, "local");
  }

  duplicateNode(id: string, offset = 28): string | null {
    const n = this.nodesMap.get(id);
    if (!n) return null;
    const newId = uid();
    this.doc.transact(() => {
      const copy = new Y.Map<any>();
      copy.set("id", newId);
      copy.set("boardId", n.get("boardId"));
      copy.set("type", n.get("type"));
      copy.set("x", (n.get("x") ?? 0) + offset);
      copy.set("y", (n.get("y") ?? 0) + offset);
      copy.set("w", n.get("w"));
      copy.set("h", n.get("h"));
      copy.set("z", this.nextZ(n.get("boardId")));
      const src = n.get("data");
      const d = new Y.Map<any>();
      if (src instanceof Y.Map) {
        for (const [k, v] of src.entries()) {
          if (v instanceof Y.Array) {
            const arr = new Y.Array<any>();
            arr.push(
              v.map((el: any) => {
                if (el instanceof Y.Map) {
                  const m = new Y.Map<any>();
                  for (const [ek, ev] of el.entries()) m.set(ek, ev);
                  m.set("id", uid()); // fresh ids for copies
                  return m;
                }
                return el;
              }),
            );
            d.set(k, arr);
          } else {
            d.set(k, v);
          }
        }
      }
      copy.set("data", d);
      this.nodesMap.set(newId, copy);
    }, "local");
    return newId;
  }

  bringToFront(id: string) {
    const n = this.nodesMap.get(id);
    if (!n) return;
    this.updateNode(id, { z: this.nextZ(n.get("boardId")) });
  }

  private nextZ(boardId: string): number {
    let max = 0;
    for (const n of this.nodesMap.values()) {
      if (n.get("boardId") === boardId) max = Math.max(max, n.get("z") ?? 0);
    }
    return max + 1;
  }

  // ── edges (connectors) ────────────────────────────────────
  addEdge(
    boardId: string,
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string,
  ): string {
    const id = uid();
    this.doc.transact(() => {
      const e = new Y.Map<any>();
      e.set("id", id);
      e.set("boardId", boardId);
      e.set("source", source);
      e.set("target", target);
      e.set("sourceHandle", sourceHandle ?? "bottom");
      e.set("targetHandle", targetHandle ?? "top");
      e.set("etype", "elbow");
      e.set("label", "");
      e.set("color", null);
      e.set("animated", 0);
      e.set("arrows", "end");
      this.edgesMap.set(id, e);
    }, "local");
    return id;
  }

  updateEdge(id: string, patch: Record<string, any>) {
    const e = this.edgesMap.get(id);
    if (!e) return;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) e.set(k, v);
    }, "local");
  }

  deleteEdge(id: string) {
    this.doc.transact(() => {
      this.edgesMap.delete(id);
    }, "local");
  }

  // ── tags ──────────────────────────────────────────────────
  addTag(name: string, color: string): string {
    const id = uid();
    this.doc.transact(() => {
      const m = new Y.Map<any>();
      m.set("id", id);
      m.set("name", name);
      m.set("color", color);
      this.tagsMap.set(id, m);
    }, "local");
    return id;
  }

  updateTag(id: string, patch: Record<string, any>) {
    const t = this.tagsMap.get(id);
    if (!t) return;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) t.set(k, v);
    }, "local");
  }

  deleteTag(id: string) {
    this.doc.transact(() => {
      this.tagsMap.delete(id);
      for (const n of this.nodesMap.values()) {
        const d = n.get("data");
        const tags = d?.get?.("tags");
        if (Array.isArray(tags) && tags.includes(id)) d.set("tags", tags.filter((t: string) => t !== id));
      }
    }, "local");
  }

  // ── misc ──────────────────────────────────────────────────
  factoryReset(bootstrap: (ws: Workspace) => boolean) {
    this.doc.transact(() => {
      this.nodesMap.clear();
      this.edgesMap.clear();
      this.boardsMap.clear();
      this.tagsMap.clear();
    }, "local");
    this.undo.clear();
    bootstrap(this);
  }

  destroy() {
    this.destroyed = true;
    try {
      this.undo.destroy();
      this.webrtc?.destroy();
      this.idb.destroy();
    } catch {
      /* noop */
    }
    this.doc.destroy();
  }
}

// ── helpers ──────────────────────────────────────────────────
function toYArray(items: any[], keys: string[]): Y.Array<any> {
  const arr = new Y.Array<any>();
  arr.push(
    items.map((it) => {
      const m = new Y.Map<any>();
      for (const k of keys) if (it[k] !== undefined) m.set(k, it[k]);
      if (!m.get("id")) m.set("id", uid());
      return m;
    }),
  );
  return arr;
}

function replaceYArray(d: Y.Map<any>, key: string, items: any[], keys: string[]) {
  let arr = d.get(key);
  if (!(arr instanceof Y.Array)) {
    arr = new Y.Array<any>();
    d.set(key, arr);
  }
  if (arr.length) arr.delete(0, arr.length);
  arr.push(
    items.map((it) => {
      const m = new Y.Map<any>();
      for (const k of keys) if (it[k] !== undefined) m.set(k, it[k]);
      if (!m.get("id")) m.set("id", uid());
      return m;
    }),
  );
}

/** Read a node's data Y.Map into a plain snapshot object. */
export function snapshotData(ymap: any): CardData & Record<string, any> {
  const out: any = {};
  if (!(ymap instanceof Y.Map)) return out;
  for (const [k, v] of ymap.entries()) {
    if (v instanceof Y.Array) {
      out[k] = v.map((el: any) =>
        el instanceof Y.Map ? Object.fromEntries(el.entries()) : el,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function defaultColorFor(kind: NodeKind): string {
  return kind === "sticky" ? STICKY_COLORS[3].hex : CARD_COLORS[0].hex;
}
