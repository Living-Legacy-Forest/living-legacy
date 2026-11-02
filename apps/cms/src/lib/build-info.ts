// The running build, for the dashboard: the commit it was built from (linked
// to GitHub) and when. There is no separate version number; the commit is the
// version, so it always says exactly what is live.
const REPO_URL = 'https://github.com/Living-Legacy-Forest/living-legacy';

const commit = __APP_COMMIT__;

export const buildInfo = {
  /** The first 7 characters, as GitHub shows them. */
  version: commit === 'dev' ? 'dev' : commit.slice(0, 7),
  commitUrl: commit === 'dev' ? null : `${REPO_URL}/commit/${commit}`,
  builtAt: Date.parse(__APP_BUILT_AT__),
  /** A local `vite dev` session rather than a deployed build. */
  isDev: import.meta.env.DEV,
};
