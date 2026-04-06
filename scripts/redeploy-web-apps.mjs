#!/usr/bin/env node
/**
 * Push, version, and redeploy **Web app** deployments for authenticator + token broker.
 * Reads deployment ids from scripts/tt-deploy-ids.json (local; gitignored).
 *
 * Usage (from Token Triangle repo root):
 *   node scripts/redeploy-web-apps.mjs [version-message]
 *   DEPLOY_MESSAGE="fix issue" node scripts/redeploy-web-apps.mjs
 *
 * Env:
 *   CLASP — path to clasp binary (default: "clasp" on PATH)
 *   CLASP_AUTH — path to cc.clasprc.json (default: ~/.clasp/cc.clasprc.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const idsPath = path.join(repoRoot, 'scripts', 'tt-deploy-ids.json');

const CLASP = process.env.CLASP || 'clasp';
const CLASP_AUTH =
  process.env.CLASP_AUTH || path.join(os.homedir(), '.clasp', 'cc.clasprc.json');

function claspRun(cwd, args) {
  const full = ['-A', CLASP_AUTH, ...args];
  const r = spawnSync(CLASP, full, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error,
  };
}

function parseVersionNumber(text) {
  const m = String(text).match(/Created version\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function redeployApp({ name, appDir, deploymentId, message }) {
  const cwd = path.join(repoRoot, appDir);
  if (!deploymentId || String(deploymentId).trim() === '') {
    console.error(`[redeploy] Skip ${name}: missing deployment id in tt-deploy-ids.json`);
    return false;
  }

  console.log(`\n[redeploy] === ${name} (${appDir}) ===`);

  let r = claspRun(cwd, ['push', '--force']);
  if (r.status !== 0) {
    console.error(r.stdout + r.stderr);
    throw new Error(`clasp push failed (${name})`);
  }
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  r = claspRun(cwd, ['version', message]);
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`clasp version failed (${name})`);
  }

  const versionNum = parseVersionNumber(r.stdout + r.stderr);
  if (!versionNum) {
    throw new Error(
      `Could not parse "Created version N" from clasp output (${name}). Output:\n${r.stdout}\n${r.stderr}`
    );
  }

  r = claspRun(cwd, [
    'deploy',
    '-i',
    String(deploymentId).trim(),
    '-V',
    String(versionNum),
    '-d',
    message,
  ]);
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`clasp deploy failed (${name})`);
  }

  console.log(`[redeploy] ${name} — deployed Web app @ version ${versionNum}`);
  return true;
}

function main() {
  const message =
    process.argv[2] ||
    process.env.DEPLOY_MESSAGE ||
    'redeploy web apps';

  if (!fs.existsSync(idsPath)) {
    console.error(
      `[redeploy] Missing ${idsPath}\nCopy scripts/tt-deploy-ids.example.json → scripts/tt-deploy-ids.json and fill deployment ids.`
    );
    process.exit(1);
  }

  if (!fs.existsSync(CLASP_AUTH)) {
    console.error(`[redeploy] Missing clasp auth file: ${CLASP_AUTH}`);
    process.exit(1);
  }

  let ids;
  try {
    ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
  } catch (e) {
    console.error('[redeploy] Invalid JSON in tt-deploy-ids.json:', e.message);
    process.exit(1);
  }

  try {
    redeployApp({
      name: 'Authenticator',
      appDir: 'apps/authenticator',
      deploymentId: ids.authenticatorDeploymentId,
      message,
    });
    redeployApp({
      name: 'Token broker',
      appDir: 'apps/token-broker',
      deploymentId: ids.tokenBrokerDeploymentId,
      message,
    });
  } catch (e) {
    console.error('[redeploy] FAILED:', e.message);
    process.exit(1);
  }

  console.log('\n[redeploy] Done.');
}

main();
