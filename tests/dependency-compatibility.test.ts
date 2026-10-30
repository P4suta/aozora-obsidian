import { expect, it } from "vitest";
import sdk from "../node_modules/obsidian/package.json";
import manifest from "../package.json";
import renovate from "../renovate.json";

it.each(["@codemirror/state", "@codemirror/view"] as const)(
  "%s matches the installed Obsidian SDK peer dependency",
  (name: keyof typeof sdk.peerDependencies): void => {
    const peer = sdk.peerDependencies[name];
    expect(manifest.devDependencies[name]).toBe(peer);
    const rule = renovate.packageRules.find(
      (candidate: (typeof renovate.packageRules)[number]): boolean =>
        candidate.matchPackageNames.includes(name),
    );
    expect(rule?.matchDatasources).toEqual(["npm"]);
    expect(rule?.allowedVersions).toBe(peer);
  },
);
