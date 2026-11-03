import { resolve } from 'node:path';

// Only configure hooks when this project owns the repository.
const projectRoot = resolve(import.meta.dir, '..');
if (Bun.which('git')) {
  const probe = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel'], {
    cwd: projectRoot,
    stderr: 'ignore',
  });
  if (probe.exitCode === 0 && probe.stdout.toString().trim() === projectRoot) {
    const result = Bun.spawnSync(['git', 'config', 'core.hooksPath', '.githooks'], {
      cwd: projectRoot,
      stderr: 'inherit',
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
    console.log('Commitlint commit hook installed.');
  }
}
