// "I?" covers imatrix quants (IQ1_S, IQ2_XXS, IQ3_M, ...) — without it, the
// unanchored Q\d... alternative still matches starting one character in
// (e.g. "IQ2_XS" -> "Q2_XS"), silently dropping the leading "I" and
// mislabeling the quant.
const QUANT_PATTERN = /(I?Q\d(?:_[A-Z0-9]+)?|F16|F32|BF16)/i;

export function quantFromFilename(filename: string): string | null {
  const match = filename.match(QUANT_PATTERN);
  return match ? match[1].toUpperCase() : null;
}
