export function stripTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

export function getPathParts(currentPath: string): string[] {
  const path = stripTrailingSlash(currentPath);
  return path.split('/');
}
