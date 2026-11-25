// ─────────────────────────────────────────────────────────────
// FirebaseSync — optional cloud layer.
//
// When a Firebase config is pasted in Settings:
//   • Google sign-in gates the workspace (rules enforce invites)
//   • the Yjs doc is persisted to Firestore as an append-only
//     update log, so edits sync even when nobody is online
//   • board access is controlled by a collaborator email list
//     managed by the owner
//   • the P2P room is keyed by a secret from Firestore, so
//     non-members cannot join the live layer either
//
// Everything is dynamically imported so P2P-only users never
// download the Firebase bundle.
// ─────────────────────────────────────────────────────────────
import * as Y from "yjs";
import type { Workspace } from "./workspace";
import type { CloudState } from "../types";
import { uid } from "./util";

export interface CloudMeta {
  ownerEmail: string;
  collaborators: string[];
  roomSecret: string | null;
  name: string;
}

export interface FirebaseHooks {
  onState: (state: CloudState, msg?: string) => void;
  onUser: (email: string | null, name: string | null) => void;
  onMeta: (meta: CloudMeta) => void;
  getPeers: () => number;
}

const UPDATES_LIMIT = 480;
const FLUSH_DEBOUNCE = 1200;
const POLL_INTERVAL = 25_000;
const COMPACT_AT = 260;

export function parseFirebaseConfig(raw: string): Record<string, string> | null {
  let text = raw.trim();
  if (!text) return null;
  // accept full `const firebaseConfig = {...};` snippets as well as JSON
  const eq = text.indexOf("=");
  if (eq > -1 && !text.trimStart().startsWith("{")) text = text.slice(eq + 1);
  text = text.trim().replace(/;+\s*$/, "");
  try {
    const obj = JSON.parse(text);
    return validateConfig(obj);
  } catch {
    /* try object literal */
  }
  try {
    // eslint-disable-next-line no-new-func
    const obj = new Function(`return (${text})`)();
    return validateConfig(obj);
  } catch {
    return null;
  }
}

function validateConfig(obj: any): Record<string, string> | null {
  if (!obj || typeof obj !== "object") return null;
  if (!obj.apiKey || !obj.projectId || !obj.appId) return null;
    const out: Record<string, string> = {
    apiKey: String(obj.apiKey),
    projectId: String(obj.projectId),
    appId: String(obj.appId),
  };
  if (obj.authDomain) out.authDomain = String(obj.authDomain);
  if (obj.messagingSenderId) out.messagingSenderId = String(obj.messagingSenderId);
  if (obj.storageBucket) out.storageBucket = String(obj.storageBucket);
  return out;
}

function b64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class FirebaseSync {
  private ws: Workspace;
  private hooks: FirebaseHooks;
  // lazily typed — firebase modules are dynamically imported
  private db: any; // Firestore instance
  private fsm: any; // firebase/firestore module
  private auth: any;
  private authm: any;
  private fb: any;
  private unsubMeta: (() => void) | null = null;
  private queue: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastT = 0;
  private updateCount = 0;
  private email: string | null = null;
  private connected = false;
  private destroyed = false;
  private meta: CloudMeta | null = null;

  user: any = null;
  collaborators: string[] = [];
  ownerEmail = "";
  get isOwner(): boolean {
    return !!this.email && this.email === this.ownerEmail;
  }

  private constructor(ws: Workspace, hooks: FirebaseHooks) {
    this.ws = ws;
    this.hooks = hooks;
  }

  /** Returns null when the config is invalid. Throws are caught → state error. */
  static async connect(
    config: Record<string, string>,
    ws: Workspace,
    hooks: FirebaseHooks,
  ): Promise<FirebaseSync | null> {
    const sync = new FirebaseSync(ws, hooks);
    const ok = await sync.init(config);
    return ok ? sync : null;
  }

  private async init(config: Record<string, string>): Promise<boolean> {
    try {
      this.hooks.onState("connecting");
      this.fb = await import("firebase/app");
      const authMod = await import("firebase/auth");
      const fsMod = await import("firebase/firestore");

      let app: any;
      try {
        app = this.fb.getApp("questline");
      } catch {
        app = this.fb.initializeApp(config, "questline");
      }
      this.auth = authMod.getAuth(app);
      await authMod.setPersistence(this.auth, authMod.browserLocalPersistence);
      this.authm = authMod;

      this.db = fsMod.getFirestore(app);
      this.fsm = fsMod;

      // ── auth ──────────────────────────────────────────────
      const ensureUser = async (): Promise<any> => {
        if (this.auth.currentUser) return this.auth.currentUser;
        const provider = new authMod.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        try {
          const cred = await authMod.signInWithPopup(this.auth, provider);
          return cred.user;
        } catch (e: any) {
          if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") {
            await authMod.signInWithRedirect(this.auth, provider);
            return null; // page will reload into redirect result
          }
          if (e?.code === "auth/unauthorized-domain") {
            this.hooks.onState(
              "error",
              `This domain (${location.host}) is not authorized in Firebase Auth. Add it under Authentication → Settings → Authorized domains.`,
            );
            return null;
          }
          if (e?.code === "auth/popup-closed-by-user") {
            this.hooks.onState("signed-out", "Sign in to sync this workspace to the cloud.");
            return null;
          }
          throw e;
        }
      };

      // handle a returning redirect
      try {
        await authMod.getRedirectResult(this.auth);
      } catch {
        /* noop */
      }

      let user = this.auth.currentUser;
      if (!user) user = await ensureUser();
      if (!user) return true; // stays signed-out; user can retry via UI

      this.user = user;
      this.email = user.email ?? null;
      this.hooks.onUser(this.email, user.displayName);
      this.hooks.onState("connecting");

      authMod.onAuthStateChanged(this.auth, (u: any) => {
        if (!u && !this.destroyed) {
          this.hooks.onUser(null, null);
          this.hooks.onState("signed-out");
        }
      });

      // ── workspace doc: read or claim ──────────────────────
      const wref = this.fbDocRef(`questline/${this.ws.id}`);
      const snap = await this.fbGetDoc(wref);
      if (!snap.exists()) {
        const meta = {
          name: "Questline workspace",
          ownerEmail: this.email,
          collaborators: [this.email],
          roomSecret: uid() + uid(),
          createdAt: this.fbServerTimestamp(),
        };
        await this.fbSetDoc(wref, meta);
      }

      this.unsubMeta = this.fbOnSnapshot(wref, {
        next: (msnap: any) => {
          if (!msnap.exists()) return;
          const d = msnap.data();
          this.ownerEmail = d.ownerEmail ?? "";
          this.collaborators = d.collaborators ?? [];
          this.meta = {
            ownerEmail: this.ownerEmail,
            collaborators: this.collaborators,
            roomSecret: d.roomSecret ?? null,
            name: d.name ?? "Questline workspace",
          };
          this.hooks.onMeta(this.meta);
          // gate the live room behind membership
          if (this.email && !this.collaborators.includes(this.email)) {
            this.hooks.onState("denied");
            this.ws.setRoomSecret(null);
          } else {
            this.ws.setRoomSecret(this.meta.roomSecret);
          }
        },
        error: () => {
          if (!this.destroyed) this.hooks.onState("error", "Lost access to the workspace document.");
        },
      });

      if (!this.collaborators.includes(this.email ?? "") && snap.exists()) {
        const d = snap.data();
        if (d && Array.isArray(d.collaborators) && !d.collaborators.includes(this.email)) {
          this.hooks.onState("denied");
          return true;
        }
      }

      // ── load cloud state, then catch up local → cloud ─────
      const col = this.fbCollection(`questline/${this.ws.id}/updates`);
      const loaded = await this.fbGetDocs(this.fbQuery(col));
      const updates: Uint8Array[] = [];
      loaded.forEach((doc: any) => {
        const d = doc.data();
        this.lastT = Math.max(this.lastT, d.t ?? 0);
        this.updateCount++;
        if (Array.isArray(d.u)) {
          for (const b of d.u) {
            try {
              updates.push(bytesFromB64(b));
            } catch {
              /* skip corrupt */
            }
          }
        }
      });

      const svLocal = Y.encodeStateVector(this.ws.doc);
      if (updates.length) {
        this.ws.doc.transact(() => {
          for (const u of updates) Y.applyUpdate(this.ws.doc, u, "firebase");
        }, "firebase");
      }
      // compute what the cloud is missing relative to our local state
      const scratch = new Y.Doc();
      for (const u of updates) Y.applyUpdate(scratch, u, "firebase");
      const svCloud = Y.encodeStateVector(scratch);
      const missing = Y.encodeStateAsUpdate(this.ws.doc, svCloud);
      if (missing.length > 2) this.queueUpdate(missing);

      // future local edits → queue
      this.ws.doc.on("update", this.onDocUpdate);
      this.connected = true;
      this.hooks.onState("syncing");
      this.scheduleFlush(50);

      // poll for async updates while alone (P2P covers live moments)
      this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);

      const flushOnHide = () => {
        if (document.visibilityState === "hidden") this.flushNow();
      };
      document.addEventListener("visibilitychange", flushOnHide);
      window.addEventListener("online", () => this.scheduleFlush(100));
      return true;
    } catch (e: any) {
      console.error("[questline] firebase init failed", e);
      const msg =
        e?.code === "permission-denied"
          ? "Permission denied by Firestore rules — make sure you published the Questline rules and enabled Google sign-in (see README)."
          : e?.message || String(e);
      this.hooks.onState("error", msg);
      return true; // connected enough to surface the error state
    }
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "firebase" || origin === this) return;
    this.queueUpdate(update);
  };

  private queueUpdate(update: Uint8Array) {
    if (!this.connected || this.destroyed) return;
    this.queue.push(update);
    this.hooks.onState("syncing");
    this.scheduleFlush(FLUSH_DEBOUNCE);
  }

  private scheduleFlush(ms: number) {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushNow();
    }, ms);
  }

  async flushNow() {
    if (this.destroyed || !this.connected || !this.queue.length || !this.email) return;
    if (this.meta && !this.collaborators.includes(this.email)) return;
    const batch = this.queue;
    this.queue = [];
    try {
      const now = Date.now();
      const payload = batch.map(b64FromBytes);
      const col = this.fbCollection(`questline/${this.ws.id}/updates`);
      await this.fbSetDoc(this.fbNewDoc(col), { u: payload, t: now, by: this.email });
      this.lastT = Math.max(this.lastT, now);
      this.updateCount++;
      this.hooks.onState("synced");
      if (this.updateCount >= COMPACT_AT) await this.compact();
    } catch (e: any) {
      // put the batch back and retry on next change / poll
      this.queue.unshift(...batch);
      if (e?.code === "permission-denied") {
        this.hooks.onState("denied", "You no longer have access to this workspace.");
      } else {
        this.hooks.onState("offline", "Offline — changes are saved locally and will sync.");
      }
    }
  }

  private async compact() {
    try {
      const col = this.fbCollection(`questline/${this.ws.id}/updates`);
      const state = Y.encodeStateAsUpdate(this.ws.doc);
      if (b64FromBytes(state).length > 900_000) {
        this.updateCount = 0; // too big to compact safely; just reset the counter
        return;
      }
      const loaded = await this.fbGetDocs(this.fbQuery(col));
      const now = Date.now();
      const oldIds: string[] = [];
      loaded.forEach((doc: any) => {
        if ((doc.data().t ?? 0) < now) oldIds.push(doc.id);
      });
      await this.fbSetDoc(this.fbNewDoc(col), { u: [b64FromBytes(state)], t: now, by: this.email, snap: true });
      // delete the docs folded into the snapshot
      for (let i = 0; i < oldIds.length; i += 400) {
        const slice = oldIds.slice(i, i + 400);
        const b = this.fbWriteBatch();
        for (const id of slice) b.delete(this.fbDocId(`questline/${this.ws.id}/updates`, id));
        await b.commit();
      }
      this.updateCount = 1;
    } catch {
      /* compaction is best-effort */
    }
  }

  private async poll() {
    if (this.destroyed || !this.connected) return;
    if (this.hooks.getPeers() > 0) return; // live P2P covers it
    try {
      const col = this.fbCollection(`questline/${this.ws.id}/updates`);
      const q = this.fbQuery(
        col,
        this.fsm.orderBy("t"),
        this.fsm.startAfter(this.lastT),
        this.fsm.limit(UPDATES_LIMIT),
      );
      const snap = await this.fbGetDocs(q);
      let found = false;
      const updates: Uint8Array[] = [];
      snap.forEach((doc: any) => {
        const d = doc.data();
        this.lastT = Math.max(this.lastT, d.t ?? 0);
        this.updateCount++;
        found = true;
        if (Array.isArray(d.u)) for (const b of d.u) updates.push(bytesFromB64(b));
      });
      if (updates.length) {
        this.ws.doc.transact(() => {
          for (const u of updates) Y.applyUpdate(this.ws.doc, u, "firebase");
        }, "firebase");
      }
      if (found) this.hooks.onState("synced");
    } catch {
      /* offline — try again next tick */
    }
  }

  // ── membership management (owner) ──────────────────────────
  async invite(email: string): Promise<string | null> {
    email = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a valid email address.";
    if (this.collaborators.includes(email)) return "Already invited.";
    try {
      await this.fbUpdateDoc(this.fbDocRef(`questline/${this.ws.id}`), {
        collaborators: this.fsm.arrayUnion(email),
      });
      return null;
    } catch (e: any) {
      return e?.message || "Could not invite.";
    }
  }

  async removeCollaborator(email: string): Promise<void> {
    try {
      await this.fbUpdateDoc(this.fbDocRef(`questline/${this.ws.id}`), {
        collaborators: this.fsm.arrayRemove(email),
      });
    } catch {
      /* noop */
    }
  }

  async renameWorkspace(name: string): Promise<void> {
    if (!this.isOwner) return;
    try {
      await this.fbUpdateDoc(this.fbDocRef(`questline/${this.ws.id}`), { name: name.slice(0, 80) });
    } catch {
      /* noop */
    }
  }

  async signOut() {
    try {
      const authMod = await import("firebase/auth");
      await authMod.signOut(this.auth);
    } catch {
      /* noop */
    }
  }

  destroy() {
    this.destroyed = true;
    this.connected = false;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    try {
      this.ws.doc.off("update", this.onDocUpdate);
    } catch {
      /* noop */
    }
    this.unsubMeta?.();
  }

  // ── thin wrappers so dynamic imports stay in one place ─────
  private fbDocRef(path: string) {
    return this.fsm.doc(this.db, path);
  }
  private fbDocId(path: string, id: string) {
    return this.fsm.doc(this.db, path, id);
  }
  private fbNewDoc(colRef: any) {
    return this.fsm.doc(colRef);
  }
  private fbCollection(path: string) {
    return this.fsm.collection(this.db, path);
  }
  private fbGetDoc(ref: any) {
    return this.fsm.getDoc(ref);
  }
  private fbSetDoc(ref: any, data: any) {
    return this.fsm.setDoc(ref, data);
  }
  private fbUpdateDoc(ref: any, data: any) {
    return this.fsm.updateDoc(ref, data);
  }
  private fbOnSnapshot(ref: any, cbs: any) {
    return this.fsm.onSnapshot(ref, cbs);
  }
  private fbGetDocs(q: any) {
    return this.fsm.getDocs(q);
  }
  private fbQuery(col: any, ...rest: any[]) {
    return this.fsm.query(col, ...rest);
  }
  private fbWriteBatch() {
    return this.fsm.writeBatch(this.db);
  }
  private fbServerTimestamp() {
    return this.fsm.serverTimestamp();
  }
}
