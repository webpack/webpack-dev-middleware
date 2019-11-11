export default function setupRebuild(context) {
  function rebuild() {
    if (context.state) {
      // eslint-disable-next-line no-param-reassign
      context.state = false;

      context.compiler.run((error) => {
        if (error) {
          context.log.error(error);
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
