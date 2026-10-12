export function stripTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

export function getPathParts(currentPath: string): string[] {
  const path = stripTrailingSlash(currentPath);
  return path.split('/');
}

/** Lowercased file extension, independent of any file browser. */
export function fileExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex === -1 ? '' : name.slice(dotIndex + 1).toLowerCase();
}
