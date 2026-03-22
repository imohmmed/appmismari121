type Handler = (categoryId: number) => void;

let _handler: Handler | null = null;

export function registerOpenCategoryHandler(fn: Handler) {
  _handler = fn;
  return () => { _handler = null; };
}

export function emitOpenCategory(categoryId: number) {
  _handler?.(categoryId);
}
