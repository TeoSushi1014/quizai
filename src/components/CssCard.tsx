import React from 'react';
import styled from 'styled-components';

const Card = ({ language = 'CSS', className = '' }) => {
  return (
    <StyledWrapper className={className}>
      <div className="code-editor">        <div className="header">
          <span className="title">{language}</span>
        </div>
        <div className="editor-content">
          <code className="code">
            <p><span className="color-0">.code-editor </span> <span>{'{'}</span></p>
            <p className="property">
              <span className="color-2">max-width</span><span>:</span>
              <span className="color-1">300px</span>;
            </p>
            <p className="property">
              <span className="color-2">background-color</span><span>:</span>
              <span className="color-preview-1"></span><span>#1d1e22</span>;
            </p>
            <p className="property">
              <span className="color-2"> box-shadow</span><span>:</span>
              <span className="color-1">0px 4px 30px  <span className="color-preview-2"></span><span className="color-3">rgba(</span>0, 0, 0, 0.5<span className="color-3">)</span></span>;
            </p>
            <p className="property">
              <span className="color-2">border-radius</span><span>:</span>
              <span className="color-1">8px</span>;
            </p>
            <span>{'}'}</span>
          </code>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .code-editor {
    max-width: 300px;
    background-color: #1d1e22;
    box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    padding: 2px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 10px;
  }
  .title {
    font-family: Lato, sans-serif;
    font-weight: 900;
    font-size: 14px;
    letter-spacing: 1.57px;
    color: rgb(212 212 212);
  }

  .editor-content {
    margin: 0 10px 10px;
    color: white;
  }

  .property {
    margin-left: 30px;
  }

  .property:hover {
    cursor: text;
  }

  .editor-content .color-0 {
    color: rgb(86 156 214);
  }

  .editor-content .color-1 {
    color: rgb(182 206 168);
  }

  .editor-content .color-2 {
    color: rgb(156 220 254);
  }

  .editor-content .color-3 {
    color: rgb(207 146 120);
  }

  .color-preview-1,.color-preview-2 {
    height: 8px;
    width: 8px;
    border: 1px solid #fff;
    display: inline-block;
    margin-right: 3px;
  }

  .color-preview-1 {
    background-color: #1d1e22;
  }

  .color-preview-2 {
    background-color: rgba(0, 0, 0, 0.5);
  }
`;

export default Card;
