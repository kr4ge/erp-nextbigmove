/**
 * Creative AI is local-only until the production gateway is provisioned.
 * Next.js replaces this public value at build time, so an omitted flag keeps
 * every AI entry point out of the production UI while the code can still ship.
 */
export const CREATIVE_AI_UI_ENABLED =
  process.env.NEXT_PUBLIC_AI_AGENT_ENABLED?.trim().toLowerCase() === 'true';
