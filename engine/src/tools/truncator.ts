/**
 * Tool output truncator — prevents large tool outputs from blowing up the context window.
 *
 * Strategy:
 *   1. Short outputs pass through unchanged.
 *   2. Long outputs are split into head + tail with a truncation hint in the middle.
 *   3. Special tools (read_file, shell, grep, glob) get format-aware truncation.
 *   4. When truncation occurs, the full output is saved to disk for later retrieval.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const TRUNCATED_OUTPUT_DIR = path.join(os.tmpdir(), 'mimo-truncated-outputs');

function ensureOutputDir(): void {
  if (!fs.existsSync(TRUNCATED_OUTPUT_DIR)) {
    fs.mkdirSync(TRUNCATED_OUTPUT_DIR, { recursive: true });
  }
}

export interface TruncateOptions {
  /** Maximum allowed character length (default 50 000) */
  maxOutputLength?: number;
  /** Fraction of maxLength kept from the start (default 0.4) */
  headRatio?: number;
  /** Fraction of maxLength kept from the end (default 0.4) */
  tailRatio?: number;
  /** Tool name — enables format-aware truncation when set */
  toolName?: string;
}

export interface TruncatedOutput {
  /** The (possibly truncated) output string */
  output: string;
  /** Whether truncation actually happened */
  truncated: boolean;
  /** Original character length before truncation */
  originalLength: number;
  /** Character length after truncation */
  truncatedLength: number;
  /** The inserted truncation hint, if any */
  hint?: string;
  /** Path to the file containing the full (untruncated) output */
  outputPath?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Truncate a tool output string.
 *
 * Returns a new object — the original string is never mutated.
 */
export function truncateOutput(
  output: string,
  options: TruncateOptions = {},
): TruncatedOutput {
  const {
    maxOutputLength = 50_000,
    headRatio = 0.4,
    tailRatio = 0.4,
    toolName,
  } = options;

  if (output.length <= maxOutputLength) {
    return {
      output,
      truncated: false,
      originalLength: output.length,
      truncatedLength: output.length,
    };
  }

  // Delegate to tool-specific strategy when a tool name is given
  if (toolName) {
    const result = truncateForTool(output, toolName, maxOutputLength);
    if (result.truncated) {
      result.outputPath = saveFullOutput(output);
    }
    return result;
  }

  // Generic head+tail truncation
  const result = truncateGeneric(output, maxOutputLength, headRatio, tailRatio);
  if (result.truncated) {
    result.outputPath = saveFullOutput(output);
  }
  return result;
}

/**
 * Save the full (untruncated) output to a temp file for later retrieval.
 */
function saveFullOutput(output: string): string {
  try {
    ensureOutputDir();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
    const filepath = path.join(TRUNCATED_OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, output, 'utf-8');
    return filepath;
  } catch {
    // If disk save fails, truncation still works — just without full output retrieval
    return '';
  }
}

// ---------------------------------------------------------------------------
// Generic truncation
// ---------------------------------------------------------------------------

function truncateGeneric(
  output: string,
  maxLength: number,
  headRatio: number,
  tailRatio: number,
): TruncatedOutput {
  const headLength = Math.floor(maxLength * headRatio);
  const tailLength = Math.floor(maxLength * tailRatio);
  const head = output.slice(0, headLength);
  const tail = output.slice(-tailLength);
  const omitted = output.length - headLength - tailLength;

  const hint = `\n\n... [已截断 ${omitted.toLocaleString()} 个字符，原始 ${output.length.toLocaleString()} 个字符] ...\n\n`;
  const result = head + hint + tail;

  return {
    output: result,
    truncated: true,
    originalLength: output.length,
    truncatedLength: result.length,
    hint,
  };
}

// ---------------------------------------------------------------------------
// Tool-specific strategies
// ---------------------------------------------------------------------------

function truncateForTool(
  output: string,
  toolName: string,
  maxLength: number,
): TruncatedOutput {
  switch (toolName) {
    case 'read_file':
      return truncateFileOutput(output, maxLength);
    case 'shell':
      return truncateShellOutput(output, maxLength);
    case 'grep':
      return truncateGrepOutput(output, maxLength);
    case 'glob':
      return truncateGlobOutput(output, maxLength);
    default:
      return truncateGeneric(output, maxLength, 0.4, 0.4);
  }
}

/**
 * File read: truncate by lines, keep head + tail.
 */
function truncateFileOutput(
  output: string,
  maxLength: number,
): TruncatedOutput {
  const lines = output.split('\n');
  if (output.length <= maxLength) {
    return {
      output,
      truncated: false,
      originalLength: output.length,
      truncatedLength: output.length,
    };
  }

  const avgLineLen = 80;
  const maxLines = Math.floor(maxLength / avgLineLen);
  const headLines = Math.max(1, Math.floor(maxLines * 0.4));
  const tailLines = Math.max(1, Math.floor(maxLines * 0.4));

  const head = lines.slice(0, headLines);
  const tail = lines.slice(-tailLines);
  const omittedLines = lines.length - headLines - tailLines;

  const hint = `\n... [已截断 ${omittedLines} 行，共 ${lines.length} 行] ...\n`;
  const result = [...head, hint, ...tail].join('\n');

  return {
    output: result,
    truncated: true,
    originalLength: output.length,
    truncatedLength: result.length,
    hint,
  };
}

/**
 * Shell output: error lines are preserved preferentially.
 */
function truncateShellOutput(
  output: string,
  maxLength: number,
): TruncatedOutput {
  if (output.length <= maxLength) {
    return {
      output,
      truncated: false,
      originalLength: output.length,
      truncatedLength: output.length,
    };
  }

  // Try to keep error-containing lines intact
  if (
    output.includes('Error') ||
    output.includes('error:') ||
    output.includes('ERROR')
  ) {
    const parts = output.split(/\n(?=Error|error:|ERROR)/);
    if (parts.length > 1) {
      const normalPart = parts[0];
      const errorPart = parts.slice(1).join('\n');

      if (normalPart.length + errorPart.length <= maxLength) {
        return {
          output,
          truncated: false,
          originalLength: output.length,
          truncatedLength: output.length,
        };
      }

      // Truncate the normal (stdout) portion, keep full error portion
      const reservedForHint = 100;
      const allowedNormal = maxLength - errorPart.length - reservedForHint;
      if (allowedNormal > 0) {
        const truncatedNormal = normalPart.slice(0, allowedNormal);
        const hint = `\n... [标准输出已截断] ...\n`;
        const result = truncatedNormal + hint + errorPart;
        return {
          output: result,
          truncated: true,
          originalLength: output.length,
          truncatedLength: result.length,
          hint,
        };
      }
    }
  }

  // Fallback to generic truncation
  return truncateGeneric(output, maxLength, 0.4, 0.4);
}

/**
 * grep output: keep matching lines (file:line:content), truncate by count.
 */
function truncateGrepOutput(
  output: string,
  maxLength: number,
): TruncatedOutput {
  if (output.length <= maxLength) {
    return {
      output,
      truncated: false,
      originalLength: output.length,
      truncatedLength: output.length,
    };
  }

  const lines = output.split('\n');
  const avgLineLen = 100;
  const maxLines = Math.max(1, Math.floor(maxLength / avgLineLen));

  const kept = lines.slice(0, maxLines);
  const omitted = lines.length - maxLines;

  const hint = `\n... [还有 ${omitted} 个匹配结果未显示] ...\n`;
  const result = kept.join('\n') + hint;

  return {
    output: result,
    truncated: true,
    originalLength: output.length,
    truncatedLength: result.length,
    hint,
  };
}

/**
 * glob output: keep file paths, truncate by count.
 */
function truncateGlobOutput(
  output: string,
  maxLength: number,
): TruncatedOutput {
  if (output.length <= maxLength) {
    return {
      output,
      truncated: false,
      originalLength: output.length,
      truncatedLength: output.length,
    };
  }

  const lines = output.split('\n');
  const avgLineLen = 60;
  const maxLines = Math.max(1, Math.floor(maxLength / avgLineLen));

  const kept = lines.slice(0, maxLines);
  const omitted = lines.length - maxLines;

  const hint = `\n... [还有 ${omitted} 个文件路径未显示] ...\n`;
  const result = kept.join('\n') + hint;

  return {
    output: result,
    truncated: true,
    originalLength: output.length,
    truncatedLength: result.length,
    hint,
  };
}
