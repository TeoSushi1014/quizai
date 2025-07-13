import React, { useEffect, useState } from 'react';
import { BookIcon, CheckMarkIcon, PointerIcon } from '../constants';

interface TodoListProps {
  className?: string;
}

const TodoList: React.FC<TodoListProps> = ({ className = '' }) => {
  const [todoContent, setTodoContent] = useState<string>('');

  useEffect(() => {
    // Fetch the todo.md file
    fetch('/todo.md')
      .then(response => response.text())
      .then(content => setTodoContent(content))
      .catch(error => console.error('Error fetching todo.md:', error));
  }, []);

  const renderContent = (content: string) => {
    // Replace icon references with actual SVG components
    const lines = content.split('\n');
    
    return lines.map((line, index) => {
      // Replace [BookIcon] with BookIcon component
      if (line.includes('[BookIcon]')) {
        return (
          <h2 key={index} className="flex items-center gap-2 text-lg font-bold mb-3">
            <BookIcon className="w-5 h-5 text-blue-600" />
            {line.replace('[BookIcon]', '')}
          </h2>
        );
      }
      
      // Replace [CheckMarkIcon] with CheckMarkIcon component
      if (line.includes('[CheckMarkIcon]')) {
        return (
          <p key={index} className="flex items-center gap-2 mb-1">
            <CheckMarkIcon className="w-5 h-5 text-green-600" />
            {line.replace('[CheckMarkIcon]', '')}
          </p>
        );
      }
      
      // Replace [PointerIcon] with PointerIcon component
      if (line.includes('[PointerIcon]')) {
        return (
          <p key={index} className="flex items-start gap-2 ml-5 mb-1">
            <PointerIcon className="w-4 h-4 mt-1 text-blue-600" />
            {line.replace('[PointerIcon]', '')}
          </p>
        );
      }
      
      // Return regular lines with proper indentation
      return (
        <p key={index} className={`${line.startsWith(' ') ? 'ml-5' : ''} mb-1`}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className={`todo-list ${className}`}>
      {todoContent ? (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          {renderContent(todoContent)}
        </div>
      ) : (
        <p>Loading todo list...</p>
      )}
    </div>
  );
};

export default TodoList; 