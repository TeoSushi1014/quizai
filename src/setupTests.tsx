
import '@testing-library/jest-dom';
import React from 'react'; // Import React for JSX
import { jest, fn } from '@jest/globals'; // Import Jest globals

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: fn(), // deprecated
    removeListener: fn(), // deprecated
    addEventListener: fn(),
    removeEventListener: fn(),
    dispatchEvent: fn(),
  })),
});

// Mock ResizeObserver
window.ResizeObserver = fn().mockImplementation(() => ({
  observe: fn(),
  unobserve: fn(),
  disconnect: fn(),
}));

// Mock IntersectionObserver
window.IntersectionObserver = fn().mockImplementation(() => ({
  observe: fn(),
  unobserve: fn(),
  disconnect: fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: fn(() => [])
}));

// Mock for Google reCAPTCHA
if (typeof (window as any).grecaptcha === 'undefined') {
  (window as any).grecaptcha = {
    enterprise: {
      ready: fn((callback) => callback()),
      execute: fn().mockResolvedValue('mock-recaptcha-token'),
    },
  };
}

// Mock for localforage (basic mock, can be expanded if needed)
jest.mock('localforage', () => ({
  getItem: fn(() => Promise.resolve(null)),
  setItem: fn(() => Promise.resolve()),
  removeItem: fn(() => Promise.resolve()),
  clear: fn(() => Promise.resolve()),
  config: fn(),
}));

// Mock framer-motion
jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    motion: {
      // Provide simple div mocks for all motion components used
      // Add other motion elements as needed (e.g., h1, p, section)
      div: fn(({ children, ...props }) => <div {...props}>{children}</div>),
      h1: fn(({ children, ...props }) => <h1 {...props}>{children}</h1>),
      p: fn(({ children, ...props }) => <p {...props}>{children}</div>),
      section: fn(({ children, ...props }) => <section {...props}>{children}</section>),
      // Add other specific motion components you use, e.g., motion.button
    },
    AnimatePresence: fn(({ children }) => <>{children}</>),
    // Add other exports from framer-motion if used directly
  };
});

// Mock react-router-dom navigation hooks
// This is a common pattern. You might need to adjust based on your actual usage.
// If you use <Link> or <NavLink> extensively, those might need specific handling or you rely on MemoryRouter in tests.
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'), // Import and retain default behavior
  useNavigate: () => fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'testKey' }),
  useParams: () => ({}),
}));

// Mock @react-oauth/google
jest.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children, ...restProps }: { children: React.ReactNode; [key: string]: any }) => <div {...restProps}>{children}</div>,
  useGoogleLogin: fn(() => fn()), // Mock the hook to return a mock login function
  googleLogout: fn(),
}));


// If using katex, you might need a simple mock if it causes issues in JSDOM
// jest.mock('katex', () => ({
//   render: fn(),
//   __parse: fn(), // if you use internal/specific functions from katex
// }));

// Mock for pdfjs-dist to prevent worker errors in Jest
jest.mock('pdfjs-dist/build/pdf', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: fn().mockResolvedValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: fn().mockResolvedValue({
        getTextContent: fn().mockResolvedValue({ items: [{ str: 'mock pdf text' }] }),
        getViewport: fn().mockReturnValue({ width: 100, height: 100 }),
        render: fn().mockResolvedValue(undefined),
      }),
    }),
  }),
}));

jest.mock('mammoth', () => ({
  extractRawText: fn().mockResolvedValue({ value: 'mock docx text' }),
}));

// This line was problematic as `props` was defined in module scope but used in mock scope without clear capture.
// The GoogleOAuthProvider mock has been updated to correctly handle props.
// const { children, ...props } = { children: React.createElement('div') }; 
