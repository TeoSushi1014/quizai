
import { useState, useRef, useCallback } from 'react';

interface DragDropOptions {
  onFileAccepted: (file: File) => void;
  onError: (errorMessage: string) => void;
  maxFileSizeMB?: number;
  acceptedFileTypes?: string;
}

export const useDragAndDrop = ({
  onFileAccepted,
  onError,
  maxFileSizeMB = 10,
  acceptedFileTypes = '.pdf,.txt,.docx,image/*' // Default from user snippet
}: DragDropOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const validateFile = useCallback((file: File): boolean => {
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      onError(`Lỗi: Kích thước tệp tối đa ${maxFileSizeMB}MB.`);
      return false;
    }
    
    const acceptedTypesArray = acceptedFileTypes.split(',').map(type => type.trim().toLowerCase());
    const fileExtension = ("." + file.name.split('.').pop()?.toLowerCase()) || "";
    const fileMimeType = file.type.toLowerCase();
    
    let isValidType = acceptedTypesArray.includes(fileExtension);
    if (!isValidType) {
      isValidType = acceptedTypesArray.some(acceptedType => {
        if (acceptedType.startsWith('.')) return false; // e.g. ".pdf" - already handled
        if (acceptedType.endsWith('/*')) return fileMimeType.startsWith(acceptedType.slice(0, -2)); // e.g. "image/*"
        return fileMimeType === acceptedType; // e.g. "application/pdf"
      });
    }
    
    // Explicitly allow .docx and .pdf by extension if they were in acceptedFileTypes,
    // even if a generic MIME type (like application/octet-stream) was provided by the browser.
    if (!isValidType && fileExtension === '.docx' && acceptedFileTypes.toLowerCase().includes('.docx')) { 
        isValidType = true; 
    }
    if (!isValidType && fileExtension === '.pdf' && acceptedFileTypes.toLowerCase().includes('.pdf')) { 
        isValidType = true; 
    }
    
    if (!isValidType) {
      onError(`Loại tệp không được hỗ trợ. Các loại được chấp nhận: ${acceptedFileTypes.replace(/\./g, '').toUpperCase()}`);
      return false;
    }
    
    return true;
  }, [maxFileSizeMB, acceptedFileTypes, onError]);
  
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    onError(''); // Clear previous errors on new drag action
  }, [onError]);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Necessary to allow drop
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    onError(''); // Clear previous errors
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (validateFile(files[0])) {
        onFileAccepted(files[0]);
      }
    }
  }, [validateFile, onFileAccepted, onError]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onError(''); // Clear previous errors
    const files = e.target.files;
    if (files && files.length > 0) {
      if (validateFile(files[0])) {
        onFileAccepted(files[0]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
  }, [validateFile, onFileAccepted, onError]);
  
  return {
    isDragging,
    fileInputRef,
    handlers: {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange
    }
  };
};
