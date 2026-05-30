export interface Tokenizer {
  countTokens(text: string): number;
}

/**
 * Fallback tokenizer using character-based estimation.
 * ~4 chars per token for English, ~2 chars per token for CJK.
 */
export class EstimatedTokenizer implements Tokenizer {
  countTokens(text: string): number {
    let count = 0;
    for (const char of text) {
      // CJK characters
      if (/[一-鿿぀-ゟ゠-ヿ]/.test(char)) {
        count += 0.5;
      } else {
        count += 0.25;
      }
    }
    return Math.ceil(count);
  }
}
