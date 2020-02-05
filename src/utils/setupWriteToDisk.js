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
          const name = compiler.options.name
            ? `Child "${compiler.options.name}": `
            : '';

          return fs.mkdir(dir, { recursive: true }, (mkdirError) => {
            if (mkdirError) {
              context.logger.error(
                `${name}Unable to write "${dir}" directory to disk:\n${mkdirError}`
              );

              return callback(mkdirError);
            }

            return fs.writeFile(targetPath, content, (writeFileError) => {
              if (writeFileError) {
                context.logger.error(
                  `${name}Unable to write "${targetPath}" asset to disk:\n${writeFileError}`
                );

                return callback(writeFileError);
              }

              context.logger.log(
                `${name}Asset written to disk: "${targetPath}"`
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
