export type Interleaved<T> =
  | { kind: "item"; item: T }
  | { kind: "break"; index: number };

/** Adds a break after every `every` items. Never ends on a break, since nothing follows it. */
export function interleave<T>(items: T[], every: number): Interleaved<T>[] {
  return items.flatMap((item, i): Interleaved<T>[] => {
    const position = i + 1;
    const needsBreak = position % every === 0 && position < items.length;
    return needsBreak
      ? [{ kind: "item", item }, { kind: "break", index: position / every }]
      : [{ kind: "item", item }];
  });
}
