const QUANT_PATTERN = /(Q\d(?:_[A-Z0-9]+)?|F16|F32|BF16)/i;

export function quantFromFilename(filename: string): string | null {
  const match = filename.match(QUANT_PATTERN);
  return match ? match[1].toUpperCase() : null;
}
