// Register ts-node programmatically using local dependencies
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs"
  }
});

// Load the actual server entry point
require('./src/server.ts');
