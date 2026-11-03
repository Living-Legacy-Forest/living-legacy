// The running build, for the dashboard: its release version (linked to the
// GitHub release notes), the commit it was built from (linked to GitHub) and
// when. Between releases the version stays put while the commit moves, so the
// commit is what says exactly what is live.
const REPO_URL = 'https://github.com/Living-Legacy-Forest/living-legacy';

const version = __APP_VERSION__;
const commit = __APP_COMMIT__;

export const buildInfo = {
  version,
  releaseUrl: `${REPO_URL}/releases/tag/cms-v${version}`,
  /** The first 7 characters, as GitHub shows them. */
  commit: commit === 'dev' ? null : commit.slice(0, 7),
  commitUrl: commit === 'dev' ? null : `${REPO_URL}/commit/${commit}`,
  builtAt: Date.parse(__APP_BUILT_AT__),
  /** A local `vite dev` session rather than a deployed build. */
  isDev: import.meta.env.DEV,
};
