import { getAgent } from '../../../packages/shared/src/agents';

export function describeAgentRoute(sourceId: string, destinationId: string) {
  const source = getAgent(sourceId);
  const destination = getAgent(destinationId);
  return {
    source: source?.capabilities.canReadSessions
      ? 'Relay can read supported sessions.'
      : 'No direct chat reader is available; use a manually imported transcript or saved project memory.',
    destination: destination?.destinationSupport === 'verified'
      ? 'Relay can configure and launch its MCP handoff.'
      : 'MCP receive and launch need manual setup; Relay will not report retrieval until the destination confirms it.',
    sourceSetup: source?.setup ?? 'Choose a registered source agent.',
    destinationSetup: destination?.setup ?? 'Choose a registered destination agent.',
  };
}
