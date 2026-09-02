import { getCommitInfo, getPullRequestInfo } from "@changesets/get-github-info";

/** @typedef {import("@changesets/types").ChangelogFunctions} ChangelogFunctions */
/** @typedef {import("@changesets/get-github-info").CommitInfo} CommitInfo */
/** @typedef {import("@changesets/get-github-info").PullRequestInfo} PullRequestInfo */

/**
 * @typedef {object} Links
 * @property {string | null} commit markdown link to the commit
 * @property {string | null} pull markdown link to the pull request
 * @property {string | null} user markdown link to the author
 */

/**
 * @returns {{ GITHUB_SERVER_URL: string }} value
 */
function readEnv() {
  const GITHUB_SERVER_URL =
    process.env.GITHUB_SERVER_URL || "https://github.com";
  return { GITHUB_SERVER_URL };
}

/**
 * Flattens what GitHub reported into the three links a changelog line uses.
 * Every field is null when the lookup found nothing.
 * @param {CommitInfo | PullRequestInfo | undefined} info what GitHub reported
 * @returns {Links} links
 */
function toLinks(info) {
  if (!info) {
    return { commit: null, pull: null, user: null };
  }

  return {
    commit: info.commit ? info.commit.markdownLink : null,
    pull: info.pull ? info.pull.markdownLink : null,
    user: info.author ? info.author.markdownLink : null,
  };
}

/** @type {ChangelogFunctions} */
const changelogFunctions = {
  getDependencyReleaseLine: async (
    changesets,
    dependenciesUpdated,
    options,
  ) => {
    if (!options.repo) {
      throw new Error(
        'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
      );
    }
    if (dependenciesUpdated.length === 0) return "";

    const changesetLink = `- Updated dependencies [${(
      await Promise.all(
        changesets.map(async (cs) => {
          if (cs.commit) {
            const info = await getCommitInfo({
              repo: options.repo,
              commit: cs.commit,
            });

            return info ? info.commit.markdownLink : undefined;
          }

          return undefined;
        }),
      )
    )
      .filter(Boolean)
      .join(", ")}]:`;

    const updatedDependenciesList = dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
    );

    return [changesetLink, ...updatedDependenciesList].join("\n");
  },
  getReleaseLine: async (changeset, type, options) => {
    const { GITHUB_SERVER_URL } = readEnv();
    if (!options || !options.repo) {
      throw new Error(
        'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
      );
    }

    /** @type {number | undefined} */
    let prFromSummary;
    /** @type {string | undefined} */
    let commitFromSummary;
    /** @type {string[]} */
    const usersFromSummary = [];

    const replacedChangelog = changeset.summary
      .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
        const num = Number(pr);
        if (!Number.isNaN(num)) prFromSummary = num;
        return "";
      })
      .replace(/^\s*commit:\s*([^\s]+)/im, (_, commit) => {
        commitFromSummary = commit;
        return "";
      })
      .replaceAll(/^\s*(?:author|user):\s*@?([^\s]+)/gim, (_, user) => {
        usersFromSummary.push(user);
        return "";
      })
      .trim();

    const [firstLine, ...futureLines] = replacedChangelog
      .split("\n")
      .map((l) => l.trimEnd());

    const links = await (async () => {
      if (prFromSummary !== undefined) {
        const linksFromPullRequest = toLinks(
          await getPullRequestInfo({
            repo: options.repo,
            pull: prFromSummary,
          }),
        );

        if (commitFromSummary) {
          const shortCommitId = commitFromSummary.slice(0, 7);

          return {
            ...linksFromPullRequest,
            commit: `[\`${shortCommitId}\`](${GITHUB_SERVER_URL}/${options.repo}/commit/${commitFromSummary})`,
          };
        }

        return linksFromPullRequest;
      }
      const commitToFetchFrom = commitFromSummary || changeset.commit;
      if (commitToFetchFrom) {
        return toLinks(
          await getCommitInfo({
            repo: options.repo,
            commit: commitToFetchFrom,
          }),
        );
      }
      return {
        commit: null,
        pull: null,
        user: null,
      };
    })();

    const users = usersFromSummary.length
      ? usersFromSummary
          .map(
            (userFromSummary) =>
              `[@${userFromSummary}](${GITHUB_SERVER_URL}/${userFromSummary})`,
          )
          .join(", ")
      : links.user;

    // 1.0 reports nothing when a commit or pull request is not found, so the
    // link half has to be dropped rather than printed as `null`.
    const link = links.pull || links.commit;

    let suffix = "";
    if (link) {
      suffix = `(${users ? `by ${users} ` : ""}in ${link})`;
    } else if (users) {
      suffix = `(by ${users})`;
    }

    return `\n\n- ${firstLine} ${suffix}\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  },
};

export default changelogFunctions;
