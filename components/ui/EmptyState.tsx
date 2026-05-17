import type { ReactNode } from "react";
import { Card } from "./Card";

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="py-16 px-6 text-center animate-fade-in">
      {icon && (
        <div className="mx-auto mb-4 w-12 h-12 rounded-full surface-raised flex items-center justify-center text-[var(--color-tertiary)]">
          {icon}
        </div>
      )}
      <h3 className="text-[var(--color-primary)] font-medium text-base mb-2">{title}</h3>
      {description && (
        <p className="text-[var(--color-tertiary)] text-sm max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  );
}
