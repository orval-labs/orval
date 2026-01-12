# Contribution Guidelines

When contributing to `orval`, whether on GitHub or in other community spaces:

- Be respectful, civil, and open-minded.
- Before opening a new pull request, try searching through the [issue tracker](https://github.com/orval-labs/orval/issues) for known issues or fixes.
- If you want to make code changes based on your personal opinion(s), make sure you open an issue first describing the changes you want to make, and open a pull request only when your suggestions get approved by maintainers.

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

Install dependencies and set up Git hooks. Because `enableScripts` is disabled in `.yarnrc.yml`, lifecycle scripts won't run automatically, so run the following manually after cloning:

```bash
yarn install && yarn prepare
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
