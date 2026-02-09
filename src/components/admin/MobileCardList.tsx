import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MobileCardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
}

export function MobileCardList<T>({ items, renderCard, emptyState, className }: MobileCardListProps<T>) {
  if (items.length === 0 && emptyState) return <>{emptyState}</>;
  return (
    <div className={`space-y-3 md:hidden ${className || ""}`}>
      {items.map((item, i) => (
        <Card key={i} className="glass-card">
          <CardContent className="p-4">
            {renderCard(item, i)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
