import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dir, '../apps/api/src');
const failures: string[] = [];
const required = ['service.ts', 'controller.ts', 'router.ts', 'types.ts', 'utils'];
export function inspectImport(file: string, target: string): string | undefined {
  if ((file.startsWith('core/') || file.startsWith('common/')) && target.startsWith('api/'))
    return 'Infrastructure cannot depend on features';
  if (file.endsWith('.service.ts') && /(?:\.controller|\.router)\.ts$/.test(target))
    return 'Services cannot depend on transport';
  if (file.endsWith('.service.ts') && target === 'express')
    return 'Services cannot depend on Express';
  if (
    file.endsWith('.controller.ts') &&
    /^(?:core\/(?:db|queue)|api\/.*\.service\.ts)/.test(target) &&
    !target.startsWith(dirname(file) + '/')
  )
    return 'Controllers must call their own feature service';
  return undefined;
}
function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!path.endsWith('.ts')) continue;
    const file = relative(root, path);
    const segments = file.split('/');
    if (
      segments[0] === 'api' &&
      segments.length === 3 &&
      !new RegExp(
        `^${segments[1]}\\.(service|controller|router|types|validation|errors|consts)\\.ts$`,
      ).test(entry.name)
    )
      failures.push(`${file}: move helpers into utils/`);
    const source = ts.createSourceFile(
      file,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node): void {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        const target = specifier.startsWith('.')
          ? relative(root, resolve(dirname(path), specifier)) +
            (specifier.endsWith('.ts') ? '' : '.ts')
          : specifier;
        const error = inspectImport(file, target);
        if (error) failures.push(`${file}: ${error} (${specifier})`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
if (import.meta.main) {
  for (const feature of readdirSync(join(root, 'api'), { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  )) {
    for (const suffix of required) {
      const name = suffix === 'utils' ? suffix : `${feature.name}.${suffix}`;
      if (!existsSync(join(root, 'api', feature.name, name)))
        failures.push(`${feature.name}: missing ${name}`);
    }
  }
  walk(root);
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('Architecture: feature layout and dependency boundaries passed.');
}
