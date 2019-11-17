import * as child_process from "child_process";
import { danger, markdown, warn } from "danger";
import * as fs from "fs";
import { includes } from "lodash";

// Setup
const pr = danger.github.pr;
const modified = danger.git.modified_files;
const added = danger.git.created_files;

const packageChanged = includes(modified, "package.json");
const wrongLockfileChanged = includes([...modified, ...added], "package-lock.json");

if (packageChanged && wrongLockfileChanged) {
  fail(
    "This PR contains `package-lock.json`, but we expect a `yarn.lock` instead as yarn is the preferred package manager for this project. We should not have to maintain two lockfiles.",
  );
}

// No PR is too small to warrant a paragraph or two of summary
if (pr.body.length === 0) {
  fail("Please add a description to your PR.");
}

// Warn when there is a big PR
const bigPRThreshold = 500;

if (danger.github.pr.additions + danger.github.pr.deletions > bigPRThreshold) {
  warn(":exclamation: Big PR");
}

// Always ensure we assign someone, so that our Slackbot can do its work correctly
if (pr.assignee === null) {
  fail("Please assign someone to merge this PR, and optionally include people who should review.");
}

// Show TSLint errors inline
// Yes, this is a bit lossy, we run the linter twice now, but its still a short amount of time
// Perhaps we could indicate that tslint failed somehow the first time?
// This process should always fail, so needs the `|| true` so it won't raise.
child_process.execSync(`npm run lint -- -- --format json --out tslint-errors.json || true`);

if (fs.existsSync("tslint-errors.json")) {
  const tslintErrors = JSON.parse(fs.readFileSync("tslint-errors.json", "utf8")) as any[];
  if (tslintErrors.length) {
    const errors = tslintErrors.map(error => {
      const format = error.ruleSeverity === "ERROR" ? ":no_entry_sign:" : ":warning:";
      const linkToFile = danger.github.utils.fileLinks([error.name]);
      return `* ${format} ${linkToFile} - ${error.ruleName} - ${error.failure}`;
    });
    const tslintMarkdown = `
  ## TSLint Issues:
  ${errors.join("\n")}
  `;
    markdown(tslintMarkdown);
  }
}
