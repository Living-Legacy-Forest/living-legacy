module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Parse the header explicitly rather than relying on whichever parser preset
  // resolves. The commitlint GitHub action runs in its own container, where the
  // inherited preset does not recognise the "!" breaking change marker, so
  // "feat!: ..." was reported as having no type and no subject.
  // Dependabot writes its commit bodies (release-note links) in lines far past 100 characters, so
  // its PRs failed body-max-line-length whatever they changed. Its commits are skipped
  // entirely, which is safe: the bot writes the header itself, always as build(deps): Bump ….
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'breaking', 'subject'],
    },
  },
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'refactor',
        'docs',
        'style',
        'test',
        'perf',
        'build',
        'ci',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 100],
  },
};
