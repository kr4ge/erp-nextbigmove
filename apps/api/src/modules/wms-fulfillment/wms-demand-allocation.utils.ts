export type WmsDemandAllocationLine = {
  id: string;
  required: number;
};

export function finalizeCompleteDemandAllocation(
  lines: readonly WmsDemandAllocationLine[],
  proposedAllocationByLineId: ReadonlyMap<string, number>,
) {
  const normalizedAllocation = new Map<string, number>();
  let isFullyAllocated = lines.length > 0;

  for (const line of lines) {
    const required = Math.max(line.required, 0);
    const proposed = Math.max(proposedAllocationByLineId.get(line.id) ?? 0, 0);
    const allocated = Math.min(proposed, required);
    normalizedAllocation.set(line.id, allocated);

    if (required <= 0 || allocated < required) {
      isFullyAllocated = false;
    }
  }

  if (isFullyAllocated) {
    return normalizedAllocation;
  }

  return new Map(lines.map((line) => [line.id, 0]));
}
