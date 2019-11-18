export default function setupLogger(context) {
  // eslint-disable-next-line no-param-reassign
  context.logger = context.compiler.getInfrastructureLogger(
    'webpack-dev-middleware'
  );
}
