#!/usr/bin/env node
/* eslint-env node */
/**
 * Parses oxlint JSON output and displays errors with a per-package summary.
 * Usage: oxlint . --format=json | node scripts/lint-summary.js
 */

let input = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  const data = JSON.parse(input);

  // Initialize all packages (so clean ones show too)
  const allPackages = [
    'angular', 'axios', 'core', 'fetch', 'hono', 
    'mcp', 'mock', 'orval', 'query', 'solid-start', 'swr', 'zod'
  ];
  
  const byPkg = { root: { errors: 0, warnings: 0 } };
  for (const pkg of allPackages) {
    byPkg[pkg] = { errors: 0, warnings: 0 };
  }
  
  let totalErrors = 0;
  let totalWarnings = 0;

  // Group diagnostics by file and package
  const byFile = {};

  for (const d of data.diagnostics) {
    const match = d.filename.match(/packages\/([^/]+)/);
    const pkg = match ? match[1] : 'root';

    // Initialize if not already (handles unknown packages)
    if (!byPkg[pkg]) {
      byPkg[pkg] = { errors: 0, warnings: 0 };
    }

    if (!byFile[d.filename]) {
      byFile[d.filename] = [];
    }
    byFile[d.filename].push(d);

    if (d.severity === 'error') {
      byPkg[pkg].errors++;
      totalErrors++;
    } else {
      byPkg[pkg].warnings++;
      totalWarnings++;
    }
  }

  // Print errors grouped by file (like stylish format)
  for (const [filename, diagnostics] of Object.entries(byFile)) {
    // Show relative path
    const relativePath = filename.replace(process.cwd() + '/', '');
    console.log(`\n${relativePath}`);

    for (const d of diagnostics) {
      const label = d.labels?.[0]?.span;
      const position = label
        ? `${label.line}:${label.column}`.padStart(8)
        : '     ?:?';
      const severity = d.severity === 'error' ? 'error' : 'warning';
      console.log(
        `  ${position}  ${severity.padEnd(7)}  ${d.message}  ${d.code}`,
      );
    }
  }

  // Print per-package summary
  console.log('\n' + '─'.repeat(60));
  console.log('\n📦 Summary by Package:\n');

  const sortedPackages = Object.entries(byPkg).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [pkg, { errors, warnings }] of sortedPackages) {
    let status;
    if (errors > 0) {
      status = '❌';
    } else if (warnings > 0) {
      status = '⚠️ ';
    } else {
      status = '✅';
    }

    const pkgName = pkg === 'root' ? 'root' : `@orval/${pkg}`;
    console.log(
      `${status} ${pkgName.padEnd(20)} ${errors} errors, ${warnings} warnings`,
    );
  }

  console.log('\n' + '─'.repeat(60));
  console.log(
    `\n✖ ${totalErrors + totalWarnings} problems (${totalErrors} errors, ${totalWarnings} warnings)\n`,
  );

  // Exit with error code if there are errors
  if (totalErrors > 0) {
    process.exit(1);
  }
});
