#!/usr/bin/env node
/**
 * migrate-icons.mjs
 * Rewrites every import from '…/lib/icons' in packages/ui/src to the new
 * per-icon subpaths from rn-motion-ui-icons.
 *
 * Icons are imported with their original Lucide name as a local alias so
 * that JSX bodies are unchanged:
 *   import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line'
 *
 * `type IconProps` becomes a separate type import from icon-props.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiSrc = resolve(__dirname, '../src');

// ---------------------------------------------------------------------------
// Lucide name → { path: subpath in rn-motion-ui-icons, name: PascalCase }
// ---------------------------------------------------------------------------
const MAP = {
  AlertCircle:   { path: 'icons/information-line',   name: 'InformationLine' },
  AlertTriangle: { path: 'icons/alert-line',          name: 'AlertLine' },
  ArrowLeft:     { path: 'icons/arrow-left-line',     name: 'ArrowLeftLine' },
  ArrowRight:    { path: 'icons/arrow-right-line',    name: 'ArrowRightLine' },
  ArrowUp:       { path: 'icons/arrow-up-line',       name: 'ArrowUpLine' },
  Ban:           { path: 'icons/forbid-circle-line',  name: 'ForbidCircleLine' },
  Bell:          { path: 'icons/notification-line',   name: 'NotificationLine' },
  Calendar:      { path: 'icons/calendar-line',       name: 'CalendarLine' },
  CalendarClock: { path: 'icons/time-line',           name: 'TimeLine' },
  Check:         { path: 'icons/check-line',          name: 'CheckLine' },
  ChevronDown:   { path: 'icons/down-line',           name: 'DownLine' },
  ChevronLeft:   { path: 'icons/left-line',           name: 'LeftLine' },
  ChevronRight:  { path: 'icons/right-line',          name: 'RightLine' },
  ChevronUp:     { path: 'icons/up-line',             name: 'UpLine' },
  Circle:        { path: 'icons/round-line',          name: 'RoundLine' },
  Clock3:        { path: 'icons/clock-line',          name: 'ClockLine' },
  Columns3:      { path: 'icons/columns-3-line',      name: 'Columns3Line' },
  Copy:          { path: 'icons/copy-line',           name: 'CopyLine' },
  Download:      { path: 'icons/download-line',       name: 'DownloadLine' },
  Eye:           { path: 'icons/eye-line',            name: 'EyeLine' },
  EyeOff:        { path: 'icons/eye-close-line',      name: 'EyeCloseLine' },
  FileText:      { path: 'icons/file-line',           name: 'FileLine' },
  FolderClosed:  { path: 'icons/folder-line',         name: 'FolderLine' },
  FolderKanban:  { path: 'icons/folder-line',         name: 'FolderLine' },
  GitBranch:     { path: 'icons/git-branch-line',     name: 'GitBranchLine' },
  GripVertical:  { path: 'icons/dots-vertical-line',  name: 'DotsVerticalLine' },
  Heart:         { path: 'icons/heart-line',          name: 'HeartLine' },
  Home:          { path: 'icons/home-2-line',         name: 'Home2Line' },
  Images:        { path: 'icons/pic-line',            name: 'PicLine' },
  Info:          { path: 'icons/information-line',    name: 'InformationLine' },
  LayoutGrid:    { path: 'icons/layout-grid-line',    name: 'LayoutGridLine' },
  Link:          { path: 'icons/link-line',           name: 'LinkLine' },
  LoaderCircle:  { path: 'icons/loading-line',        name: 'LoadingLine' },
  Lock:          { path: 'icons/lock-line',           name: 'LockLine' },
  Mail:          { path: 'icons/mail-line',           name: 'MailLine' },
  MessageCircle: { path: 'icons/chat-1-line',         name: 'Chat1Line' },
  MessageSquare: { path: 'icons/message-1-line',      name: 'Message1Line' },
  Moon:          { path: 'icons/moon-line',           name: 'MoonLine' },
  MoreHorizontal:{ path: 'icons/more-1-line',         name: 'More1Line' },
  Music:         { path: 'icons/music-line',          name: 'MusicLine' },
  PackageCheck:  { path: 'icons/package-line',        name: 'PackageLine' },
  Pencil:        { path: 'icons/pencil-line',         name: 'PencilLine' },
  Phone:         { path: 'icons/phone-line',          name: 'PhoneLine' },
  PhoneOff:      { path: 'icons/phone-off-line',      name: 'PhoneOffLine' },
  Pin:           { path: 'icons/pin-line',            name: 'PinLine' },
  Plus:          { path: 'icons/add-line',            name: 'AddLine' },
  RadioTower:    { path: 'icons/radio-line',          name: 'RadioLine' },
  ScanFace:      { path: 'icons/faceid-line',         name: 'FaceidLine' },
  ScrollText:    { path: 'icons/file-line',           name: 'FileLine' },
  Search:        { path: 'icons/search-line',         name: 'SearchLine' },
  Send:          { path: 'icons/send-plane-line',     name: 'SendPlaneLine' },
  Settings:      { path: 'icons/settings-1-line',     name: 'Settings1Line' },
  Share:         { path: 'icons/share-2-line',        name: 'Share2Line' },
  Share2:        { path: 'icons/share-forward-line',  name: 'ShareForwardLine' },
  ShieldCheck:   { path: 'icons/shield-line',         name: 'ShieldLine' },
  Sparkles:      { path: 'icons/sparkles-line',       name: 'SparklesLine' },
  Sun:           { path: 'icons/sun-line',            name: 'SunLine' },
  Table:         { path: 'icons/table-line',          name: 'TableLine' },
  Timer:         { path: 'icons/time-duration-line',  name: 'TimeDurationLine' },
  Trash2:        { path: 'icons/delete-2-line',       name: 'Delete2Line' },
  User:          { path: 'icons/user-2-line',         name: 'User2Line' },
  X:             { path: 'icons/close-line',          name: 'CloseLine' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a (possibly multi-line) import specifier list.
 * Returns { typeOnly: boolean, specifiers: string[] } where each specifier
 * is a raw token like "Check", "type IconProps", "Search as SearchIcon".
 */
function parseImportSpecifiers(raw) {
  // Collapse multi-line into single, strip { }
  const inner = raw.replace(/\s+/g, ' ').replace(/^\s*\{/, '').replace(/\}\s*$/, '').trim();
  return inner.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * For each raw specifier token, return the original local name used in code
 * and whether it was type-only.
 */
function parseSpecifier(token) {
  // e.g. "type IconProps" | "Search" | "Search as SearchIcon" | "type { IconProps }"
  let isType = false;
  let tok = token.trim();
  if (tok.startsWith('type ')) { isType = true; tok = tok.slice(5).trim(); }
  // strip stray braces that may appear in "type { Foo }"
  tok = tok.replace(/^\{/, '').replace(/\}$/, '').trim();
  const asParts = tok.split(/\s+as\s+/);
  const importedName = asParts[0].trim();   // the name as exported by the module
  const localName    = asParts[1]?.trim() ?? importedName; // alias if any
  return { isType, importedName, localName };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Collect files to migrate
const raw = execSync(
  `grep -rl 'from.*lib/icons' "${uiSrc}" --include='*.ts' --include='*.tsx'`,
  { encoding: 'utf8' }
);
const files = raw.trim().split('\n').filter(Boolean);

console.log(`Migrating ${files.length} files…`);

let changed = 0;
const unmapped = new Set();

for (const filePath of files) {
  let src = readFileSync(filePath, 'utf8');

  // Match the full import statement (possibly spanning multiple lines)
  // Handles: import { ... } from '...lib/icons';
  const importRe = /^import\s+\{([^}]*)\}\s+from\s+['"][^'"]*lib\/icons['"]\s*;?\s*$/m;
  // Also handle multiline: import {\n  Foo,\n  Bar\n} from '…'
  const multilineRe = /import\s+\{([^}]*)\}\s+from\s+['"][^'"]*lib\/icons['"]\s*;?/;

  const match = src.match(multilineRe);
  if (!match) continue;

  const specifierTokens = parseImportSpecifiers(match[1]);
  const specifiers = specifierTokens.map(parseSpecifier);

  const newLines = [];

  // 1. type IconProps → from rn-motion-ui-icons/icon-props
  const hasTypeIconProps = specifiers.some(s => s.isType && s.importedName === 'IconProps');
  const hasValueIconProps = specifiers.some(s => !s.isType && s.importedName === 'IconProps');
  if (hasTypeIconProps || hasValueIconProps) {
    newLines.push(`import type { IconProps } from 'rn-motion-ui-icons/icon-props';`);
  }

  // 2. Value icon imports — one line per icon, using alias to preserve local name
  // Group by MingCute subpath in case two Lucide icons map to the same file
  const byPath = new Map(); // mingcutePath → [{ mingcuteName, localName }]
  for (const spec of specifiers) {
    if (spec.isType && spec.importedName === 'IconProps') continue;
    if (spec.importedName === 'IconProps') continue; // handled above

    const mapping = MAP[spec.importedName];
    if (!mapping) {
      unmapped.add(spec.importedName);
      // Keep as-is with a comment so the author notices
      newLines.push(`// TODO: no MingCute mapping for '${spec.importedName}' — replace manually`);
      continue;
    }

    const entry = byPath.get(mapping.path) ?? [];
    // If the local name already equals the MingCute name, no alias needed
    const alias = spec.localName !== mapping.name ? ` as ${spec.localName}` : '';
    entry.push(`${mapping.name}${alias}`);
    byPath.set(mapping.path, entry);
  }

  for (const [subpath, names] of byPath) {
    // Deduplicate (FolderClosed + FolderKanban both map to FolderLine)
    const unique = [...new Set(names)];
    newLines.push(`import { ${unique.join(', ')} } from 'rn-motion-ui-icons/${subpath}';`);
  }

  if (newLines.length === 0) continue;

  src = src.replace(match[0], newLines.join('\n'));
  writeFileSync(filePath, src, 'utf8');
  changed++;
  console.log(`  ✓ ${filePath.replace(uiSrc + '/', '')}`);
}

console.log(`\nDone. ${changed} files updated.`);
if (unmapped.size > 0) {
  console.log(`\n⚠ Unmapped Lucide names (need manual attention):`);
  for (const n of [...unmapped].sort()) console.log(`    ${n}`);
}

