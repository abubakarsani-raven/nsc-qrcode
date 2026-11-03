"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  FRONT_TEMPLATES,
  FRONT_TEMPLATE_IDS,
  type Brand,
  type FrontTemplateId,
} from "@/lib/id-card/slots.generated";
import { BRAND_LABELS, FRONT_TEMPLATE_LABELS } from "@/lib/id-card/template-labels";

const STATUS_ITEMS = {
  ALL: "All statuses",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
} as const;

const APPROVAL_ITEMS = {
  ALL: "All approvals",
  PENDING: "Pending",
  APPROVED: "Approved",
} as const;

const BRANDS: Brand[] = ["NSC", "NPERA"];

function designLabel(id: FrontTemplateId) {
  return `${FRONT_TEMPLATES[id].brand === "NPERA" ? "" : "NSC · "}${FRONT_TEMPLATE_LABELS[id]}`;
}

export function StaffFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const status = (sp.get("status") as keyof typeof STATUS_ITEMS | null) ?? "ALL";
  const approval = (sp.get("approvalState") as keyof typeof APPROVAL_ITEMS | null) ?? "ALL";
  const design = (sp.get("frontTemplate") as FrontTemplateId | null) ?? "ALL";
  const missingPhoto = sp.get("missingPhoto") === "1";

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "ALL") params.delete(k);
      else params.set(k, v);
    });
    const qs = params.toString();
    router.push(qs ? `/staff?${qs}` : "/staff");
  }

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  useEffect(() => {
    const current = sp.get("q") ?? "";
    if (q === current) return;
    const id = window.setTimeout(() => {
      apply({ q: q.trim() || null });
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search only
  }, [q]);

  const chips: { key: string; label: string; clear: Record<string, string | null> }[] = [];
  if (q.trim()) chips.push({ key: "q", label: `Search: ${q.trim()}`, clear: { q: null } });
  if (status !== "ALL" && STATUS_ITEMS[status]) {
    chips.push({ key: "status", label: STATUS_ITEMS[status], clear: { status: null } });
  }
  if (approval !== "ALL" && APPROVAL_ITEMS[approval]) {
    chips.push({
      key: "approval",
      label: APPROVAL_ITEMS[approval],
      clear: { approvalState: null },
    });
  }
  if (design !== "ALL" && FRONT_TEMPLATES[design]) {
    chips.push({ key: "design", label: designLabel(design), clear: { frontTemplate: null } });
  }
  if (missingPhoto) {
    chips.push({ key: "photo", label: "Missing photo", clear: { missingPhoto: null } });
  }

  return (
    <Stack spacing={1.5} sx={{ pb: 2 }}>
      <Stack
        component="form"
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || null });
        }}
      >
        <TextField
          label="Search"
          placeholder="Name, ID or designation"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 2, minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon aria-hidden className="size-5" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Status"
          value={STATUS_ITEMS[status] ? status : "ALL"}
          onChange={(e) => apply({ status: e.target.value })}
          sx={{ flex: 1, minWidth: 150 }}
        >
          {(Object.keys(STATUS_ITEMS) as (keyof typeof STATUS_ITEMS)[]).map((id) => (
            <MenuItem key={id} value={id}>
              {STATUS_ITEMS[id]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Approval"
          value={APPROVAL_ITEMS[approval] ? approval : "ALL"}
          onChange={(e) => apply({ approvalState: e.target.value })}
          sx={{ flex: 1, minWidth: 150 }}
        >
          {(Object.keys(APPROVAL_ITEMS) as (keyof typeof APPROVAL_ITEMS)[]).map((id) => (
            <MenuItem key={id} value={id}>
              {APPROVAL_ITEMS[id]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Card design"
          value={design !== "ALL" && FRONT_TEMPLATES[design] ? design : "ALL"}
          onChange={(e) => apply({ frontTemplate: e.target.value })}
          sx={{ flex: 1.2, minWidth: 170 }}
        >
          <MenuItem value="ALL">All designs</MenuItem>
          {BRANDS.flatMap((brand) => [
            <ListSubheader key={brand}>{BRAND_LABELS[brand]}</ListSubheader>,
            ...FRONT_TEMPLATE_IDS.filter((id) => FRONT_TEMPLATES[id].brand === brand).map((id) => (
              <MenuItem key={id} value={id}>
                {FRONT_TEMPLATE_LABELS[id]}
              </MenuItem>
            )),
          ])}
        </TextField>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Chip
          label="Needs photo"
          clickable
          color={missingPhoto ? "primary" : "default"}
          variant={missingPhoto ? "filled" : "outlined"}
          onClick={() => apply({ missingPhoto: missingPhoto ? null : "1" })}
        />
        <Chip
          label="Needs approval"
          clickable
          color={approval === "PENDING" ? "primary" : "default"}
          variant={approval === "PENDING" ? "filled" : "outlined"}
          onClick={() => apply({ approvalState: approval === "PENDING" ? null : "PENDING" })}
        />
        {chips.length > 0 ? (
          <>
            {chips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                onDelete={() => apply(chip.clear)}
                sx={{
                  bgcolor: "var(--md-secondary-container)",
                  color: "var(--md-on-secondary-container)",
                }}
              />
            ))}
            <Button size="small" variant="text" onClick={() => router.push("/staff")}>
              Clear all
            </Button>
          </>
        ) : null}
      </Stack>
    </Stack>
  );
}
