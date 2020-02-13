import webpack from 'webpack';

export default () => {
  return webpack.version[0] === '5';
};
