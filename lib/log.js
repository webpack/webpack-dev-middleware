'use strict';

const chalk = require('chalk');
const loglevel = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const logSymbols = require('log-symbols');
const uuid = require('uuid/v1');

const symbols = {
  trace: chalk.grey('₸'),
  debug: chalk.cyan('➤'),
  info: logSymbols.info,
  warn: logSymbols.warning,
  error: logSymbols.error
};

const loggers = [];

module.exports = function logger(options) {
  loglevel.logTime = options.logTime;
  loglevel.uuid = uuid();
  loggers.push(loglevel);

  prefix.apply(loglevel, {
    template: chalk`${loglevel.logTime ? '[%t] ' : ''}%l {grey ｢wdm｣}:`,
    levelFormatter(level) {
      return symbols[level];
    }
  });

  const log = loglevel.getLogger(`webpack-dev-server-${loglevel.uuid}`);

  log.setLevel(options.logLevel || 'info');
  log.root = loglevel;

  return log;
};

module.exports.loggers = loggers;
