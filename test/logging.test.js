import fs from "fs";
import path from "path";
import os from "os";

import execa from "execa";
import stripAnsi from "strip-ansi";

function extractErrorEntry(string) {
  const matches = string.match(/error:\s\D[^:||\n||\r]+/gim);

  return matches === null ? null : matches[0];
}

function stdoutToSnapshot(stdout) {
  let cleanedStdout = stripAnsi(stdout.trim());

  // Bugs in `strip-ansi`
  cleanedStdout = cleanedStdout.replace(/null main /g, "main");
  cleanedStdout = cleanedStdout.replace(/(\d+):(\d+)-(\d+) /g, "$1:$2-$3");
  cleanedStdout = cleanedStdout.replace(/> (.+) {2}(.+)/g, "> $1 $2");

  cleanedStdout = cleanedStdout.replace(/\| /g, "|");
  cleanedStdout = cleanedStdout.replace(/compiled-for-tests/g, "");
  cleanedStdout = cleanedStdout.replace(/\d+.\d+ KiB/g, "x KiB");
  cleanedStdout = cleanedStdout.replace(/\d+ bytes/g, "x bytes");
  cleanedStdout = cleanedStdout.replace(/\d+ assets/g, "x assets");

  cleanedStdout = cleanedStdout.replace(/\d+ modules/g, "x modules");
  cleanedStdout = cleanedStdout.replace(/in \d+ ms/g, "in x ms");

  cleanedStdout = cleanedStdout.replace(
    /LOG from .+webpack/s,
    "LOG from xxx\n...\nwebpack"
  );
  cleanedStdout = cleanedStdout.replace(
    /webpack \d+.\d+.\d+/g,
    "webpack x.x.x"
  );
  cleanedStdout = cleanedStdout.replace(/\([0-9a-z]+\)/g, "(xxxx)");

  // webpack@4
  cleanedStdout = cleanedStdout.replace(/Hash: [0-9a-z]+/g, "Hash: xxxx");
  cleanedStdout = cleanedStdout.replace(/Time: \d+ms/g, "Time: Xms");
  cleanedStdout = cleanedStdout.replace(/Built at: .+/g, "Built at: x");
  cleanedStdout = cleanedStdout.replace(/LOG from .+$/s, "LOG from xxx");
  cleanedStdout = cleanedStdout.replace(/  +/g, " ");
  cleanedStdout = cleanedStdout.replace(/^ +/gm, "");
  cleanedStdout = cleanedStdout.replace(/ +$/gm, "");

  return cleanedStdout;
}

function stderrToSnapshot(stderr) {
  const cleanedStderr = stderr.trim();

  const matches = stderr.match(/error:\s\D[^:||\n||\r]+/gim);

  if (matches !== null) {
    return matches[0];
  }

  return cleanedStderr;
}

const runner = path.resolve(__dirname, "./helpers/runner.js");

describe("logging", () => {
  it("should logging on successfully build", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging on successfully build and respect colors", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-colors-true.config.js",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging on successfully build and respect colors #2", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-colors-false.config.js",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).not.toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging on successfully build when the 'stats' doesn't exist", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.no-stats.config.js",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "none" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-none.config.js",
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "minimal" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-minimal.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      // expect(stdout).toContain('\u001b[1m');
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "verbose" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-verbose.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "true" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-true.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with the "false" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-false.config",
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "stats" option from configuration with custom object value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.stats-object.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging on successfully build in multi-compiler mode", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging on unsuccessful build", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.error.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging on unsuccessful build in multi-compiler", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.error.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging an warning", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.warning.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it("should logging warnings in multi-compiler mode", (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.warning.config",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging in multi-compiler and respect the "stats" option from configuration', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.one-error-one-warning-one-success",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging in multi-compiler and respect the "stats" option from configuration #2', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG:
            "webpack.array.one-error-one-warning-one-success-with-names",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging in multi-compiler and respect the "stats" option from configuration #3', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.one-error-one-warning-one-no",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging in multi-compiler and respect the "stats" option from configuration #3', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.one-error-one-warning-one-object",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging an error in "watch" method', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_BREAK_WATCH: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  if (os.platform() !== "win32") {
    it('should logging an error from the fs error when the "writeToDisk" option is "true"', (done) => {
      // eslint-disable-next-line global-require
      const clearDirectory = require("./helpers/clearDirectory").default;
      const outputDir = path.resolve(
        __dirname,
        "./outputs/write-to-disk-mkdir-error"
      );

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.chmodSync(outputDir, 0o400);

      let proc;

      try {
        proc = execa(runner, [], {
          stdio: "pipe",
          env: {
            WEBPACK_CONFIG: "webpack.simple.config",
            WCF_output_filename: "bundle.js",
            WCF_output_path: outputDir,
            WCF_infrastructureLogging_level: "log",
            WMC_writeToDisk: true,
          },
        });
      } catch (error) {
        throw error;
      }

      let stderr = "";

      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
        proc.stdin.write("|exit|");
      });

      proc.on("error", (error) => {
        done(error);
      });

      proc.on("exit", () => {
        expect(extractErrorEntry(stderr)).toMatch("Error: EACCES");

        fs.chmodSync(outputDir, 0o700);
        clearDirectory(outputDir);

        done();
      });
    });
  }

  it('should logging on successfully build using the "stats" option for middleware with the "true" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WMC_stats: true,
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with the "false" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WMC_stats: false,
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with the "none" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WMC_stats: "none",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with the "normal" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WMC_stats: "normal",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with the "verbose" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WMC_stats: "verbose",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with object value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WEBPACK_DEV_MIDDLEWARE_STATS: "object",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with the object value and colors', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WEBPACK_DEV_MIDDLEWARE_STATS: "object_colors_true",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build using the "stats" option for middleware with object value and no colors', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          WEBPACK_DEV_MIDDLEWARE_STATS: "object_colors_false",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).not.toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully multi-compiler build using the "stats" option for middleware with the "true" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          WMC_stats: true,
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully multi-compiler build using the "stats" option for middleware with the "false" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          WMC_stats: false,
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully multi-compiler build using the "stats" option for middleware with the "normal" value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          WMC_stats: "normal",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully multi-compiler build using the "stats" option for middleware with the object value', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          WEBPACK_DEV_MIDDLEWARE_STATS: "object",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully multi-compiler build using the "stats" option for middleware with object value and colors', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          WEBPACK_DEV_MIDDLEWARE_STATS: "object_colors_true",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully multi-compiler build using the "stats" option for middleware with object value and no colors', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.array.config",
          WEBPACK_DEV_MIDDLEWARE_STATS: "object_colors_false",
          FORCE_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).not.toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });

  it('should logging on successfully build and respect the "NO_COLOR" env', (done) => {
    let proc;

    try {
      proc = execa(runner, [], {
        stdio: "pipe",
        env: {
          WEBPACK_CONFIG: "webpack.config",
          NO_COLOR: true,
        },
      });
    } catch (error) {
      throw error;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      if (/compiled-for-tests/gi.test(stdout)) {
        proc.stdin.write("|exit|");
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      proc.stdin.write("|exit|");
    });

    proc.on("error", (error) => {
      done(error);
    });

    proc.on("exit", () => {
      expect(stdout).not.toContain("\u001b[1m");
      expect(stdoutToSnapshot(stdout)).toMatchSnapshot("stdout");
      expect(stderrToSnapshot(stderr)).toMatchSnapshot("stderr");

      done();
    });
  });
});
