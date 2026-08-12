/**
 * Stories for `Draggable` — the grab half of the gesture system.
 *
 * These run under react-native-web, so what they pin is the web transport: a
 * genuine HTML5 drag. That is the half worth asserting hardest, because it is the
 * half that has to interoperate — one story below drops onto a bare
 * `dragover`/`drop` pair that has never heard of this library, which is exactly how
 * `<FileSystem onExternalDrop>` receives these drags.
 *
 * The pan transport (every touch drag, and every drag on native) has no browser to
 * run in. Its arithmetic is unit-tested in `../__tests__`, and the store both
 * transports publish to is read live by the `<Dragzone>` here, so the shared half
 * is covered from both ends.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { FileLine as FileText } from 'rn-motion-ui-icons/icons/file-line';
import { expect, userEvent, within } from 'storybook/test';
import { centerOf, dragNowhere, dragOnto, fireDrag, newDragTransfer } from '../../../__stories__/story-drag';
import { Action, Choice, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { Text } from '../../typography/Text/text';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragEndEvent, DraggableHandle } from '../drag.types';
import { Draggable, type DraggableTransports } from './draggable';

/** The format the chips write and the zone reads — one private MIME, as an app would. */
const MIME = 'application/x-story-item';

const CHIP_TEST_ID = 'story-draggable-chip';
const ZONE_TEST_ID = 'story-draggable-zone';
const BARE_TEST_ID = 'story-draggable-bare';
/** What the source learned at the release. */
const READOUT_TEST_ID = 'story-draggable-readout';
/** What the zone was handed. Separate, because one release writes both. */
const ZONE_READOUT_TEST_ID = 'story-draggable-zone-readout';
const HANDLE_TEST_ID = 'story-draggable-handle';

/** `dragging=false size=120×32` — what the handle answered, in one line. */
const HANDLE_READOUT = /^dragging=false size=\d+×\d+$/;

const ITEMS = ['invoice.pdf', 'photo.jpg', 'notes.txt'];

const TRANSPORTS: DraggableTransports[] = ['auto', 'html5', 'pan'];

const HINT = 'Drag a chip into the tray. On iOS and Android, hold a chip first — the pan arms after 300ms.';

type ChipProps = { label: string };

/** What gets dragged. A plain view — `Draggable` adds the grab, not the look. */
function Chip({ label }: ChipProps) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5">
      <FileText size={14} />
      <Text size="sm">{label}</Text>
    </View>
  );
}

type TrayProps = { disabled?: boolean; transports?: DraggableTransports };

/**
 * The demo: three chips over one zone, with a read-out for each end of the drag.
 *
 * Nothing wires the two together. The chips write a payload, the zone declares it
 * takes drags, and the store pairs them — no manager, no provider, no ids passed
 * between them.
 *
 * Two read-outs rather than one because both callbacks fire from the same release,
 * and a single line would only ever show whichever wrote last.
 */
function DragTray({ disabled = false, transports = 'auto' }: TrayProps) {
  const [received, setReceived] = useState('Nothing yet');
  const [outcome, setOutcome] = useState('Nothing yet');

  const handleEnd = useCallback((event: DragEndEvent) => {
    const name = event.transfer.getData(MIME);
    setOutcome(event.canceled ? `Canceled ${name}` : `Dropped ${name} (${event.dropEffect})`);
  }, []);

  return (
    <View className="w-[420px] max-w-full gap-3">
      <View className="flex-row flex-wrap gap-2">
        {ITEMS.map((label) => (
          <Draggable
            accessibilityLabel={label}
            accessibilityRole="button"
            data={{ [MIME]: label }}
            disabled={disabled}
            key={label}
            onDragEnd={handleEnd}
            testID={`${CHIP_TEST_ID}-${label}`}
            transports={transports}
          >
            <Chip label={label} />
          </Draggable>
        ))}
      </View>
      <Dragzone
        className="items-center justify-center rounded-lg border border-border border-dashed py-6"
        eligibleClassName="border-info"
        onDrop={({ transfer }) => setReceived(`Zone received ${transfer.getData(MIME)}`)}
        overClassName="border-info bg-info/10"
        testID={ZONE_TEST_ID}
      >
        {({ drag, isOver }) => (
          <Text className="text-muted-foreground" size="sm">
            {drag === null ? 'Drop here' : `${isOver ? 'Release to take' : 'Carrying'} ${drag.transfer.getData(MIME)}`}
          </Text>
        )}
      </Dragzone>
      <Note testID={ZONE_READOUT_TEST_ID}>{received}</Note>
      <Note testID={READOUT_TEST_ID}>{outcome}</Note>
      <Note>{HINT}</Note>
    </View>
  );
}

/** The tray plus the two knobs worth turning. */
function DragTrayPlayground() {
  const [disabled, setDisabled] = useState(false);
  const [transports, setTransports] = useState<DraggableTransports>('auto');

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
        <Choice label="Transports" onChange={setTransports} options={TRANSPORTS} value={transports} />
      </ControlCard>
      <DragTray disabled={disabled} transports={transports} />
    </Playground>
  );
}

/**
 * A drop target that has never heard of this library: a bare `dragover`/`drop`
 * pair on a DOM node.
 *
 * This is the half of the web transport worth asserting hardest, because it is the
 * half that has to interoperate. `<Draggable>` rides the browser's own drag rather
 * than synthesising one, so the payload crosses to any HTML5 listener — this zone,
 * `<FileSystem onExternalDrop>`, another window, the OS — with no adapter at all.
 *
 * Wired through the node because react-native-web renders `View` as a div but drops
 * unknown HTML attributes, so drag props passed as JSX reach nothing.
 */
function BareDropZone() {
  const ref = useRef<View | null>(null);
  const [status, setStatus] = useState('Nothing yet');
  const [outcome, setOutcome] = useState('Nothing yet');

  useMountEffect(() => {
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    function onDragOver(e: DragEvent) {
      e.preventDefault();
      // Claiming the drag. Without this the browser reports 'none' at dragend and
      // the source reads the whole thing as a cancel.
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'link';
      setStatus('Foreign listener: over');
    }
    function onDropped(e: DragEvent) {
      e.preventDefault();
      setStatus(`Foreign listener got ${e.dataTransfer?.getData(MIME)}`);
    }

    node.addEventListener('dragover', onDragOver, { passive: false });
    node.addEventListener('drop', onDropped);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('drop', onDropped);
    };
  });

  return (
    <View className="w-[420px] max-w-full gap-3">
      <Draggable
        accessibilityLabel="invoice.pdf"
        accessibilityRole="button"
        data={{ [MIME]: 'invoice.pdf' }}
        effectAllowed="all"
        onDragEnd={({ canceled, dropEffect }) => setOutcome(canceled ? 'Source: canceled' : `Source: dropped (${dropEffect})`)}
        testID={`${CHIP_TEST_ID}-invoice.pdf`}
      >
        <Chip label="invoice.pdf" />
      </Draggable>
      <View
        ref={ref}
        className="items-center justify-center rounded-lg border border-border border-dashed py-6"
        testID={BARE_TEST_ID}
      >
        <Text className="text-muted-foreground" size="sm">
          Plain DOM listener
        </Text>
      </View>
      <Note testID={ZONE_READOUT_TEST_ID}>{status}</Note>
      <Note testID={READOUT_TEST_ID}>{outcome}</Note>
    </View>
  );
}

/**
 * The ref interface, asked its two questions out of band.
 *
 * `measure` is a promise on both platforms because native's `measureInWindow` is
 * callback-based, and a handle that resolved synchronously on web would be a shape
 * a consumer could only use on one of them.
 */
function HandleDemo() {
  const ref = useRef<DraggableHandle>(null);
  const [readout, setReadout] = useState('not asked yet');

  const inspect = useCallback(async () => {
    const rect = await ref.current?.measure();
    const size = rect === null || rect === undefined ? 'unknown' : `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    setReadout(`dragging=${ref.current?.isDragging() ?? false} size=${size}`);
  }, []);

  return (
    <View className="items-start gap-3">
      <Draggable accessibilityLabel="notes.txt" accessibilityRole="button" data={{ [MIME]: 'notes.txt' }} ref={ref}>
        <Chip label="notes.txt" />
      </Draggable>
      <Action label="Inspect handle" onPress={inspect} />
      <Note testID={HANDLE_TEST_ID}>{readout}</Note>
    </View>
  );
}

const meta = {
  title: 'Gestures/Draggable',
  component: Draggable,
  parameters: { layout: 'centered' },
  // children is supplied per story; the stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof Draggable>;

type Story = StoryObj<typeof meta>;

export default meta;

/** Every knob: the payload, the zone, the read-out, the transports, and `disabled`. */
export const Interactive: Story = { render: () => <DragTrayPlayground /> };

/**
 * A drag that lands. The chip carries `{ [MIME]: label }`, the `<Dragzone>` reads it
 * back off the transfer it was handed, and `onDragEnd` reports the outcome — no
 * cancel, and the `dropEffect` the zone claimed.
 *
 * The two callbacks fire in that order for a reason: the zone's `onDrop` is the
 * payload arriving, and the source's `onDragEnd` is the source learning what became
 * of it. Both come from one `endDrag`, so a zone can never be handed the same drop
 * twice.
 */
export const Default: Story = {
  name: 'Demo: Drag a chip onto the zone',
  render: () => <DragTray />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-invoice.pdf`);
    const zone = await canvas.findByTestId(ZONE_TEST_ID);

    // The one thing a synthetic drag cannot prove: the browser only lifts a node
    // that carries `draggable`, and the component sets it on its host.
    await expect(chip).toHaveAttribute('draggable', 'true');

    const transfer = newDragTransfer();
    const to = centerOf(zone);
    await dragOnto({ source: chip, target: zone, to, transfer });

    // The DOM drop delivered nothing: for one of ours it only claimed the drag, and
    // the payload arrives when the store resolves the release.
    fireDrag(chip, 'dragend', transfer, to);

    // The zone read the payload off the transfer by MIME…
    await expect(await canvas.findByTestId(ZONE_READOUT_TEST_ID)).toHaveTextContent('Zone received invoice.pdf');
    // …and the source was told what became of it, with the effect the zone claimed.
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Dropped invoice.pdf (copy)');
  },
};

/**
 * A drag nothing takes. No zone is under the release point, so the store reports
 * `canceled: true` — the same shape a native pan released over empty space produces,
 * which is why there is one branch here and not one per platform.
 */
export const Canceled: Story = {
  name: 'Behaviour: A drag nothing accepts',
  render: () => <DragTray />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-photo.jpg`);

    await dragNowhere(chip, newDragTransfer());

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Canceled photo.jpg');
  },
};

/**
 * `disabled` takes the host out of the transport entirely rather than swallowing
 * callbacks: `draggable` is never set, so the browser will not lift the node in the
 * first place, and nothing is listening if something else tries.
 */
export const Disabled: Story = {
  name: 'Behaviour: Disabled chips cannot be lifted',
  render: () => <DragTray disabled={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-notes.txt`);

    await expect(chip).not.toHaveAttribute('draggable', 'true');

    await dragNowhere(chip, newDragTransfer());

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Nothing yet');
  },
};

/**
 * The payload leaving the library. A plain `dragover`/`drop` pair receives it, claims
 * it with `dropEffect = 'link'`, and that verdict comes back through the source's
 * `onDragEnd` — the store had no zone to credit, so this is the browser's word being
 * taken for it.
 */
export const ForeignTarget: Story = {
  name: 'Behaviour: Dropping onto a listener that knows nothing about Draggable',
  render: () => <BareDropZone />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByTestId(`${CHIP_TEST_ID}-invoice.pdf`);
    const zone = await canvas.findByTestId(BARE_TEST_ID);

    const transfer = newDragTransfer();
    await dragOnto({ source: chip, target: zone, to: centerOf(zone), transfer });

    // Read by MIME, out of the same transfer, by a listener with no adapter of any kind.
    await expect(await canvas.findByTestId(ZONE_READOUT_TEST_ID)).toHaveTextContent('Foreign listener got invoice.pdf');

    fireDrag(chip, 'dragend', transfer, centerOf(zone));

    // No zone of ours took it, so the store alone would say "canceled". The browser's
    // `dropEffect` is the only witness that something did, and that is what is reported.
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Source: dropped (link)');
  },
};

/**
 * The `DraggableHandle`. `isDragging()` and `measure()` answer from the same call site
 * on both platforms — `measure()` is a promise because native's `measureInWindow` is
 * callback-based, so web pays a microtask to keep one signature rather than two.
 */
export const ImperativeHandle: Story = {
  name: 'API: Reading state off the ref',
  render: () => <HandleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByTestId('story-action-inspect-handle'));

    // Idle, and measured to a real rectangle — the handle reaches the host node.
    await expect(await canvas.findByTestId(HANDLE_TEST_ID)).toHaveTextContent(HANDLE_READOUT);
  },
};
