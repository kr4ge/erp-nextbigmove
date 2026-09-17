/**
 * Prompt templates: the advertiser's text with {{VARIABLES}} the system fills.
 *
 * This is the same shape prompt-management tools use, and the same shape the
 * advertiser's own documents already used, so nothing new has to be learned.
 * The rules are small and worth stating:
 *
 *  - A variable is {{UPPER_SNAKE}} and is replaced verbatim.
 *  - An unknown variable is left in place, so a typo is visible in the
 *    rendered prompt rather than silently becoming an empty string.
 *  - Some blocks are required. If the template omits the variable for one,
 *    the block is appended anyway: the new-creative gate must never run
 *    without the knowledge base, however the text was edited.
 */

export type PromptVariable = {
  token: string;
  description: string;
  /** Appended automatically if the template leaves it out. */
  required?: boolean;
};

const TOKEN_PATTERN = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(TOKEN_PATTERN, (whole, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token) ? values[token] : whole,
  );
}

/** Every {{TOKEN}} the template mentions, in order of first appearance. */
export function extractTokens(body: string): string[] {
  const seen = new Set<string>();
  for (const match of body.matchAll(TOKEN_PATTERN)) seen.add(match[1]);
  return [...seen];
}

/**
 * Guarantee a block reaches the model. Where the template names the variable
 * it is filled in place; where it does not, the block is appended under its
 * own heading so it cannot be edited away.
 */
export function ensureBlock(body: string, token: string, heading: string, content: string): string {
  const pattern = new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'g');
  if (pattern.test(body)) return body.replace(pattern, content);
  return `${body.trimEnd()}\n\n${heading}\n${content}`;
}

/** Tokens the template uses that no variable will fill. Surfaced in the UI. */
export function unknownTokens(body: string, known: PromptVariable[]): string[] {
  const allowed = new Set(known.map((variable) => variable.token));
  return extractTokens(body).filter((token) => !allowed.has(token));
}
