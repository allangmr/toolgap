export function collapseSequence(
  parts: string[],
): Array<{ name: string; count: number }> {
  const out: Array<{ name: string; count: number }> = [];
  for (const part of parts) {
    const name = part.trim();
    if (!name) continue;
    const last = out[out.length - 1];
    if (last && last.name === name) last.count += 1;
    else out.push({ name, count: 1 });
  }
  return out;
}

export function signatureParts(signature: string): string[] {
  return signature
    .split(">")
    .map((p) => p.trim())
    .filter(Boolean);
}
