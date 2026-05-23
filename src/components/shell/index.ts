// PROJ-4 — Public barrel for the chrome primitives.
// Future features (PROJ-5 / PROJ-6 / PROJ-8 / PROJ-19) import from
// `@/components/shell`.

export { AppShell, type AppShellProps, type AppShellUser } from './app-shell';
export {
  TopBarDesktop,
  buildBreadcrumbTabs,
  type BreadcrumbTab,
} from './top-bar-desktop';
export { TopBarMobile } from './top-bar-mobile';
export {
  AvatarPopover,
  AvatarPopoverContent,
  type AvatarPopoverProps,
  type AvatarPopoverUser,
} from './avatar-popover';
export { Avatar } from './avatar';
export { Wordmark } from './wordmark';
export { SysadminPill } from './sysadmin-pill';
export { Pill } from './pill';
export { Btn } from './btn';
export { IconBtn } from './icon-btn';
export { Icons, type IconName } from './icons';
export { EmptyOrErrorState } from './empty-or-error-state';
export { deriveInitials, cgAvatarHue } from './avatar-initials';
export {
  TopBarSlotsProvider,
  useTopBarSlots,
  useRegisterTopBarSlots,
  type TopBarSlots,
} from './top-bar-slots';
