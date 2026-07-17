import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FileUpload, type FileUploadItem } from './file-upload';

// -- Shared story data -------------------------------------------------------

const storyItems: FileUploadItem[] = [
  {
    id: 'brand-assets',
    name: 'brand-assets.zip',
    size: 18_400_000,
    type: 'application/zip',
    progress: 100,
    status: 'success',
  },
  {
    id: 'release-video',
    name: 'release-cut.mov',
    size: 84_200_000,
    type: 'video/quicktime',
    progress: 58,
    status: 'uploading',
  },
  {
    id: 'contracts',
    name: 'vendor-contract.pdf',
    size: 2_800_000,
    type: 'application/pdf',
    progress: 32,
    status: 'error',
    error: 'Connection lost',
  },
];

// -- Meta --------------------------------------------------------------------

const meta = {
  title: 'Components/FileUpload',
  component: FileUpload,
  parameters: { layout: 'padded' },
  args: {
    value: storyItems,
    variant: 'centered',
    onValueChange: fn(),
    onFilesAdded: fn(),
    onRemove: fn(),
    onRetry: fn(),
    title: 'Drop files to upload',
    description: 'PDF, images, video or zipped assets',
    browseLabel: 'Browse',
  },
} satisfies Meta<typeof FileUpload>;

type Story = StoryObj<typeof meta>;
export default meta;

// -- Stories -----------------------------------------------------------------

/**
 * Default: centered variant with 3 pre-populated items
 * (1 success, 1 uploading at 58%, 1 error).
 * Verifies error item shows retry button; presses remove on success item.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // 1. Error item (vendor-contract.pdf) should have a retry button.
    const retryBtn = await canvas.findByRole('button', { name: 'Retry vendor-contract.pdf' });
    await expect(retryBtn).toBeTruthy();

    // 2. All three items render (by file name text).
    await expect(await canvas.findByText('brand-assets.zip')).toBeTruthy();
    await expect(await canvas.findByText('release-cut.mov')).toBeTruthy();
    await expect(await canvas.findByText('vendor-contract.pdf')).toBeTruthy();

    // 3. Press remove on the success item (brand-assets.zip).
    const removeBtn = await canvas.findByRole('button', { name: 'Remove brand-assets.zip' });
    await userEvent.click(removeBtn);
    await new Promise((r) => setTimeout(r, 50));
    await expect(args.onRemove).toHaveBeenCalled();
  },
};

/**
 * RowVariant: "default" (row) layout, same items.
 */
export const RowVariant: Story = {
  args: { variant: 'default' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify items still render in row variant.
    await expect(await canvas.findByText('brand-assets.zip')).toBeTruthy();
    await expect(await canvas.findByText('release-cut.mov')).toBeTruthy();

    // Error item retry should still be accessible.
    const retryBtn = await canvas.findByRole('button', { name: 'Retry vendor-contract.pdf' });
    await expect(retryBtn).toBeTruthy();
  },
};
