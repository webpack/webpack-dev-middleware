export default function setupRebuild(context) {
  function rebuild() {
    if (context.state) {
      // eslint-disable-next-line no-param-reassign
      context.state = false;

      context.compiler.run((err) => {
        if (err) {
          context.log.error(err.stack || err);

          if (err.details) {
            context.log.error(err.details);
          }
        }
      });
    } else {
      // eslint-disable-next-line no-param-reassign
      context.forceRebuild = true;
    }
  }

  // eslint-disable-next-line no-param-reassign
  context.rebuild = rebuild;
}
