import fs from 'fs';
import path from 'path';
import os from 'os';

import execa from 'execa';

// function extractCountCompilations(string) {
//   const matches = webpack.webpack
//     ? string.match(/webpack\s\d\.\d\d?.\d\d?/gim)
//     : string.match(/Entrypoint/gim);
//
//   const result = matches === null ? null : matches.length;
//
//   return `Count compilations: ${result}`;
// }

function extractErrorEntry(string) {
  const matches = string.match(/error:\s\D[^:||\n||\r]+/gim);

  return matches === null ? null : matches[0];
}

describe('logging', () => {
  it('should logging on successfully build', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "none" value', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.stats-none.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "minimal" value', (done) => {
    // TODO fix me
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.stats-minimal.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it.skip('should logging on successfully build and respect the "stats" option from configuration with the "verbose" value', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.stats-verbose.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "true" value', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.stats-true.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "false" value', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.stats-false.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with custom object value', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.stats-object.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on successfully build in multi-compiler mode', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.array.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on unsuccessful build', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.error.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging on unsuccessful build in multi-compiler', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.array.error.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging an warning', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.warning.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (/warning/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging warnings in multi-compiler mode', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.array.warning.config',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (/warning/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging in multi-compiler and respect the "stats" option from configuration', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.array.one-error-one-warning-one-success',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging in multi-compiler and respect the "stats" option from configuration #2', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpack.array.one-error-one-warning-one-success-with-names',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();

      if (!/error/gi.test(stdout)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(stdout.trim()).toMatchSnapshot('stdout');
      expect(stderr.trim()).toMatchSnapshot('stderr');

      done();
    });
  });

  it('should logging an error in "watch" method', (done) => {
    const runner = `${__dirname}/helpers/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WCF_infrastructureLogging_level: 'log',
          WATCH_break: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(extractErrorEntry(stderr)).toMatchSnapshot('error');

      done();
    });
  });

  if (os.platform() !== 'win32') {
    it('should logging an error from the fs error when the "writeToDisk" option is "true"', async (done) => {
      // eslint-disable-next-line global-require
      const clearDirectory = require('./helpers/clearDirectory').default;
      const runner = `${__dirname}/helpers/runner.js`;
      const outputDir = path.resolve(
        __dirname,
        './outputs/write-to-disk-mkdir-error'
      );

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      fs.chmodSync(outputDir, 0o400);

      let proc;

      try {
        proc = execa(runner, [], {
          stdio: 'pipe',
          env: {
            WC: 'webpack.simple.config',
            WCF_output_filename: 'bundle.js',
            WCF_output_path: outputDir,
            WCF_infrastructureLogging_level: 'log',
            WMC_writeToDisk: true,
            FS_block: true,
          },
        });
      } catch (error) {
        throw error;
      }

      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        proc.stdin.write('|exit|');
      });

      proc.on('exit', () => {
        expect(extractErrorEntry(stderr)).toMatch('Error: EACCES');

        fs.chmodSync(outputDir, 0o700);
        clearDirectory(outputDir);

        done();
      });
    });
  }
});
