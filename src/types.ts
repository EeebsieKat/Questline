import type { Edge, Node } from "@xyflow/react";

// ─────────────────────────────────────────────────────────────
// Card kinds (parity with the original Questline)
// ─────────────────────────────────────────────────────────────
export type NodeKind =
  | "sticky"
  | "note"
  | "task"
  | "code"
  | "image"
  | "audio"
  | "link"
  | "board"
  | "shape";

export type ShapeKind = "process" | "decision" | "start-end" | "input-output";

export type NoteBlockType = "h1" | "h2" | "h3" | "p" | "bullet" | "check";

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text: string;
  checked?: boolean;
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

export type EdgeStyleKind = "elbow" | "steps" | "bezier" | "straight";
export type ArrowMode = "none" | "start" | "end" | "both";

// Plain-JS snapshot of a node's `data` Y.Map (nested Y types collapsed).
export interface CardData {
  color?: string;
  tags?: string[];
  rot?: number;
  // sticky
  text?: string;
  // note
  title?: string;
  blocks?: NoteBlock[];
  // task
  items?: TaskItem[];
  // code
  code?: string;
  lang?: string;
  // image / audio
  url?: string;
  caption?: string;
  name?: string;
  // link
  href?: string;
  desc?: string;
  // board reference
  targetBoardId?: string;
  // shape
  shape?: ShapeKind;
  shapeText?: string;
}

export type CardNode = Node<{ nodeId: string }>;

export type FlowEdge = Edge<{
  etype?: EdgeStyleKind;
  label?: string;
  color?: string;
  animated?: boolean;
  arrows?: ArrowMode;
}>;

export interface BoardMeta {
  id: string;
  title: string;
  icon: string;
  color?: string;
  parentId?: string | null;
}

export interface TagMeta {
  id: string;
  name: string;
  color: string;
}

export interface PresenceUser {
  clientId: number;
  name: string;
  color: string;
}

export type CloudState =
  | "off"
  | "signed-out"
  | "connecting"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "denied";

export interface SyncStatus {
  peers: number;
  cloud: CloudState;
  cloudMsg?: string;
  email?: string | null;
  saved: boolean; // local IndexedDB flush state
}
