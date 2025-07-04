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
