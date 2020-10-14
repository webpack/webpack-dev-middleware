export default class GetLogsPlugin {
  constructor() {
    this.logs = [];
  }

  static normalizeLogs(log, type) {
    if (Array.isArray(log)) {
      return log.map((nestedLog) =>
        GetLogsPlugin.normalizeLogs(nestedLog, type)
      );
    }

    // TODO remove after webpack@4 dropping
    if (type === 'error') {
      return 'ERROR';
    }

    // TODO remove after webpack@4 dropping
    if (type === 'warn') {
      return 'WARNING';
    }

    if (log.includes('modules')) {
      return 'compiled successfully';
    }

    return log
      .toString()
      .trim()
      .replace(process.cwd(), '/absolute/path/to')
      .replace(/\\/g, '/');
  }

  apply(compiler) {
    const hook =
      compiler.hooks.infrastructurelog || compiler.hooks.infrastructureLog;

    hook.tap('GetLogsPlugin', (name, type, args) => {
      this.logs.push([name, type, GetLogsPlugin.normalizeLogs(args, type)]);

      return false;
    });
  }
}
