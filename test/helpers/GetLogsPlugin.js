export default class GetLogsPlugin {
  constructor() {
    this.logs = [];
  }

  static normalizeLogs(logs) {
    if (Array.isArray(logs)) {
      return logs.map((log) => GetLogsPlugin.normalizeLogs(log));
    }

    return logs.toString().trim();
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
