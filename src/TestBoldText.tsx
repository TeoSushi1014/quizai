import React from 'react';
import { createRoot } from 'react-dom/client';
import MathText from './components/MathText';

const TestComponent = () => {
  // Sample text with **bold** styling that's causing issues
  const textWithBoldFormatting = `
## Test Bold Text

Trong ảnh chụp màn hình, tôi thấy vấn đề là ngay cả nội dung văn bản đơn giản (như **"datagpt"**, **"SOTRL"**) vẫn đang được hiển thị trong các code block với điều đễ "Text" và nút sao chép, thay vì hiển thị dạng text thông thường.

**Text đậm này có bị hiển thị thành link không?**
  `;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Testing Bold Text vs Links</h1>
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '30px' }}>
        <h2>With Markdown Formatting</h2>
        <MathText text={textWithBoldFormatting} markdownFormatting={true} />
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><TestComponent /></React.StrictMode>);
}
