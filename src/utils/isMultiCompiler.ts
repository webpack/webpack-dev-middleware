import type webpack from 'webpack';

export function isMultiCompiler(
  compiler: webpack.Compiler | webpack.MultiCompiler
): compiler is webpack.MultiCompiler {
  return 'compilers' in compiler && Array.isArray(compiler.compilers);
}
