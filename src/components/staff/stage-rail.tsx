const STAGES = ["Details", "Photo", "Approve", "Print"] as const;

type SegState = "done" | "current" | "todo" | "blocked";

export type StageInput = {
  hasPhoto: boolean;
  approved: boolean;
  suspended: boolean;
  printedAt?: Date | string | null;
};

/**
 * Where a record sits in the production pipeline, as four marks.
 * Details is complete for anything that exists; the rest fill in order, so a
 * column of rails shows at a glance which records are stuck and where.
 */
export function stageStates(s: StageInput): SegState[] {
  if (s.suspended) return ["done", "done", "done", "blocked"];
  const photo: SegState = s.hasPhoto ? "done" : "current";
  const approve: SegState = s.approved ? "done" : s.hasPhoto ? "current" : "todo";
  const print: SegState = s.printedAt
    ? "done"
    : s.approved
      ? "current"
      : "todo";
  return ["done", photo, approve, print];
}

export function stageLabel(states: SegState[]) {
  if (states[3] === "blocked") return "Suspended";
  const current = states.findIndex((x) => x === "current");
  if (current === -1) return "Printed";
  return `Awaiting ${STAGES[current].toLowerCase()}`;
}

export function StageRail({ states }: { states: SegState[] }) {
  const label = stageLabel(states);
  return (
    <span className="stage-rail" role="img" aria-label={label} title={label}>
      {states.map((state, i) => (
        <span key={STAGES[i]} className="stage-seg" data-state={state} />
      ))}
    </span>
  );
}
