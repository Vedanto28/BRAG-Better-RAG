import React from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  width?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  emptyText?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  emptyText = 'No records available.',
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#24272f] bg-[#191c22]">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[#1b1e24] bg-[#131519] text-[#6c7280] font-mono uppercase tracking-wider text-[11px]">
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 font-medium" style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1b1e24]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[#6c7280] font-mono">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors ${
                  onRowClick ? 'hover:bg-[#20242c] cursor-pointer' : 'hover:bg-[#20242c]/50'
                }`}
              >
                {columns.map((col, i) => (
                  <td key={i} className="px-4 py-3.5 text-[#f5f7fa] align-middle">
                    {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? '') : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
