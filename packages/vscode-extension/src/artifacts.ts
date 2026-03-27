import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type {
  CodeFile,
  CodeOutput,
  Context,
  RawCodeOutput,
  RawTestOutput,
  TestFile,
  TestOutput,
} from '@sajkatav/core';

interface PersistResult {
  written: string[];
  skipped: string[];
}

/**
 * Persist generated code and test files from pipeline context to disk.
 */
export async function persistArtifacts(ctx: Context): Promise<PersistResult> {
  const workDir = resolve(ctx.workDir);
  const written: string[] = [];
  const skipped: string[] = [];

  const code = ctx.get<CodeOutput | RawCodeOutput>('code');
  const tests = ctx.get<TestOutput | RawTestOutput>('tests');

  const files: Array<CodeFile | TestFile> = [];
  if (code && 'files' in code && Array.isArray(code.files)) {
    files.push(...code.files);
  }
  if (tests && 'files' in tests && Array.isArray(tests.files)) {
    files.push(...tests.files);
  }

  for (const file of files) {
    if (!file?.path) continue;

    const target = resolve(workDir, file.path);
    if (!isWithinWorkspace(workDir, target)) {
      skipped.push(file.path);
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');

    if (!ctx.files.includes(file.path)) {
      ctx.addFile(file.path);
    }
    written.push(file.path);
  }

  return { written, skipped };
}

function isWithinWorkspace(baseDir: string, targetPath: string): boolean {
  return targetPath === baseDir || targetPath.startsWith(baseDir + sep);
}
