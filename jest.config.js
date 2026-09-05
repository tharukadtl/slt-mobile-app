module.exports = {
  preset: 'react-native',
  // e2e/ holds real Detox tests (device/element/by globals, a real emulator via
  // `npm run e2e:test`), not Jest unit tests -- e2e/jest.config.js is their own,
  // separate config. Without this, plain `jest`/`npm test` collects e2e/*.test.js
  // too and fails with "ReferenceError: device is not defined", since none of
  // Detox's globals exist under this config. Confirmed by actually hitting that
  // failure in a clean run, not assumed (2026-09-03).
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/e2e/'],
  // Allow Jest to transform the Redux ecosystem, which ships ESM builds
  // (@reduxjs/toolkit → immer/redux/reselect, plus react-redux). The stock
  // react-native preset ignores all of node_modules except RN packages, which
  // is why anything importing the store previously failed to parse. Test-only
  // config; no production code is affected.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation/.*|@reduxjs/toolkit|immer|redux|redux-thunk|reselect|react-redux))',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // jest-junit writes reports/jest-junit.xml, which the CI workflow's summary
  // step reads to build the Job Summary. 'default' keeps the normal console
  // reporter too -- this adds a second reporter, it doesn't replace one.
  reporters: [
    'default',
    ['jest-junit', {outputDirectory: 'reports', outputName: 'jest-junit.xml'}],
  ],
  // babel-plugin-module-resolver only rewrites the path aliases when they are
  // written as literals, so `require.resolve(someVariable)` never sees them.
  // Mirror the same aliases (babel.config.js / tsconfig.json paths) in Jest's
  // own resolver so dynamically-resolved module names work too. Test-only
  // config; no production code is affected.
  moduleNameMapper: {
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@appTypes/(.*)$': '<rootDir>/src/types/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
};
