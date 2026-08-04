let counterMap: Record<string, number> = {};
let customFactory: ((prefix: string) => string) | null = null;

export function resetDesignerIdFactory(): void {
  counterMap = {};
  customFactory = null;
}

export function setDesignerIdFactory(factory: ((prefix: string) => string) | null): void {
  customFactory = factory;
}

export function generateDesignerId(prefix: string): string {
  if (customFactory) {
    return customFactory(prefix);
  }
  const next = (counterMap[prefix] || 0) + 1;
  counterMap[prefix] = next;
  return `${prefix}-${next}`;
}
