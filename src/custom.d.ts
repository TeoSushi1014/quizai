// Add module declarations to fix TypeScript errors

// CSS module declarations
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// External module declarations
declare module 'react-katex';
declare module 'react-markdown/lib/ast-to-react';
declare module 'pdfjs-dist/build/pdf';

// Fix for Element.style type error
interface Element {
  style?: CSSStyleDeclaration;
}

// Fix for missing translations
type TranslationKey = string;

// Explicit KaTeX declarations
declare module 'katex/dist/katex.min.css';
