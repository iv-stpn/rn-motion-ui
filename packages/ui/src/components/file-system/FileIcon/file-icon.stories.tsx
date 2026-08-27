import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { ControlCard, Note, Playground, Sample, Section, Variants } from '../../../__stories__/story-harness';
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
const BRAND_FILES = [
  'report.pdf',
  'notes.docx',
  'budget.xlsx',
  'slides.pptx',
  'notebook.one',
  'animation.swf',
  'artwork.ai',
  'clip.mp4',
] as const;
const MORE_FILES = ['data.sql', 'font.ttf', 'program.exe', 'cert.pem', 'app.apk', 'model.blend', 'lib.so', 'backup.dmg'] as const;
const LABEL_SIZES = [16, 24, 32, 40, 48, 64, 96] as const;
const LABEL_FILES = ['index.ts', 'notes.txt', 'photo.png', 'schema.graphql', 'run.command', 'report.pdf'] as const;

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

      <Section title="Brand logos">
        <Variants align="center">
          {BRAND_FILES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <FileTypeIcon {...args} fileName={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="More types">
        <Variants align="center">
          {MORE_FILES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <FileTypeIcon {...args} fileName={name} />
            </Sample>
          ))}
        </Variants>
      </Section>

      <Section title="Extension label">
        <Note>
          The extension is printed on the page under the badge, the way macOS prints it — and left off below about 40px, where it
          would be a gray smudge rather than a word. Brand logos have no page to print it on, so the PDF keeps its own mark.
        </Note>
        <Variants align="center">
          {LABEL_SIZES.map((size) => (
            <Sample align="center" key={size} label={`${size}px`}>
              <FileTypeIcon {...args} fileName="index.ts" size={size} />
            </Sample>
          ))}
        </Variants>
        <Variants align="center">
          {LABEL_FILES.map((name) => (
            <Sample align="center" key={name} label={name}>
              <FileTypeIcon {...args} fileName={name} size={64} />
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

      <Section title="Folder contents">
        <Variants align="center">
          {(['empty', 'filled'] as const).map((variant) => (
            <Sample align="center" key={variant} label={variant}>
              <FileSystemFolderGlyph size={64} variant={variant} />
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
