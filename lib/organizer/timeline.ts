export type TimelineInput = { id: string; start: number; end: number };
export type TimelineLayout = TimelineInput & { column: number; columnCount: number };

export function layoutTimelineItems(items: TimelineInput[]): TimelineLayout[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
  const result: TimelineLayout[] = [];
  let cluster: TimelineInput[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const positioned = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = item.end;
      return { ...item, column };
    });
    const columnCount = Math.max(1, columnEnds.length);
    result.push(...positioned.map((item) => ({ ...item, columnCount })));
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}

