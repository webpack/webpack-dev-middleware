import fs from 'fs';
import path from 'path';

export default function setupWriteToDisk(context) {
  const compilers = context.compiler.compilers || [context.compiler];

  for (const compiler of compilers) {
    compiler.hooks.emit.tap('WebpackDevMiddleware', (compilation) => {
      if (compiler.hasWebpackDevMiddlewareAssetEmittedCallback) {
        return;
      }

      compiler.hooks.assetEmitted.tapAsync(
        'WebpackDevMiddleware',
        (file, info, callback) => {
          let targetPath = null;
          let content = null;

          // webpack@5
          if (info.compilation) {
            ({ targetPath, content } = info);
          } else {
            let targetFile = file;

            const queryStringIdx = targetFile.indexOf('?');

            if (queryStringIdx >= 0) {
              targetFile = targetFile.substr(0, queryStringIdx);
            }

            let { outputPath } = compiler;

            outputPath = compilation.getPath(outputPath, {});
            content = info;
            targetPath = path.join(outputPath, targetFile);
          }

          const { writeToDisk: filter } = context.options;
          const allowWrite =
            filter && typeof filter === 'function' ? filter(targetPath) : true;

          if (!allowWrite) {
            return callback();
          }

          const dir = path.dirname(targetPath);

          return fs.mkdir(dir, { recursive: true }, (mkdirError) => {
            if (mkdirError) {
              return callback(mkdirError);
            }

            return fs.writeFile(targetPath, content, (writeFileError) => {
              if (writeFileError) {
                return callback(writeFileError);
              }

              context.logger.log(
                `Asset written to disk: ${path.relative(
                  process.cwd(),
                  targetPath
                )}`
              );

              return callback();
            });
          });
        }
      );
      compiler.hasWebpackDevMiddlewareAssetEmittedCallback = true;
    });
  }
}
