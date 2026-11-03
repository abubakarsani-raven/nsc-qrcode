import { z } from "zod";
import { optionalDate, optionalText, requiredText } from "@/lib/api";
import { BACK_TEMPLATE_IDS, FRONT_TEMPLATE_IDS } from "@/lib/id-card/slots.generated";

/** Fields an editor may set on a staff record. Shared by create and edit. */
export const staffFields = {
  idNumber: requiredText.max(40),
  firstName: requiredText,
  middleName: optionalText,
  lastName: requiredText,
  designation: requiredText,
  posting: optionalText,
  department: optionalText,
  dateIssued: optionalDate,
  officeLine: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  bloodGroup: optionalText,
  genotype: optionalText,
  frontTemplate: z.enum(FRONT_TEMPLATE_IDS).optional(),
  backTemplate: z.enum(BACK_TEMPLATE_IDS).optional(),
  cardTypeScale: z.string().max(4000).nullish(),
};

export const staffCreateSchema = z.object(staffFields);

export const staffPatchSchema = z.object({
  ...staffFields,
  idNumber: staffFields.idNumber.optional(),
  firstName: staffFields.firstName.optional(),
  lastName: staffFields.lastName.optional(),
  designation: staffFields.designation.optional(),
});

/** Medical fields only APPROVER/ADMIN may read or write. */
export const MEDICAL_FIELDS = ["bloodGroup", "genotype"] as const;
