// A utility function to filter out unnecessary question links in HTML content
// This is for links like <a href="#cu-hi-1">Câu hỏi 1</a> that we want to remove

/**
 * Filters out unnecessary links from HTML content
 * 
 * @param {HTMLElement} element - The DOM element to scan for links to remove
 */
export function removeUnnecessaryLinks(element) {
  if (!element || typeof window === 'undefined') return;
  
  // Find all links that match our pattern
  const unnecessaryLinks = element.querySelectorAll('a[href^="#cu-hi"]');
  
  // Also find links that contain "Câu hỏi" text
  const allLinks = element.querySelectorAll('a');
  const questionLinks = Array.from(allLinks).filter(link => {
    return link.textContent && link.textContent.trim().match(/^Câu hỏi \d+$/);
  });
  
  // Remove all unnecessary links
  [...unnecessaryLinks, ...questionLinks].forEach(link => {
    link.parentNode?.removeChild(link);
  });
}

/**
 * React hook to remove unnecessary links from a container
 * 
 * @param {React.RefObject} containerRef - Reference to the container element
 */
export function useRemoveUnnecessaryLinks(containerRef) {
  React.useEffect(() => {
    if (containerRef.current) {
      removeUnnecessaryLinks(containerRef.current);
    }
  }, [containerRef]);
}
