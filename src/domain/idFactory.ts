let counterMap: Record<string, number> = {};
let customFactory: ((prefix: string) => string) | null = null;

export function resetDesignerIdFactory(): void {
  counterMap = {};
  customFactory = null;
}

export function setDesignerIdFactory(factory: ((prefix: string) => string) | null): void {
  customFactory = factory;
}

export function generateDesignerId(prefix: string, occupiedIds?: Set<string> | string[]): string {
  const occupiedSet = occupiedIds
    ? Array.isArray(occupiedIds)
      ? new Set(occupiedIds)
      : occupiedIds
    : null;

  if (customFactory) {
    let candidate = customFactory(prefix);
    if (occupiedSet) {
      let suffix = 1;
      while (occupiedSet.has(candidate)) {
        candidate = `${customFactory(prefix)}-${suffix++}`;
      }
    }
    return candidate;
  }

  let candidate: string;
  do {
    const next = (counterMap[prefix] || 0) + 1;
    counterMap[prefix] = next;
    candidate = `${prefix}-${next}`;
  } while (occupiedSet && occupiedSet.has(candidate));

  return candidate;
}

