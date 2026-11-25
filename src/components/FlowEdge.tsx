// Custom connector with editable inline label, 4 routing styles,
// 7 colors, animated dashes and arrowheads on either/both ends.
import { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import { useApp } from "../lib/store";
import type { FlowEdge as FlowEdgeT } from "../types";

const DEFAULT_COLOR = "#7d8aa8";

export function FlowEdge(props: EdgeProps<FlowEdgeT>) {
  const ws = useApp((s) => s.workspace)!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    markerStart,
    markerEnd,
  } = props;

  const etype = data?.etype ?? "elbow";
  const color = data?.color ?? DEFAULT_COLOR;
  const label = data?.label ?? "";

  let pathParams: [string, number, number];
  if (etype === "bezier") {
    const [p, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.3 });
    pathParams = [p, lx, ly];
  } else if (etype === "straight") {
    const [p, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    pathParams = [p, lx, ly];
  } else {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: etype === "steps" ? 0 : 14,
      offset: 24,
    });
    pathParams = [p, lx, ly];
  }
  const [path, labelX, labelY] = pathParams;

  const commit = () => {
    ws.updateEdge(id, { label: draft });
    setEditing(false);
  };

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        strokeLinecap="round"
        style={{ pointerEvents: "stroke" }}
      />
      <path
        d={path}
        fill="none"
        stroke={selected ? "#22d3ee" : color}
        strokeWidth={selected ? 2.4 : 2}
        markerStart={markerStart}
        markerEnd={markerEnd}
        className={data?.animated ? "edge-animated react-flow__edge-path" : "react-flow__edge-path"}
        style={{ pointerEvents: "none" }}
      />
      {(label || selected || editing) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(false);
                }}
                placeholder="Label…"
                className="bg-canvas border border-accent rounded-md px-1.5 py-0.5 text-[11px] text-ink outline-none w-28 text-center"
              />
            ) : label ? (
              <span
                onDoubleClick={() => {
                  setDraft(label);
                  setEditing(true);
                }}
                className="bg-canvas/95 border border-line rounded-md px-1.5 py-0.5 text-[11px] text-dim"
                title="Double-click to rename"
              >
                {label}
              </span>
            ) : (
              <span className="bg-canvas/95 border border-dashed border-line rounded-md px-1.5 py-0.5 text-[10px] text-faint">
                double-click to label
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
