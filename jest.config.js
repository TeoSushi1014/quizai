module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.tsx'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Ensure aliases used in the app are mapped here if Jest needs them
    // For example, if you use '@/' in your imports:
    '^@/(.*)$': '<rootDir>/src/$1', 
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx', // Typically, the entry point is not unit tested this way
    '!src/vite-env.d.ts' // Vite specific declaration file
  ],
  // transform an empty object for media files if not handled by identity-obj-proxy or specific needs.
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/fileTransformer.js'
  }
};