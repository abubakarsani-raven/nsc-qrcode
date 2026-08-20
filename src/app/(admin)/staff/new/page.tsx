import { Suspense } from "react";
import { StaffEditor } from "../staff-editor";

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="nsc-page-title">Add staff</h1>
        <p className="nsc-page-sub">
          Create a draft record, then add a photo before approval.
        </p>
      </div>
      <Suspense fallback={<div className="md-card h-40 animate-pulse" />}>
        <StaffEditor />
      </Suspense>
    </div>
  );
}
