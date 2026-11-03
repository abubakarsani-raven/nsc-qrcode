"use client";

import { useMemo, useState } from "react";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Link from "@mui/material/Link";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
} from "@mui/x-data-grid";
import { StageRail, stageStates } from "@/components/staff/stage-rail";
import { StatusChip } from "@/components/staff/status-chip";
import { LinkButton } from "@/components/mui/link-button";
import { FRONT_TEMPLATE_LABELS } from "@/lib/id-card/template-labels";
import type { FrontTemplateId } from "@/lib/id-card/slots.generated";
import { monoFont } from "@/theme/mui-theme";
import { StaffBulkActions } from "./staff-bulk-actions";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type SortField, type StaffRow } from "./staff-table-config";

type Props = {
  rows: StaffRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: SortField;
  dir: "asc" | "desc";
  matchingIds: string[];
  hasFilters: boolean;
};

function stagesOf(r: StaffRow) {
  return stageStates({
    hasPhoto: Boolean(r.photoUrl),
    approved: r.approvalState === "APPROVED",
    suspended: r.status === "SUSPENDED",
    printedAt: r.printedAt,
  });
}

function TemplateCell({ id }: { id: FrontTemplateId }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
      <Box
        component="img"
        src={`/id-card/templates/thumbs/${id}.webp`}
        alt=""
        sx={{
          height: 40,
          width: "auto",
          borderRadius: 0.5,
          boxShadow: "0 0 0 1px var(--md-outline-variant)",
          flexShrink: 0,
        }}
      />
      <Typography variant="body2" color="text.secondary" noWrap>
        {FRONT_TEMPLATE_LABELS[id]}
      </Typography>
    </Stack>
  );
}

export function StaffTable(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // The grid measures its container on mount, so it must not mount while hidden.
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const [selection, setSelection] = useState<GridRowSelectionModel>({
    type: "include",
    ids: new Set(),
  });

  function go(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectedIds = useMemo(() => {
    if (selection.type === "include") return [...selection.ids].map(String);
    return props.rows.filter((r) => !selection.ids.has(r.id)).map((r) => r.id);
  }, [selection, props.rows]);

  const columns = useMemo<GridColDef<StaffRow>[]>(
    () => [
      {
        field: "stage",
        headerName: "Stage",
        width: 92,
        sortable: false,
        renderCell: ({ row }) => <StageRail states={stagesOf(row)} />,
      },
      {
        field: "name",
        headerName: "Name",
        flex: 1.6,
        minWidth: 260,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
            <Avatar
              src={row.photoUrl ?? undefined}
              alt=""
              sx={{ width: 36, height: 36, bgcolor: "var(--md-surface-container-high)" }}
            >
              {row.photoUrl ? null : " "}
            </Avatar>
            <Link
              component={NextLink}
              href={`/staff/${row.id}`}
              underline="hover"
              color="text.primary"
              sx={{ fontWeight: 500 }}
              noWrap
            >
              {row.name}
            </Link>
          </Stack>
        ),
      },
      {
        field: "idNumber",
        headerName: "ID",
        width: 140,
        renderCell: ({ value }) => (
          <Typography variant="body2" sx={{ fontFamily: monoFont }} color="text.secondary">
            {value}
          </Typography>
        ),
      },
      {
        field: "designation",
        headerName: "Designation",
        flex: 1,
        minWidth: 160,
        renderCell: ({ value }) => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {value}
          </Typography>
        ),
      },
      {
        field: "state",
        headerName: "State",
        width: 130,
        sortable: false,
        renderCell: ({ row }) => (
          <StatusChip
            s={{
              status: row.status,
              approvalState: row.approvalState,
              hasPendingEdits: row.hasPendingEdits,
              hasPhoto: Boolean(row.photoUrl),
            }}
          />
        ),
      },
      {
        field: "frontTemplate",
        headerName: "Design",
        width: 190,
        renderCell: ({ row }) => <TemplateCell id={row.frontTemplate} />,
      },
      {
        field: "actions",
        headerName: "",
        width: 90,
        sortable: false,
        align: "right",
        renderCell: ({ row }) => (
          <LinkButton href={`/staff/${row.id}`} size="small" variant="text">
            Open
          </LinkButton>
        ),
      },
    ],
    [],
  );

  const sortModel: GridSortModel = [{ field: props.sort, sort: props.dir }];

  const empty = (
    <Stack spacing={1} sx={{ alignItems: "center", py: 7, px: 2, textAlign: "center" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
        {props.hasFilters ? "No staff match these filters" : "No staff records yet"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {props.hasFilters
          ? "Clear filters or try a different search."
          : "Add a person or import a spreadsheet to get started."}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ pt: 2 }}>
        {props.hasFilters ? (
          <LinkButton href="/staff" variant="outlined">
            Clear filters
          </LinkButton>
        ) : (
          <LinkButton href="/import" variant="outlined">
            Import
          </LinkButton>
        )}
        <LinkButton href="/staff/new" variant="contained">
          Add staff
        </LinkButton>
      </Stack>
    </Stack>
  );

  const lastPage = Math.max(1, Math.ceil(props.total / props.pageSize));

  return (
    <>
      <StaffBulkActions
        matchingIds={props.matchingIds}
        selectedIds={selectedIds}
        onClearSelection={() => setSelection({ type: "include", ids: new Set() })}
      />

      <Card sx={{ display: { xs: "none", md: "block" }, overflow: "hidden", minHeight: 320 }}>
        {desktop ? (
          <DataGrid
            rows={props.rows}
            columns={columns}
            rowCount={props.total}
            rowHeight={60}
            columnHeaderHeight={48}
            checkboxSelection
            disableRowSelectionOnClick
            disableColumnMenu
            disableColumnFilter
            rowSelectionModel={selection}
            onRowSelectionModelChange={setSelection}
            paginationMode="server"
            sortingMode="server"
            paginationModel={{ page: props.page - 1, pageSize: props.pageSize }}
            pageSizeOptions={[...PAGE_SIZES]}
            onPaginationModelChange={(m) =>
              go({
                page: m.page > 0 ? String(m.page + 1) : null,
                pageSize: m.pageSize === DEFAULT_PAGE_SIZE ? null : String(m.pageSize),
              })
            }
            sortModel={sortModel}
            sortingOrder={["asc", "desc"]}
            onSortModelChange={(m) => {
              const s = m[0];
              const isDefault = !s || (s.field === "name" && s.sort !== "desc");
              go({
                sort: isDefault ? null : s.field,
                dir: s?.sort === "desc" ? "desc" : null,
                page: null,
              });
            }}
            slots={{ noRowsOverlay: () => empty }}
            autoHeight
            sx={{ "& .MuiDataGrid-overlayWrapper": { minHeight: 260 } }}
          />
        ) : null}
      </Card>

      <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
        {props.rows.length === 0 ? <Card>{empty}</Card> : null}
        {props.rows.map((r) => (
          <Card key={r.id}>
            <CardActionArea component={NextLink} href={`/staff/${r.id}`} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <Avatar
                  src={r.photoUrl ?? undefined}
                  alt=""
                  sx={{ width: 48, height: 48, bgcolor: "var(--md-surface-container-high)" }}
                >
                  {r.photoUrl ? null : " "}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }} noWrap>
                    {r.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: monoFont }} color="text.secondary">
                    {r.idNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {r.designation}
                  </Typography>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, alignItems: "center" }}>
                    <StageRail states={stagesOf(r)} />
                    <StatusChip
                      s={{
                        status: r.status,
                        approvalState: r.approvalState,
                        hasPendingEdits: r.hasPendingEdits,
                        hasPhoto: Boolean(r.photoUrl),
                      }}
                    />
                  </Stack>
                </Box>
                <Box
                  component="img"
                  src={`/id-card/templates/thumbs/${r.frontTemplate}.webp`}
                  alt={FRONT_TEMPLATE_LABELS[r.frontTemplate]}
                  sx={{
                    height: 52,
                    borderRadius: 0.5,
                    boxShadow: "0 0 0 1px var(--md-outline-variant)",
                  }}
                />
              </Stack>
            </CardActionArea>
          </Card>
        ))}
        {lastPage > 1 ? (
          <Stack sx={{ alignItems: "center", py: 1 }}>
            <Pagination
              count={lastPage}
              page={props.page}
              onChange={(_, p) => go({ page: p > 1 ? String(p) : null })}
              color="primary"
            />
          </Stack>
        ) : null}
      </Stack>
    </>
  );
}
