import type { ReactNode } from "react";
import { Card } from "./Card";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

/**
 * Standard data list. Renders as horizontal divider rows inside a single Card —
 * never as a stack of separate cards. Consistent header style, hover state,
 * empty state, and tabular figures on numeric columns.
 */
export default function DataTable<T>({
  columns,
  rows,
  emptyTitle = "No items yet",
  emptyDescription,
  emptyAction,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <Card className="py-16 px-6 text-center">
        <h3 className="text-[var(--color-primary)] font-medium text-base mb-2">{emptyTitle}</h3>
        {emptyDescription && (
          <p className="text-[var(--color-tertiary)] text-sm max-w-md mx-auto leading-relaxed">
            {emptyDescription}
          </p>
        )}
        {emptyAction && <div className="mt-6 flex justify-center">{emptyAction}</div>}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="grid items-center gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)]"
        style={{ gridTemplateColumns: columns.map((c) => c.width ?? "1fr").join(" ") }}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            className={c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}
          >
            {c.header}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {rows.map((row) => {
          const content = (
            <div
              className="grid items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-raised)] transition-colors"
              style={{ gridTemplateColumns: columns.map((c) => c.width ?? "1fr").join(" ") }}
            >
              {columns.map((c) => (
                <div
                  key={c.key}
                  className={`text-sm text-[var(--color-secondary)] min-w-0 ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {c.render(row)}
                </div>
              ))}
            </div>
          );
          return onRowClick ? (
            <button
              key={rowKey(row)}
              onClick={() => onRowClick(row)}
              className="block w-full text-left"
            >
              {content}
            </button>
          ) : (
            <div key={rowKey(row)}>{content}</div>
          );
        })}
      </div>
    </Card>
  );
}
