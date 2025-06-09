
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from '../App'; // Import useTranslation

interface DragDropOptions {
  onFilesAccepted: (files: File[]) => void; // Changed to handle multiple files
  onError: (errorMessage: string) => void;
  maxFileSizeMB?: number;
  acceptedFileTypes?: string;
  multipleFiles?: boolean; // New prop to enable multiple file selection
}

export const useDragAndDrop = ({
  onFilesAccepted,
  onError,
  maxFileSizeMB = 10,
  acceptedFileTypes = '.pdf,.txt,.docx,image/*',
  multipleFiles = false, // Default to single file
}: DragDropOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation(); 

  const validateFile = useCallback((file: File): boolean => {
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      onError(t('step1ErrorFileTooLarge', { maxFileSizeMB }));
      return false;
    }

    const acceptedTypesArray = acceptedFileTypes.split(',').map(type => type.trim().toLowerCase());
    const fileExtension = ("." + file.name.split('.').pop()?.toLowerCase()) || "";
    const fileMimeType = file.type.toLowerCase();

    let isValidType = acceptedTypesArray.includes(fileExtension);
    if (!isValidType) {
      isValidType = acceptedTypesArray.some(acceptedType => {
        if (acceptedType.startsWith('.')) return false; 
        if (acceptedType.endsWith('/*')) return fileMimeType.startsWith(acceptedType.slice(0, -2)); 
        return fileMimeType === acceptedType; 
      });
    }
    
    if (!isValidType && fileExtension === '.docx' && acceptedFileTypes.toLowerCase().includes('.docx')) {
        isValidType = true;
    }
    if (!isValidType && fileExtension === '.pdf' && acceptedFileTypes.toLowerCase().includes('.pdf')) {
        isValidType = true;
    }


    if (!isValidType) {
      onError(t('step1ErrorUnsupportedFileTypeDynamic', { acceptedFileTypes: acceptedFileTypes.replace(/\./g, '').toUpperCase() }));
      return false;
    }

    return true;
  }, [maxFileSizeMB, acceptedFileTypes, onError, t]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    onError(''); 
  }, [onError]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation(); 
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    onError(''); 

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (multipleFiles) {
      const validFiles: File[] = [];
      for (const file of droppedFiles) {
        if (!validateFile(file)) return; // Stop if any file is invalid
        validFiles.push(file);
      }
      if (validFiles.length > 0) onFilesAccepted(validFiles);
    } else {
      if (validateFile(droppedFiles[0])) {
        onFilesAccepted([droppedFiles[0]]);
      }
    }
  }, [validateFile, onFilesAccepted, onError, multipleFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onError(''); 
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (multipleFiles) {
      const validFiles: File[] = [];
      for (const file of selectedFiles) {
        if (!validateFile(file)) { // Stop if any file is invalid
          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input on error
          return; 
        }
        validFiles.push(file);
      }
      if (validFiles.length > 0) onFilesAccepted(validFiles);
    } else {
      if (validateFile(selectedFiles[0])) {
        onFilesAccepted([selectedFiles[0]]);
      } else {
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input on error
      }
    }
    // Reset file input for all cases if not reset above, to allow re-selection of same file(s)
    if (e.target.files && e.target.value) { // Only reset if a value was actually set
        e.target.value = '';
    }
  }, [validateFile, onFilesAccepted, onError, multipleFiles]);

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
