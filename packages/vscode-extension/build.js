const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
};

(async () => {
  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
    console.log('Watching...');
  } else {
    await esbuild.build(opts);
    console.log('Built out/extension.js');
  }
})();
