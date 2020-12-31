import fs from 'fs';
import path from 'path';

import execa from 'execa';

function extractWebpackEntry(string) {
  const matches = string.match(/^webpack\s\d\.\d\d?.\d\d?/gim);

  const result =
    matches === null
      ? null
      : matches.map((i) =>
          i
            .replace(/\d\d\./g, 'xx.')
            .replace(/\d\./g, 'xx.')
            .replace(/\.\d\d/g, '.xx')
            .replace(/\.\d/g, '.xx')
        );

  return result;
}

function extractErrorEntry(string) {
  const matches = string.match(/code:\s['||"]?\w.+['||"]/gim);

  return matches;
}

describe('logging', () => {
  it('should logging on successfully build', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackConfig',
          WCF_stats: 'normal',
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/Compiled successfully/gi.test(data)) {
        proc.stdin.write('exit');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(error).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging on successfully build in multi-compiler mode', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackMultiConfig',
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/Compiled successfully/gi.test(data)) {
        proc.stdin.write('exit');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(error).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging on unsuccessful build', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackErrorConfig',
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/error/gi.test(data)) {
        proc.stdin.write('exit');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(error).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging on unsuccessful build in multi-compiler', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackMultiErrorConfig',
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/error/gi.test(data)) {
        proc.stdin.write('exit');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(error).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging an warning', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackWarningConfig',
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/warning/gi.test(data)) {
        proc.stdin.write('exit');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(error).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging warnings in multi-compiler mode', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackMultiWarningConfig',
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/warning/gi.test(data)) {
        proc.stdin.write('exit');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(0);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(error).toMatchSnapshot('error');

      done();
    });
  });

  it('should logging an error in "watch" method', (done) => {
    const runner = `${__dirname}/utils/runner.js`;

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackConfig',
          WCF_infrastructureLogging_level: 'log',
          WATCH_break: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/Compiled successfully/gi.test(data)) {
        data += chunk.toString();
        proc.stdin.write('exit');
      }

      if (/error/gi.test(data)) {
        error += chunk.toString();
        proc.stdin.write('error');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(1);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(extractErrorEntry(error)).toMatchSnapshot('error');

      done();
    });
  });

  it.skip('should logging an error from the fs error when the "writeToDisk" option is "true"', async (done) => {
    const runner = `${__dirname}/utils/runner.js`;
    const outputDir = path.resolve(
      __dirname,
      './outputs/write-to-disk-mkdir-error/'
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    fs.chmodSync(outputDir, 0o000);

    let proc;

    try {
      proc = execa(runner, [], {
        stdio: 'pipe',
        env: {
          WC: 'webpackSimpleConfig',
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

    let data = '';
    let error = '';

    proc.stdout.on('data', (chunk) => {
      data += chunk.toString();

      if (/Compiled successfully/gi.test(data)) {
        data += chunk.toString();
        proc.stdin.write('exit');
      }

      if (/error/gi.test(data)) {
        error += chunk.toString();
        proc.stdin.write('error');
      }
    });

    proc.stderr.on('data', (chunk) => {
      error += chunk.toString();
      proc.stdin.write('error');
    });

    proc.on('exit', (code) => {
      expect(code).toBe(1);
      expect(extractWebpackEntry(data)).toMatchSnapshot('data');
      expect(extractErrorEntry(error)).toMatchSnapshot('error');

      // fs.chmodSync(outputDir, 0o777);
      // clearDirectory(outputDir);

      done();
    });
  });
});
