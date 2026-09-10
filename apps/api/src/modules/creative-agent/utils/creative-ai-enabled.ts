export function isCreativeAiEnabled(value = process.env.AI_AGENT_ENABLED): boolean {
  return value?.trim().toLowerCase() === 'true';
}
