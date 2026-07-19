import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from '../Button/button';
import { FullSheet } from './full-sheet';

const meta = {
  title: 'Components/FullSheet',
  component: FullSheet,
  parameters: { layout: 'centered' },
  // visible and children are managed by each story's render fn; stubs satisfy the type checker
  args: { visible: false, onClose: () => undefined, children: null },
} satisfies Meta<typeof FullSheet>;

type Story = StoryObj<typeof meta>;

const BODY_TEXT =
  'This full-screen sheet slides up from the bottom. It supports a title, subtitle, close button, scrollable content, compact padding, and a back-button mode.';

const OPEN_SHEET_LABEL = 'Open sheet';
const OPEN_COMPACT_LABEL = 'Open compact sheet';
const OPEN_BACK_BUTTON_LABEL = 'Open back-button sheet';
const OPEN_CUSTOM_LABEL = 'Open custom layout';
const OPEN_LOCKED_LABEL = 'Open locked sheet';
const CLOSE_LABEL = 'Close';
const FORCE_CLOSE_LABEL = 'Force close';
const BACK_BUTTON_BODY = 'The back arrow appears at top-left. The caller owns the content layout.';
const CUSTOM_LAYOUT_TITLE = 'Custom Layout';
const CUSTOM_LAYOUT_BODY = 'No header, no padding — caller owns every pixel.';
const LOCKED_BODY = 'Close button and back gesture are disabled. Programmatically close when done.';
const COMPACT_BODY = 'Compact padding variant.';

export default meta;

/** Standard sheet with title and close button. */
export const WithHeader: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_SHEET_LABEL}</Button>
        <FullSheet visible={visible} onClose={handleClose} title="Settings" subtitle="Manage your preferences" showClose={true}>
          <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BODY_TEXT}</Text>
        </FullSheet>
      </View>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the sheet.
    await userEvent.click(await canvas.findByRole('button', { name: OPEN_SHEET_LABEL }));
    // Sheet content mounts inside a Modal — use screen to query outside the canvas.
    await expect(await screen.findByText('Settings')).toBeTruthy();
    // Close via the X button (accessibilityLabel="Close" → aria-label="Close").
    await userEvent.click(await screen.findByLabelText('Close'));
  },
};

/** Title + subtitle, compact padding. */
export const Compact: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_COMPACT_LABEL}</Button>
        <FullSheet visible={visible} onClose={handleClose} title="Quick Edit" showClose={true} compact={true}>
          <Text style={{ color: '#6b7280' }}>{COMPACT_BODY}</Text>
        </FullSheet>
      </View>
    );
  },
};

/** `mode="back-button"` — back arrow at top-left, caller owns content layout. */
export const BackButtonMode: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_BACK_BUTTON_LABEL}</Button>
        <FullSheet visible={visible} onClose={handleClose} title="Detail View" mode="back-button">
          <View style={{ flex: 1, padding: 24 }}>
            <Text style={{ color: '#6b7280', lineHeight: 22 }}>{BACK_BUTTON_BODY}</Text>
          </View>
        </FullSheet>
      </View>
    );
  },
};

/** `customLayout` — no header or padding, caller owns everything. */
export const CustomLayout: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_CUSTOM_LABEL}</Button>
        <FullSheet visible={visible} onClose={handleClose} customLayout={true}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
            <Text style={{ fontWeight: '700', fontSize: 24 }}>{CUSTOM_LAYOUT_TITLE}</Text>
            <Text style={{ color: '#6b7280', textAlign: 'center' }}>{CUSTOM_LAYOUT_BODY}</Text>
            <Button variant="secondary" onPress={handleClose}>
              {CLOSE_LABEL}
            </Button>
          </View>
        </FullSheet>
      </View>
    );
  },
};

/** `dismissable={false}` — no close button, back gesture disabled. */
export const NonDismissable: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const handleOpen = useCallback(() => setVisible(true), []);
    const handleClose = useCallback(() => setVisible(false), []);
    return (
      <View>
        <Button onPress={handleOpen}>{OPEN_LOCKED_LABEL}</Button>
        <FullSheet visible={visible} onClose={handleClose} title="Processing…" showClose={true} dismissable={false}>
          <Text style={{ color: '#6b7280' }}>{LOCKED_BODY}</Text>
          <Button variant="secondary" onPress={handleClose} style={{ marginTop: 16 }}>
            {FORCE_CLOSE_LABEL}
          </Button>
        </FullSheet>
      </View>
    );
  },
};
