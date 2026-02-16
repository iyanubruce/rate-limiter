module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "perf", // Performance improvement
        "refactor", // Code restructuring
        "docs", // Documentation
        "test", // Tests
        "chore", // Build/tooling
        "ci", // CI/CD
        "style", // Formatting
        "revert", // Revert commit
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "limiter",
        "redis",
        "api",
        "websocket",
        "auth",
        "analytics",
        "middleware",
        "tenant",
        "strategy",
        "circuit",
        "config",
        "deps",
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
  },
};
