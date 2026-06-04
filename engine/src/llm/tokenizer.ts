/**
 * Unified token estimation for BPE-based tokenizers (GPT-style, mimo, etc.)
 *
 * Strategy: segment text into character classes, apply empirical ratios.
 * Calibrated against tiktoken cl100k_base for mixed Chinese/English/code content.
 */

export interface Tokenizer {
  countTokens(text: string): number;
}

// --- Character class detection ---

const CJK_IDEOGRAPH = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CJK_OTHER = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u{20000}-\u{2A6DF}]/u;
const HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;

// --- Per-class token-per-character ratios ---
// These are calibrated against tiktoken cl100k_base (GPT-4 / mimo tokenizer family).
//
// Chinese text: ~1.5 tokens per character (common characters often merge in BPE)
// Hangul: ~0.8 tokens per character (syllable blocks are common tokens)
// ASCII word (a-z, A-Z, 0-9, _): ~0.25 tokens per character (4 chars/token)
// Whitespace: ~0.2 tokens per char (spaces are cheap, often merged)
// Punctuation / symbols: ~0.5 tokens per char (each symbol is often its own token)
// Code braces / operators: ~1 token per symbol (each `{`, `}`, `(`, `)` is typically 1 token)

const RATIO_CJK = 1.5;
const RATIO_HANGUL = 0.8;
const RATIO_ASCII_WORD = 0.25;
const RATIO_WHITESPACE = 0.2;
const RATIO_SYMBOL = 1.0;

// Symbols that are typically 1 token each in code
const CODE_SYMBOL = /^[{}()[\];,.:!=<>+\-*/%&|^~?@#`\\]$/;

/**
 * Estimate the number of tokens in a text string.
 * More accurate than a flat chars/3 or chars/4 divisor, especially for
 * mixed Chinese/English/code content.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  if (text.length === 0) return 0;

  let tokens = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // CJK ideographs (Chinese)
    if (CJK_IDEOGRAPH.test(char) || CJK_OTHER.test(char)) {
      tokens += RATIO_CJK;
      i++;
      continue;
    }

    // Hangul (Korean)
    if (HANGUL.test(char)) {
      tokens += RATIO_HANGUL;
      i++;
      continue;
    }

    // Whitespace run
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      let wsLen = 0;
      while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) {
        wsLen++;
        i++;
      }
      tokens += wsLen * RATIO_WHITESPACE;
      continue;
    }

    // ASCII word (letters, digits, underscore)
    if (/[a-zA-Z0-9_]/.test(char)) {
      let wordLen = 0;
      while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
        wordLen++;
        i++;
      }
      tokens += wordLen * RATIO_ASCII_WORD;
      // Add 1 token for the word boundary (BPE often adds ~1 token per word)
      tokens += 1;
      continue;
    }

    // Code symbol (single-character operators, braces, etc.)
    if (CODE_SYMBOL.test(char)) {
      tokens += RATIO_SYMBOL;
      i++;
      continue;
    }

    // Anything else (emoji, misc Unicode, etc.)
    tokens += 1;
    i++;
  }

  return Math.ceil(tokens);
}

/**
 * Estimate tokens for a structured message (including role, tool calls, etc.)
 * Matches the overhead of OpenAI-compatible API message format.
 */
export function estimateMessageTokens(
  content: string | null,
  _role?: string,
  toolCalls?: Array<{ name: string; arguments: unknown }>,
  toolCallId?: string,
): number {
  let count = 0;

  // Role + message framing overhead (~4 tokens per message)
  count += 4;

  if (content) {
    count += estimateTokens(content);
  }

  if (toolCalls) {
    for (const tc of toolCalls) {
      // Tool call structure: function name + arguments JSON
      count += estimateTokens(tc.name);
      count += estimateTokens(JSON.stringify(tc.arguments));
      count += 6; // overhead for tool_call framing (id, type, function wrapper)
    }
  }

  if (toolCallId) {
    count += estimateTokens(toolCallId) + 2; // overhead for tool response framing
  }

  return count;
}

/**
 * Legacy-compatible class wrapper for the Tokenizer interface.
 */
export class EstimatedTokenizer implements Tokenizer {
  countTokens(text: string): number {
    return estimateTokens(text);
  }
}
