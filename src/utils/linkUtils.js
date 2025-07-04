export function removeUnnecessaryLinks(element) {
  if (!element || typeof window === 'undefined') return;
  const unnecessaryLinks = element.querySelectorAll('a[href^="#cu-hi"]');
  const allLinks = element.querySelectorAll('a');
  const questionLinks = Array.from(allLinks).filter(link => {
    return link.textContent && link.textContent.trim().match(/^Câu hỏi \d+$/);
  });
  [...unnecessaryLinks, ...questionLinks].forEach(link => {
    link.parentNode?.removeChild(link);
  });
}

export function useRemoveUnnecessaryLinks(containerRef) {
  React.useEffect(() => {
    if (containerRef.current) {
      removeUnnecessaryLinks(containerRef.current);
    }
  }, [containerRef]);
}
