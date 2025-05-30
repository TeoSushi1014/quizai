import React from 'react';

const QuizCardSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-800 shadow-lg rounded-2xl p-0 overflow-hidden h-full"> {/* Full height within its container */}
      <div className="p-4 sm:p-6 pb-4 animate-pulse">
        {/* Title */}
        <div className="h-5 bg-slate-700 rounded w-3/4 mb-3"></div>
        <div className="h-5 bg-slate-700 rounded w-1/2 mb-4 sm:mb-5"></div>

        {/* Info: Questions count, difficulty, language */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="h-4 bg-slate-700 rounded w-20"></div>
          <div className="h-4 bg-slate-700 rounded w-24"></div>
          <div className="h-4 bg-slate-700 rounded w-12"></div>
        </div>

        {/* Source Snippet */}
        <div className="h-3 bg-slate-700 rounded w-full mb-2"></div>

        {/* Date */}
        <div className="h-3 bg-slate-700 rounded w-1/3"></div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-slate-700/50 p-3 sm:p-4 bg-slate-800/30 animate-pulse mt-auto"> {/* Added mt-auto to push footer down */}
        <div className="flex gap-2.5 mb-2.5"> {/* Row 1 for buttons */}
          <div className="h-10 bg-slate-700 rounded flex-grow"></div>
          <div className="h-10 bg-slate-700 rounded flex-grow"></div>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-2 justify-between"> {/* Row 2 for icon buttons */}
          <div className="flex items-center gap-x-2">
            <div className="h-8 w-8 bg-slate-700 rounded-lg"></div>
            <div className="h-8 w-8 bg-slate-700 rounded-lg"></div>
          </div>
          <div className="flex items-center gap-x-2">
            <div className="h-8 w-8 bg-slate-700 rounded-lg"></div>
            <div className="h-8 w-8 bg-slate-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
QuizCardSkeleton.displayName = "QuizCardSkeleton";
export default QuizCardSkeleton;
