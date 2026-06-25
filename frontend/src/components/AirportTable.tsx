import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { AirportWithStatus } from "../lib/types";
import { RiskBadge } from "./RiskBadge";

const RISK_RANK = { SEVERE: 3, HIGH: 2, MEDIUM: 1, LOW: 0 } as const;

export function AirportTable({
  airports,
  selectedIcao,
  onSelect,
}: {
  airports: AirportWithStatus[];
  selectedIcao: string | null;
  onSelect: (icao: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "risk", desc: true }]);
  const [filter, setFilter] = useState("");

  const columns = useMemo<ColumnDef<AirportWithStatus>[]>(
    () => [
      {
        id: "icao",
        header: "ICAO",
        accessorFn: (a) => a.icao,
        cell: (info) => <span className="font-mono text-slate-200">{info.getValue<string>()}</span>,
      },
      {
        id: "airport",
        header: "Airport",
        accessorFn: (a) => `${a.name} ${a.city} ${a.country} ${a.iata}`,
        cell: ({ row }) => (
          <div>
            <div className="text-slate-200">{row.original.name}</div>
            <div className="text-xs text-slate-500">
              {row.original.city}, {row.original.country}
            </div>
          </div>
        ),
      },
      {
        id: "category",
        header: "Flt. Cat.",
        accessorFn: (a) => a.weather?.flight_category ?? "—",
      },
      {
        id: "risk",
        header: "Delay Risk",
        accessorFn: (a) => RISK_RANK[a.risk?.level ?? "LOW"],
        cell: ({ row }) =>
          row.original.risk ? (
            <RiskBadge level={row.original.risk.level} score={row.original.risk.score} />
          ) : (
            <span className="text-slate-600">no data</span>
          ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: airports,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex h-full flex-col">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by ICAO, city, country…"
        className="mb-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
      />
      <div className="flex-1 overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#0b0e16] text-xs uppercase tracking-wide text-slate-500">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none px-3 py-2 hover:text-slate-300"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row.original.icao)}
                className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${
                  row.original.icao === selectedIcao ? "bg-sky-500/10" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
