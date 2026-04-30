// Conventional Commits enforcement.
//
// Mirrors the lefthook `commit-msg` regex
// (`^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .{1,}`)
// but uses commitlint's structured rules so violations point at the
// specific field (type / scope / subject) rather than a single regex
// failure. The lefthook hook calls `commitlint --edit $1`; the GitHub
// Actions side calls it on the commit message of every push.
//
// Allowed scopes are derived from CONTRIBUTING.md plus the new
// `bench` and `refresh` scopes introduced by the Architectural
// Refresh round (ADR 0003 + bench harness).

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "processor",
        "inline-processor",
        "livepreview",
        "settings",
        "wasm",
        "encoding",
        "txt-detector",
        "styles",
        "manifest",
        "docs",
        "ci",
        "build",
        "infra",
        "deps",
        "bench",
        "refresh",
        "types",
        "schema",
        "reactivity",
        "effect",
        "diagnostics",
        "cache",
        "typography",
        "lezer",
        "lint",
      ],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-empty": [2, "never"],
    "type-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"],
  },
};
