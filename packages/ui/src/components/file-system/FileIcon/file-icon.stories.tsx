import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { ControlCard, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
import { Text } from '../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-icons';

const meta = {
  title: 'File System/FileIcon',
  component: FileTypeIcon,
  parameters: { layout: 'centered' },
  args: { fileName: 'index.ts', size: 20 },
} satisfies Meta<typeof FileTypeIcon>;

type Story = StoryObj<typeof meta>;

const CODE_FILES = ['index.ts', 'app.tsx', 'main.py', 'styles.css', 'config.json', 'query.graphql'] as const;
const MEDIA_FILES = ['photo.png', 'clip.mp4', 'track.mp3', 'archive.zip'] as const;
const DOC_FILES = ['readme.md', 'report.pdf', 'data.csv', 'notes.txt'] as const;

function FileIconPlayground(args: React.ComponentProps<typeof FileTypeIcon>) {
  return (
    <Playground>
      <ControlCard title="Preview">
        <View className="flex-row items-center gap-3">
          <FileTypeIcon {...args} />
          <Text className="text-secondary text-sm">{args.fileName}</Text>
        </View>
      </ControlCard>

      <Section title="Code">
        <Variants align="center">
          {CODE_FILES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <FileTypeIcon {...args} fileName={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Media & Archives">
        <Variants align="center">
          {MEDIA_FILES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <FileTypeIcon {...args} fileName={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Documents">
        <Variants align="center">
          {DOC_FILES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <FileTypeIcon {...args} fileName={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Folder glyph">
        <Variants align="center">
          {([32, 48, 64, 96] as const).map((size) => (
            <Sample align="center" key={size} label={`${size}px`}>
              <FileSystemFolderGlyph size={size} />
            </Sample>
          ))}
        </Variants>
      </Section>
    </Playground>
  );
}

export default meta;

/** Colour-resolved icons for a range of file types, plus the folder glyph at several sizes. */
export const Interactive: Story = { render: (args) => <FileIconPlayground {...args} /> };
