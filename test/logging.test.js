import fs from 'fs';
import path from 'path';

import execa from 'execa';
import webpack from 'webpack';

import clearDirectory from './helpers/clearDirectory';

function extractWebpackEntry(string) {
  const matches = string.match(/webpack\s\d\.\d\d?.\d\d?/gim);

  const result =
    matches === null
      ? null
      : matches.map((i) =>
          i
            .replace(/\d\d\./g, 'xx.')
            .replace(/\d\./g, 'xx.')
            .replace(/\.\d\d/g, '.xx')
            .replace(/\.\d/g, '.xx')
        )[0];

  return result;
}

function extractCountCompilations(string) {
  const matches = webpack.webpack
    ? string.match(/webpack\s\d\.\d\d?.\d\d?/gim)
    : string.match(/Entrypoint/gim);

  const result = matches === null ? null : matches.length;

  return `Count compilations: ${result}`;
}

function extractErrorEntry(string) {
  const matches = string.match(/code:\s['||"]?\w.+['||"]/gim);

  return matches;
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
          WCF_stats: 'normal',
        },
      });
    } catch (error) {
      throw error;
    }

    let stdOut = '';
    let stdError = '';

    proc.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();

      if (!/error/gi.test(stdOut)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(
        `${extractWebpackEntry(stdOut)}\n${extractCountCompilations(stdOut)}`
      ).toMatchSnapshot('data');
      expect(stdError).toMatchSnapshot('error');

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

    let stdOut = '';
    let stdError = '';

    proc.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();

      if (!/error/gi.test(stdOut)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(
        `${extractWebpackEntry(stdOut)}\n${extractCountCompilations(stdOut)}`
      ).toMatchSnapshot('data');
      expect(stdError).toMatchSnapshot('error');

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

    let stdOut = '';
    let stdError = '';

    proc.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();

      if (/error/gi.test(stdOut)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(
        `${extractWebpackEntry(stdOut)}\n${extractCountCompilations(stdOut)}`
      ).toMatchSnapshot('data');
      expect(stdError).toMatchSnapshot('error');

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

    let stdOut = '';
    let stdError = '';

    proc.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();

      if (/error/gi.test(stdOut)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(
        `${extractWebpackEntry(stdOut)}\n${extractCountCompilations(stdOut)}`
      ).toMatchSnapshot('data');
      expect(stdError).toMatchSnapshot('error');

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

    let stdOut = '';
    let stdError = '';

    proc.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();

      if (/warning/gi.test(stdOut)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(
        `${extractWebpackEntry(stdOut)}\n${extractCountCompilations(stdOut)}`
      ).toMatchSnapshot('data');
      expect(stdError).toMatchSnapshot('error');

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

    let stdOut = '';
    let stdError = '';

    proc.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();

      if (/warning/gi.test(stdOut)) {
        proc.stdin.write('|exit|');
      }
    });

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(
        `${extractWebpackEntry(stdOut)}\n${extractCountCompilations(stdOut)}`
      ).toMatchSnapshot('data');
      expect(stdError).toMatchSnapshot('error');

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

    let stdError = '';

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(extractErrorEntry(stdError)).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging an error from the fs error when the "writeToDisk" option is "true"', async (done) => {
    const runner = `${__dirname}/helpers/runner.js`;
    const outputDir = path.resolve(
      __dirname,
      './outputs/write-to-disk-mkdir-error'
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    fs.chmodSync(outputDir, 0o444);

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

    let stdError = '';

    proc.stderr.on('data', (chunk) => {
      stdError += chunk.toString();
      proc.stdin.write('|exit|');
    });

    proc.on('exit', () => {
      expect(extractErrorEntry(stdError)).toMatchSnapshot('error');

      fs.chmodSync(outputDir, 0o777);
      clearDirectory(outputDir);

      done();
    });
  });
});
