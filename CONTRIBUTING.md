# Contribution Guidelines

When contributing to `orval`, whether on GitHub or in other community spaces:

- Be respectful, civil, and open-minded.
- Before opening a new pull request, try searching through the [issue tracker](https://github.com/orval-labs/orval/issues) for known issues or fixes.
- If you want to make code changes based on your personal opinion(s), make sure you open an issue first describing the changes you want to make, and open a pull request only when your suggestions get approved by maintainers.

## A note about AI

First of all, we do not reject the use of AI agents outright. For example, small code changes or discovering edge cases are valid and welcome uses of AI.

That said, please do not throw issues at a coding agent and submit whatever comes out as a PR. Think about whether the change is truly needed and what use case it serves. Creating code without intent only adds complexity to the project. Some of these PRs may actually be good and useful, but many are not, and it is not a good use of maintainer time to review generated PRs and decide. Reviewing and verifying the output of AI agents is the contributor's job, not the reviewer's. If you are not familiar enough with TypeScript or API client development, or are not willing to get familiar with orval's codebase, please invest time in catching up before submitting a PR.

Every change must have a clear intent and purpose. Do not submit changes that you cannot explain in your own words. When reviewers ask questions, we expect you — the contributor — to answer from your own understanding, not by forwarding our questions to an agent and relaying its output. Also, keep your PRs small and focused — each PR should serve a single, well-defined purpose.

In particular, auto-generated documentation tends to be verbose and becomes noise for readers. If your PR includes documentation changes, make sure a human has reviewed and trimmed it to the essentials. We will also not accept changes that introduce unnecessary complexity — redundant variables, excessive function extraction, over-engineered abstractions, and so on. Judging the overall consistency and sustainability of the project is a human responsibility, and review effort is already heavily concentrated on maintainers. Aim to reduce reviewer burden, not increase it.

## How to Contribute

### Prerequisites

In order to not waste your time implementing a change that has already been declined, or is generally not needed, start by [opening an issue](https://github.com/orval-labs/orval/issues/new) describing the problem you would like to solve.

### Setup your environment locally

_Some commands will assume you have the Github CLI installed, if you haven't, consider [installing it](https://github.com/cli/cli#installation), but you can always use the Web UI if you prefer that instead._

In order to contribute to this project, you will need to fork the repository:

```bash
gh repo fork orval-labs/orval
```

then, clone it to your local machine:

```bash
gh repo clone <your-github-name>/orval
```

Install dependencies and set up Git hooks:

```bash
bun install && bun run prepare
```

### Implement your changes

When making commits, make sure to follow the [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) guidelines, i.e. prepending the message with `feat:`, `fix:`, `chore:`, `docs:`, etc... You can use `git status` to double check which files have not yet been staged for commit:

```bash
git add <file> && git commit -m "feat/fix/chore/docs: commit message"
```

### When you're done

When all that's done, it's time to file a pull request to upstream:

**NOTE**: All pull requests should target the `master` branch.

## Credits

This document was inspired by the contributing guidelines for [create-t3-app](https://github.com/t3-oss/create-t3-app/blob/next/CONTRIBUTING.md).
