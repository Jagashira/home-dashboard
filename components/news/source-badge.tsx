import { Badge } from "@/components/ui/badge";

export function SourceBadge({ sourceType, sourceLabel }: { sourceType: string; sourceLabel: string }) {
  return (
    <Badge>
      {sourceLabel} / {sourceType}
    </Badge>
  );
}

