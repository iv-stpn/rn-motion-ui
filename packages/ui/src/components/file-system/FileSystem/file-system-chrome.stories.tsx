import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { expect, waitFor, within } from 'storybook/test';
import { FILE_SYSTEM_DECORATORS } from './__stories__/file-system-story-meta';
import { FileSystem } from './file-system';

const meta = {
  title: 'File System/FileSystem',
  component: FileSystem,
  decorators: FILE_SYSTEM_DECORATORS,
  args: {
    height: 360,
    testID: 'chrome-browser',
    defaultView: 'list',
    headerClassName: 'mt-12',
    items: Array.from({ length: 60 }, (_, index) => ({ kind: 'folder' as const, path: `Folder ${index}/` })),
  },
} satisfies Meta<typeof FileSystem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScrollFromChrome: Story = {
  render: (args) => (
    <View className="bg-surface-2">
      <FileSystem {...args} />
    </View>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = await canvas.findByTestId('chrome-browser');
    const header = await canvas.findByTestId('chrome-browser-header');
    const pane = [...root.querySelectorAll<HTMLElement>('*')].find((node) => getComputedStyle(node).overflowY === 'auto');
    if (!pane) throw new Error('Missing file scroll pane');
    await waitFor(() => expect(pane.scrollHeight).toBeGreaterThan(pane.clientHeight));
    expect(getComputedStyle(root).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const wheel = (target: HTMLElement, deltaY: number, extra: WheelEventInit = {}) =>
      target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ...extra }));
    wheel(header, 120);
    await waitFor(() => expect(pane.scrollTop).toBe(120));
    wheel(root, 80);
    await waitFor(() => expect(pane.scrollTop).toBe(200));
    wheel(header, -40);
    await waitFor(() => expect(pane.scrollTop).toBe(160));
    // Zoom remains a browser gesture, and events inside the pane stay native.
    expect(wheel(header, 40, { ctrlKey: true })).toBe(true);
    expect(wheel(pane, 40)).toBe(true);
    expect(pane.scrollTop).toBe(160);
  },
};
