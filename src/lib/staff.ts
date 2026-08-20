import type {
  FrontTemplate,
  BackTemplate,
  Staff,
  StaffPublished,
} from "@/generated/prisma/client";
import { FRONT_DEFAULT_BACK, nameColorMismatch } from "@/lib/id-card/slots.generated";

export const PUBLISH_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "designation",
  "idNumber",
  "photoPreviewKey",
  "officeLine",
  "emergencyContactName",
  "emergencyContactPhone",
  "posting",
  "department",
  "bloodGroup",
  "genotype",
  "frontTemplate",
  "backTemplate",
] as const;

export type PublishField = (typeof PUBLISH_FIELDS)[number];

export function displayName(s: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}) {
  const given = [s.firstName, s.middleName].filter(Boolean).join(" ");
  return { surname: s.lastName.toUpperCase(), given: given.toUpperCase() };
}

export function fullName(s: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}) {
  const { surname, given } = displayName(s);
  return `${surname} ${given}`.trim();
}

/** Fields that require re-approval when changed on an approved record */
export function requiresReapproval(
  before: Staff,
  patch: Partial<Staff>,
): boolean {
  const keys: (keyof Staff)[] = [
    "firstName",
    "middleName",
    "lastName",
    "designation",
    "idNumber",
    "photoOriginalKey",
    "photoPreviewKey",
    "photoCrop",
    "frontTemplate",
    "backTemplate",
    "cardTypeScale",
    "officeLine",
    "emergencyContactName",
    "emergencyContactPhone",
    "posting",
    "department",
    "bloodGroup",
    "genotype",
  ];
  return keys.some((k) => patch[k] !== undefined && patch[k] !== before[k]);
}

export function publishedSnapshot(staff: Staff) {
  return {
    firstName: staff.firstName,
    middleName: staff.middleName,
    lastName: staff.lastName,
    designation: staff.designation,
    idNumber: staff.idNumber,
    photoPreviewKey: staff.photoPreviewKey,
    officeLine: staff.officeLine,
    emergencyContactName: staff.emergencyContactName,
    emergencyContactPhone: staff.emergencyContactPhone,
    posting: staff.posting,
    department: staff.department,
    bloodGroup: staff.bloodGroup,
    genotype: staff.genotype,
  };
}

export function defaultBackFor(front: FrontTemplate): BackTemplate {
  return FRONT_DEFAULT_BACK[front] as BackTemplate;
}

export function templateWarning(front: FrontTemplate, back: BackTemplate) {
  if (nameColorMismatch(front, back)) {
    return "Front and back colour families differ (green vs blue).";
  }
  return null;
}

export function draftVsPublishedDiff(draft: Staff, published: StaffPublished | null) {
  if (!published) return null;
  const diffs: { field: string; draft: string; published: string }[] = [];
  const pairs: [string, string | null | undefined, string | null | undefined][] = [
    ["firstName", draft.firstName, published.firstName],
    ["middleName", draft.middleName, published.middleName],
    ["lastName", draft.lastName, published.lastName],
    ["designation", draft.designation, published.designation],
    ["idNumber", draft.idNumber, published.idNumber],
    ["officeLine", draft.officeLine, published.officeLine],
    ["emergencyContactName", draft.emergencyContactName, published.emergencyContactName],
    ["emergencyContactPhone", draft.emergencyContactPhone, published.emergencyContactPhone],
    ["photoPreviewKey", draft.photoPreviewKey, published.photoPreviewKey],
    ["posting", draft.posting, published.posting],
    ["department", draft.department, published.department],
    ["bloodGroup", draft.bloodGroup, published.bloodGroup],
    ["genotype", draft.genotype, published.genotype],
  ];
  for (const [field, d, p] of pairs) {
    if ((d ?? "") !== (p ?? "")) {
      diffs.push({ field, draft: String(d ?? ""), published: String(p ?? "") });
    }
  }
  return diffs;
}
