import type { FrontTemplateId } from "@/lib/id-card/slots.generated";

/** Shared by the server page and the client table (values from a "use client" module are references on the server). */
export const SORT_FIELDS = [
  "name",
  "idNumber",
  "designation",
  "frontTemplate",
  "updatedAt",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type StaffRow = {
  id: string;
  name: string;
  idNumber: string;
  designation: string;
  frontTemplate: FrontTemplateId;
  photoUrl: string | null;
  status: "ACTIVE" | "SUSPENDED";
  approvalState: "PENDING" | "APPROVED";
  hasPendingEdits: boolean;
  printedAt: string | null;
};
