export const DEBUG = (() => {
  let location = typeof window !== 'undefined' && window.location !== undefined;
  if (location && /[?&]glimmer_logging/.test(window.location.search)) {
    return true;
  }
  return false;
})();

export const DEVMODE = true;
