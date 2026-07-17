import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Calendar, GitBranch, Home, Mail, Music, Settings, Sparkles } from '../../lib/icons';
import { Dock, DockItem, DockSeparator } from './dock';

const meta = {
  title: 'Components/Dock',
  component: Dock,
  parameters: { layout: 'centered' },
  args: { children: null, size: 44 },
  argTypes: {
    size: { control: { type: 'number' } },
  },
} satisfies Meta<typeof Dock>;

type Story = StoryObj<typeof meta>;

const ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'mail', icon: Mail, label: 'Mail' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'music', icon: Music, label: 'Music' },
  { id: 'discover', icon: Sparkles, label: 'Discover' },
] as const;

// biome-ignore lint/style/useComponentExportOnlyModules: story helper
function DockDemo({ onSelect }: { onSelect?: (id: string) => void }) {
  const [active, setActive] = useState('home');
  const selectSettings = useCallback(() => {
    setActive('settings');
    onSelect?.('settings');
  }, [onSelect]);
  return (
    <Dock>
      {ITEMS.map(({ id, icon: Icon, label }) => (
        <DockItem
          key={id}
          accessibilityLabel={label}
          active={active === id}
          // biome-ignore lint/performance/noJsxPropsBind: story demo handler
          onPress={() => {
            setActive(id);
            onSelect?.(id);
          }}
        >
          <Icon size={20} color="#111111" />
        </DockItem>
      ))}
      <DockSeparator />
      <DockItem accessibilityLabel="Settings" active={active === 'settings'} onPress={selectSettings}>
        <Settings size={20} color="#111111" />
      </DockItem>
      <DockItem accessibilityLabel="Repository">
        <GitBranch size={20} color="#111111" />
      </DockItem>
    </Dock>
  );
}

export default meta;

export const Default: Story = {
  render: () => <DockDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mail = await canvas.findByLabelText('Mail');
    await userEvent.click(mail);
    await expect(mail).toHaveAttribute('aria-selected', 'true');
  },
};

export const WithCallback: Story = {
  args: { children: null },
  render: () => <DockDemo onSelect={fn()} />,
};
