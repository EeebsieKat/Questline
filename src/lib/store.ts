// Global app store (zustand) — workspace handle, sync/presence
// status, identity, UI state and toasts.
import { create } from "zustand";
import type { Workspace } from "./workspace";
import type { FirebaseSync, CloudMeta } from "./firebase-sync";
import type { CloudState, PresenceUser, SyncStatus } from "../types";
import { pickUserColor, USER_COLORS } from "./palette";

export type ModalKind = "share" | "settings" | "palette" | "help" | null;

export interface Toast {
  id: number;
  msg: string;
  kind: "info" | "error" | "success";
}

interface AppState {
  // data
  workspace: Workspace | null;
  firebase: FirebaseSync | null;
  activeBoardId: string;
  rev: number;

  // sync + presence
  sync: SyncStatus;
  cloudMeta: CloudMeta | null;
  presence: PresenceUser[];
  remoteSel: Record<string, string>;

  // identity
  userName: string;
  userColor: string;

  // ui
  dockOpen: boolean;
  snap: boolean;
  modal: ModalKind;
  toasts: Toast[];

  // actions
  setWorkspace: (ws: Workspace, fb: FirebaseSync | null) => void;
  bumpRev: () => void;
  setSync: (patch: Partial<SyncStatus>) => void;
  setCloud: (state: CloudState, msg?: string) => void;
  setCloudMeta: (meta: CloudMeta | null) => void;
  setPresence: (users: PresenceUser[], remoteSel: Record<string, string>, peers: number) => void;
  setActiveBoard: (id: string) => void;
  setIdentity: (name: string, color?: string) => void;
  setFirebase: (fb: FirebaseSync | null) => void;
  setModal: (m: ModalKind) => void;
  toggleDock: () => void;
  setSnap: (v: boolean) => void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 1;

function loadIdentity(): { name: string; color: string } {
  const name = localStorage.getItem("ql-name") || `Dev-${Math.floor(100 + Math.random() * 900)}`;
  const color = localStorage.getItem("ql-color") || pickUserColor(name);
  localStorage.setItem("ql-name", name);
  localStorage.setItem("ql-color", color);
  return { name, color };
}

export function randomUserColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export const useApp = create<AppState>((set, get) => ({
  workspace: null,
  firebase: null,
  activeBoardId: "",
  rev: 0,

  sync: { peers: 0, cloud: "off", email: null, saved: false },
  cloudMeta: null,
  presence: [],
  remoteSel: {},

  userName: "",
  userColor: "",

  dockOpen: localStorage.getItem("ql-dock") !== "0",
  snap: localStorage.getItem("ql-snap") !== "0",
  modal: null,
  toasts: [],

  setWorkspace: (ws, fb) => {
    const id = loadIdentity();
    ws.setIdentity({ name: id.name, color: id.color });
    set({
      workspace: ws,
      firebase: fb,
      userName: id.name,
      userColor: id.color,
      activeBoardId: "",
    });
  },

  bumpRev: () => set((s) => ({ rev: s.rev + 1 })),

  setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),

  setCloud: (state, msg) =>
    set((s) => ({ sync: { ...s.sync, cloud: state, cloudMsg: msg } })),

  setCloudMeta: (meta) => set({ cloudMeta: meta }),

  setPresence: (users, remoteSel, peers) =>
    set((s) => ({
      presence: users,
      remoteSel,
      sync: { ...s.sync, peers },
    })),

  setActiveBoard: (id) => {
    const ws = get().workspace;
    if (ws) {
      ws.setBoard(id);
      localStorage.setItem(`ql-last-board-${ws.id}`, id);
    }
    set({ activeBoardId: id });
  },

  setIdentity: (name, color) => {
    const c = color ?? get().userColor;
    localStorage.setItem("ql-name", name);
    localStorage.setItem("ql-color", c);
    get().workspace?.setIdentity({ name, color: c });
    set({ userName: name, userColor: c });
  },

  setFirebase: (fb) => set({ firebase: fb }),

  setModal: (m) => set({ modal: m }),

  toggleDock: () =>
    set((s) => {
      localStorage.setItem("ql-dock", s.dockOpen ? "0" : "1");
      return { dockOpen: !s.dockOpen };
    }),

  setSnap: (v) => {
    localStorage.setItem("ql-snap", v ? "1" : "0");
    set({ snap: v });
  },

  toast: (msg, kind = "info") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind }] }));
    setTimeout(() => get().dismissToast(id), 3800);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
