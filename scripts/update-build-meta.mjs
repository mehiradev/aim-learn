import fs from 'fs';
import path from 'path';

const root = new URL('..', import.meta.url);
const pkgPath = new URL('package.json', root).pathname;
const readmePath = new URL('README.md', root).pathname;

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = String(pkg.version ?? '0.0.0');
const versionParts = currentVersion.split('.').map(Number);
const nextVersion = versionParts.length === 3
  ? `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`
  : `${versionParts[0]}.${versionParts[1] ?? 0}.${(versionParts[2] ?? 0) + 1}`;

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const buildDate = new Date();
const pad = (n) => String(n).padStart(2, '0');
const buildDateText = `${pad(buildDate.getUTCDate())}/${pad(buildDate.getUTCMonth() + 1)}/${buildDate.getUTCFullYear()} ${pad(buildDate.getUTCHours())}:${pad(buildDate.getUTCMinutes())} UTC`;

const readme = fs.readFileSync(readmePath, 'utf-8');
const updatedReadme = readme.replace(
  /^> Build : v[0-9]+\.[0-9]+\.[0-9]+ · .*$/m,
  `> Build : v${nextVersion} · ${buildDateText}`
);

if (updatedReadme === readme) {
  throw new Error('README.md build metadata placeholder not found. Please add `> Build : vX.Y.Z · YYYY-MM-DD hh:mm UTC` to the top of README.md.');
}

fs.writeFileSync(readmePath, updatedReadme, 'utf-8');
console.log(`Updated build metadata: version=${nextVersion}, buildDate=${buildDateText}`);
