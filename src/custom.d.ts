declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'react-katex';
declare module 'react-markdown/lib/ast-to-react';
declare module 'pdfjs-dist/build/pdf';

interface Element {
  style?: CSSStyleDeclaration;
}

type TranslationKey = string;

declare module 'katex/dist/katex.min.css';

interface ImportMetaEnv {
  readonly MODE: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
