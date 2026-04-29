# Security policy

## Reporting a vulnerability

If you discover a security vulnerability in aozora-obsidian — an XSS in
the rendered preview, a sandbox escape via the WebView bridge, an
unsafe `eval` path, or anything with exploitative potential — **do not
open a public issue**. Instead:

1. Preferred: open a private report via
   [GitHub Security Advisories](https://github.com/P4suta/aozora-obsidian/security/advisories/new).
2. Alternative: email the maintainer at
   `42543015+P4suta@users.noreply.github.com` with the subject
   `[aozora-obsidian security] <short summary>`.

## Response expectations

- We acknowledge reports within **7 days**.

## Scope

In scope:
- HTML-escape bypass in the rendered preview pane.
- Plugin-process privilege escalation reachable from vault content.

Out of scope:
- Vulnerabilities in aozora itself — please report those at
  <https://github.com/P4suta/aozora/security/advisories/new>.
- Vulnerabilities in Obsidian itself — report to Obsidian's
  team via their published channel.

## Supported versions

aozora-obsidian is pre-1.0. Only the `main` branch is supported.

| Version | Supported |
|---|---|
| main  | ✅ |
| <1.0  | ❌ (use main) |
