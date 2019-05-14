export default {
  basic: {
    hasErrors() {
      return false;
    },
    hasWarnings() {
      return false;
    },
    toString() {
      return 'stats:basic';
    },
  },

  error: {
    hasErrors() {
      return true;
    },
    hasWarnings() {
      return false;
    },
    toString() {
      return 'stats:error';
    },
  },

  warning: {
    hasErrors() {
      return false;
    },
    hasWarnings() {
      return true;
    },
    toString() {
      return 'stats:warning';
    },
  },
};
