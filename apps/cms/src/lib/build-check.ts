/**
 * Whether the deployed CMS is a different build from the one running in this
 * tab. Never in local development ("dev"), and never without an answer.
 */
export function isNewerDeploy(running: string, deployed: string | null | undefined): boolean {
  if (!deployed || running === 'dev' || deployed === 'dev') return false;
  return running !== deployed;
}
