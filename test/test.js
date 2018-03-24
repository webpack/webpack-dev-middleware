'use strict';

// keep the log test first, wonky sinon errors otherwise
require('./tests/log');

require('./tests/api');
require('./tests/compiler-callbacks');
require('./tests/file-system');
require('./tests/lazy');
require('./tests/reporter');
require('./tests/server');
require('./tests/util');
