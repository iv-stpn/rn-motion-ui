import type { Meta, StoryObj } from '@storybook/react';
import { type ReactNode, useCallback, useState } from 'react';
import { View } from 'react-native';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { TriggerButton } from '../../../../__stories__/story-trigger';
import { MotiView } from '../../../../moti/components/view';
import { AnimatePresence } from '../../../../moti/presence/animate-presence';
import { Button } from '../../../buttons/Button/button';
import { Text } from '../../../typography/Text/text';
import { OverlayShell } from '../overlay-shell';

const meta = {
  title: 'Menus/OverlayShell',
  component: OverlayShell,
  parameters: { layout: 'centered' },
  args: { open: false, onClose: fn(), children: () => null },
} satisfies Meta<typeof OverlayShell>;

type Story = StoryObj<typeof meta>;

const OPEN_MENU = 'Open folder menu';
const MENU_TITLE = 'Folder actions';
const STOP_SYNCING = 'Stop syncing';
const CONFIRM_TITLE = 'Stop syncing?';
const CONFIRM_LABEL = 'Confirm stop syncing';
const CONFIRM_TEST_ID = 'sync-remove-confirm-confirm';
const HINT = 'Nothing has happened yet.';
const REMOVED = 'The folder was removed.';

// Long enough that the menu is still exiting when the dialog registers, short
// enough to keep the test quick. This is the window the reported bug lived in.
const MENU_EXIT_MS = 120;

type PanelProps = { children: ReactNode };

/** The scrim + panel shape every overlay in the library renders. */
function Panel({ children }: PanelProps) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      exitTransition={{ type: 'timing', duration: MENU_EXIT_MS }}
      className="absolute inset-0 items-center justify-center bg-black/40"
    >
      <View className="gap-2 rounded-xl bg-surface-3 p-4">{children}</View>
    </MotiView>
  );
}

/**
 * The shape the app uses (its `device-sync-section.tsx`): a folder row menu whose
 * "stop syncing" row closes the menu **and** raises the confirm dialog in the same
 * tick, so the menu's exit animation is still running when the dialog registers as
 * a guest inside the Modal the menu owns.
 */
function MenuThenConfirmDemo() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removed, setRemoved] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  // Both updates in one tick — the ordering that unmounted the Modal.
  const stopSyncing = useCallback(() => {
    setMenuOpen(false);
    setConfirmOpen(true);
  }, []);

  const confirm = useCallback(() => {
    setRemoved(true);
    setConfirmOpen(false);
  }, []);

  const status = removed ? REMOVED : HINT;

  return (
    <View className="items-center gap-3">
      <TriggerButton label={OPEN_MENU} onPress={openMenu} />
      <Text className="text-muted-foreground text-xs">{status}</Text>

      <OverlayShell open={menuOpen} onClose={closeMenu} accessibilityLabel={MENU_TITLE}>
        {({ open, onExitComplete }) => (
          <AnimatePresence onExitComplete={onExitComplete}>
            {open ? (
              <Panel key="menu">
                <Text>{MENU_TITLE}</Text>
                <Button variant="neutral" size="sm" onPress={stopSyncing}>
                  {STOP_SYNCING}
                </Button>
              </Panel>
            ) : null}
          </AnimatePresence>
        )}
      </OverlayShell>

      <OverlayShell open={confirmOpen} onClose={closeConfirm} accessibilityLabel={CONFIRM_TITLE}>
        {({ open, onExitComplete }) => (
          <AnimatePresence onExitComplete={onExitComplete}>
            {open ? (
              <Panel key="confirm">
                <Text>{CONFIRM_TITLE}</Text>
                <Button variant="primary" size="sm" onPress={confirm} testID={CONFIRM_TEST_ID}>
                  {CONFIRM_LABEL}
                </Button>
              </Panel>
            ) : null}
          </AnimatePresence>
        )}
      </OverlayShell>
    </View>
  );
}

export default meta;

export const Default: Story = {
  render: () => <MenuThenConfirmDemo />,
};

export const MenuClosingUnderAConfirmDialog: Story = {
  name: 'Demo: Confirm survives the menu closing underneath it',
  render: () => <MenuThenConfirmDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The menu opens on an empty stack, so it owns the single Modal.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_MENU }));
    await expect(await screen.findByText(MENU_TITLE)).toBeTruthy();

    // "Stop syncing": the menu starts exiting and the dialog registers in the same
    // tick → the dialog is a guest drawn inside the menu's Modal.
    await userEvent.click(await screen.findByRole('button', { name: STOP_SYNCING }));
    await expect(await screen.findByText(CONFIRM_TITLE)).toBeTruthy();

    // Wait for the menu's exit to actually finish — that is the moment the menu
    // used to deregister, which unmounted the Modal it owned and took the dialog
    // with it. Then give React a beat to commit whatever that triggered.
    await waitFor(() => expect(screen.queryByText(MENU_TITLE)).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 250));

    // The regression: the dialog must still be on screen, inside a Modal that
    // outlived the menu's own content.
    await expect(screen.queryByText(CONFIRM_TITLE)).toBeTruthy();

    // …and reachable, not merely painted. The host layer keeps a full-bleed node
    // behind the dialog; probe the button's own centre so a regression reports the
    // layer that swallowed the tap instead of passing on a synthetic click.
    const confirmButton = await screen.findByTestId(CONFIRM_TEST_ID);
    const rect = confirmButton.getBoundingClientRect();
    const topmost = canvasElement.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await expect(topmost !== null && confirmButton.contains(topmost)).toBe(true);

    // Confirming must still reach its handler — a confirm dialog's promise is only
    // settled by its own buttons, so a dropped Modal would hang its caller as well
    // as losing the dialog.
    await userEvent.click(confirmButton);
    await waitFor(() => expect(screen.queryByText(CONFIRM_TITLE)).toBeNull());
    await expect(await screen.findByText(REMOVED)).toBeTruthy();
  },
};
