// Starter workspace content — mirrors the original Questline's out-of-box
// experience: a Home board plus five themed sub-boards and sample cards.
//
// IMPORTANT: every id here is FIXED (not random) so that if two people
// bootstrap the same empty room concurrently, the CRDT merge converges to
// one copy instead of duplicating cards.
import * as Y from "yjs";
import type { Workspace } from "./workspace";
import { STICKY_COLORS, CARD_COLORS } from "./palette";
import { randomRot } from "./util";

const STICKY = STICKY_COLORS;

function initData(map: Y.Map<any>, obj: Record<string, any>) {
  for (const [k, v] of Object.entries(obj)) map.set(k, v);
}

function makeItems(items: [string, string, boolean][]): Y.Array<any> {
  const arr = new Y.Array<any>();
  arr.push(
    items.map(([id, text, done]) => {
      const m = new Y.Map<any>();
      initData(m, { id, text, done });
      return m;
    }),
  );
  return arr;
}

function makeBlocks(blocks: [string, string, string, boolean?][]): Y.Array<any> {
  const arr = new Y.Array<any>();
  arr.push(
    blocks.map(([id, type, text, checked]) => {
      const m = new Y.Map<any>();
      initData(m, { id, type, text, checked: !!checked });
      return m;
    }),
  );
  return arr;
}

export function bootstrapStarter(ws: Workspace) {
  const doc = ws.doc;
  if (ws.boardsMap.size > 0) return false;

  const boards: Record<string, { title: string; icon: string; parentId: string | null }> = {
    home: { title: "Home", icon: "🏠", parentId: null },
    lore: { title: "Game Lore", icon: "📜", parentId: "home" },
    mech: { title: "Mechanics", icon: "🎮", parentId: "home" },
    level: { title: "Level Design", icon: "🗺️", parentId: "home" },
    chars: { title: "Character Sheets", icon: "🧙", parentId: "home" },
    art: { title: "Art Assets", icon: "🎨", parentId: "home" },
  };

  doc.transact(() => {
    for (const [id, b] of Object.entries(boards)) {
      const m = new Y.Map<any>();
      initData(m, { id, title: b.title, icon: b.icon, parentId: b.parentId, color: null });
      ws.boardsMap.set(id, m);
    }

    const tags: [string, string, string][] = [
      ["core", "Core", "#22d3ee"],
      ["art", "Art", "#f472b6"],
      ["audio", "Audio", "#84cc16"],
      ["writing", "Writing", "#facc15"],
      ["bug", "Bug", "#f87171"],
    ];
    for (const [id, name, color] of tags) {
      const m = new Y.Map<any>();
      initData(m, { id, name, color });
      ws.tagsMap.set(id, m);
    }

    const addNode = (
      id: string,
      boardId: string,
      type: string,
      x: number,
      y: number,
      data: Record<string, any>,
      w?: number,
    ) => {
      const n = new Y.Map<any>();
      initData(n, { id, boardId, type, x, y, w: w ?? 240, h: 0, z: 0 });
      const d = new Y.Map<any>();
      const { items, blocks, ...rest } = data as any;
      initData(d, rest);
      if (items) d.set("items", makeItems(items));
      if (blocks) d.set("blocks", makeBlocks(blocks));
      n.set("data", d);
      ws.nodesMap.set(id, n);
    };

    // —— Home board content ——
    addNode("n-home-welcome", "home", "sticky", 60, 90, {
      text: "Welcome to Questline!\n\nDouble-click the canvas for a quick sticky, drag from a card's edge dots to connect, and press Ctrl+K for everything else.",
      color: STICKY[3].hex,
      rot: randomRot(),
    }, 260);
    addNode("n-home-note", "home", "note", 380, 80, {
      title: "How this build works",
      blocks: [
        ["n-home-b1", "h2", "No server needed"],
        ["n-home-b2", "p", "Questline now runs 100% in your browser. Every edit is saved locally (IndexedDB) instantly."],
        ["n-home-b3", "h2", "Live collaboration"],
        ["n-home-b4", "p", "Anyone opening the same share link syncs live over peer-to-peer WebRTC — cursors and all."],
        ["n-home-b5", "h2", "Cloud sync (optional)"],
        ["n-home-b6", "p", "Paste a free Firebase config in Settings → Cloud to invite teammates by Google email and sync even when people are offline."],
      ],
    }, 300);
    addNode("n-home-link", "home", "link", 760, 110, {
      title: "Original Questline repo",
      desc: "The server-based original this static edition was rewritten from.",
      href: "https://github.com/EeebsieKat/Questline",
      tags: ["core"],
    }, 260);

    // board cards for the five sub-boards
    addNode("n-home-b-lore", "home", "board", 60, 400, { targetBoardId: "lore" }, 190);
    addNode("n-home-b-mech", "home", "board", 270, 400, { targetBoardId: "mech" }, 190);
    addNode("n-home-b-level", "home", "board", 480, 400, { targetBoardId: "level" }, 190);
    addNode("n-home-b-chars", "home", "board", 690, 400, { targetBoardId: "chars" }, 190);
    addNode("n-home-b-art", "home", "board", 900, 400, { targetBoardId: "art" }, 190);

    addNode("n-home-tip", "home", "sticky", 760, 560, {
      text: "Tip: right-click the canvas to add any card anywhere.",
      color: STICKY[0].hex,
      rot: randomRot(),
    }, 200);

    // —— Game Lore ——
    addNode("n-lore-pitch", "lore", "note", 80, 90, {
      title: "Pitch — one paragraph",
      blocks: [
        ["n-lore-b1", "p", "A Keeper tends the last lighthouse between worlds. Every night, something knocks."],
        ["n-lore-b2", "bullet", "Genre: atmospheric action-puzzle"],
        ["n-lore-b3", "bullet", "Vibe: Ghibli warmth × Hollow Knight dread"],
        ["n-lore-b4", "check", "Lock the core fantasy first", true],
        ["n-lore-b5", "check", "Write the 60-second pitch"],
      ],
    }, 300);
    addNode("n-lore-s1", "lore", "sticky", 460, 100, {
      text: "The lighthouse beam reveals memories…",
      color: STICKY[4].hex,
      rot: randomRot(),
    }, 200);
    addNode("n-lore-s2", "lore", "sticky", 460, 320, {
      text: "…but it also attracts what remembers you.",
      color: STICKY[1].hex,
      rot: randomRot(),
    }, 200);

    // —— Mechanics ——
    addNode("n-mech-tasks", "mech", "task", 80, 90, {
      title: "Vertical slice tasks",
      items: [
        ["n-mech-i1", "Player movement (coyote time!)", true],
        ["n-mech-i2", "Lantern light radius mechanic", true],
        ["n-mech-i3", "First enemy: The Listener", false],
        ["n-mech-i4", "Lighthouse day/night loop", false],
        ["n-mech-i5", "Boss: The Keeper of Names", false],
      ],
    }, 280);
    addNode("n-mech-code", "mech", "code", 80, 420, {
      title: "Coyote time",
      lang: "gdscript",
      code: "extends CharacterBody2D\n\nconst COYOTE := 0.12\nvar _air_time := 0.0\n\nfunc _physics_process(delta: float) -> void:\n\tif is_on_floor():\n\t\t_air_time = 0.0\n\telse:\n\t\t_air_time += delta\n\tif Input.is_action_just_pressed(\"jump\") and _air_time < COYOTE:\n\t\tvelocity.y = JUMP_SPEED\n\tmove_and_slide()",
    }, 340);

    // —— Level Design: mini dialogue flowchart ——
    addNode("n-level-start", "level", "shape", 140, 120, { shape: "start-end", shapeText: "Knock, knock", color: CARD_COLORS[4].hex }, 170);
    addNode("n-level-dec", "level", "shape", 130, 280, { shape: "decision", shapeText: "Open the door?", color: CARD_COLORS[1].hex }, 160);
    addNode("n-level-fight", "level", "shape", 380, 250, { shape: "process", shapeText: "Fight", color: CARD_COLORS[2].hex }, 140);
    addNode("n-level-talk", "level", "shape", 380, 400, { shape: "process", shapeText: "Talk it out", color: CARD_COLORS[5].hex }, 140);
    addNode("n-level-end", "level", "shape", 640, 320, { shape: "input-output", shapeText: "New memory", color: CARD_COLORS[3].hex }, 150);

    const addEdge = (id: string, source: string, target: string, label: string, arrows = "end" as const) => {
      const e = new Y.Map<any>();
      initData(e, { id, boardId: "level", source, target, sourceHandle: "bottom", targetHandle: "top", etype: "elbow", label, color: null, animated: 0, arrows });
      ws.edgesMap.set(id, e);
    };
    addEdge("n-level-e1", "n-level-start", "n-level-dec", "");
    addEdge("n-level-e2", "n-level-dec", "n-level-fight", "yes");
    addEdge("n-level-e3", "n-level-dec", "n-level-talk", "no");
    addEdge("n-level-e4", "n-level-fight", "n-level-end", "");
    addEdge("n-level-e5", "n-level-talk", "n-level-end", "");

    addNode("n-level-tip", "level", "sticky", 620, 90, {
      text: "Dialogue trees: use shapes + labeled connectors.",
      color: STICKY[5].hex,
      rot: randomRot(),
    }, 200);

    // —— Character Sheets ——
    addNode("n-chars-mira", "chars", "task", 80, 90, {
      title: "Mira — the Keeper",
      items: [
        ["n-chars-i1", "Backstory: raised by the previous Keeper", false],
        ["n-chars-i2", "Flaw: cannot refuse a knock", false],
        ["n-chars-i3", "Arc: learns some doors must stay shut", false],
      ],
    }, 280);
    addNode("n-chars-s1", "chars", "sticky", 430, 110, {
      text: "The Listener: hears intentions, not words.",
      color: STICKY[2].hex,
      rot: randomRot(),
    }, 210);

    // —— Art Assets ——
    addNode("n-art-pal", "art", "sticky", 80, 90, {
      text: "Palette: moonlight teal + lantern amber + ink black.",
      color: STICKY[3].hex,
      rot: randomRot(),
    }, 220);
    addNode("n-art-list", "art", "task", 80, 300, {
      title: "Asset list",
      items: [
        ["n-art-i1", "Lighthouse exterior concepts", false],
        ["n-art-i2", "Mira sprite sheet (idle, walk, lantern)", false],
        ["n-art-i3", "The Listener — 3 concepts", false],
      ],
    }, 280);
  }, "bootstrap");

  return true;
}
