export default class GetLogsPlugin {
  constructor() {
    this.logs = [];
  }

  static normalizeLogs(log) {
    if (Array.isArray(log)) {
      return log.map((nestedLog) => GetLogsPlugin.normalizeLogs(nestedLog));
    }

    return log
      .toString()
      .trim()
      .replace(/\d+ modules/, 'X modules')
      .replace(/Entrypoint (\w+) = ([\w.]+)( (\(.*\)))?/, 'Entrypoint $1 = $2')
      .replace(/Child "(\w+)":\s+/, 'Child "$1": ');
  }

  apply(compiler) {
    const hook =
      compiler.hooks.infrastructurelog || compiler.hooks.infrastructureLog;

    hook.tap('GetLogsPlugin', (name, type, args) => {
      this.logs.push([name, type, GetLogsPlugin.normalizeLogs(args)]);

      return false;
    });
  }
}
