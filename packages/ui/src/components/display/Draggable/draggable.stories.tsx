/**
 * Stories for `Draggable`, the cross-platform grab-and-carry wrapper.
 *
 * These run under react-native-web, so what they pin is the web transport: a
 * genuine HTML5 drag. That is the half worth asserting hardest, because it is the
 * half that has to interoperate — the drop zone below listens on plain
 * `dragover`/`drop` and has never heard of this component, which is exactly how
 * `<FileSystem onExternalDrop>` receives these drags.
 *
 * The native transport (long-press pan, ghost, the `getActiveDrag` registry) has
 * no browser to run in. Its payload logic is unit-tested in
 * `__tests__/draggable-transfer.test.ts`, and the registry it publishes to is
 * read live by the drop zone here, so the shared half is covered from both ends.
 */
/** biome-ignore-all lint/style/useExportsLast: this a stories file */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: stories only */
/** biome-ignore-all lint/performance/noJsxPropsBind: stories only */

import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { FileLine as FileText } from 'rn-motion-ui-icons/icons/file-line';
import { expect, userEvent, within } from 'storybook/test';
import { Action, ControlCard, Note, Playground, Toggle } from '../../../__stories__/story-harness';
import { cn } from '../../../lib/cn';
import { Text } from '../../typography/Text/text';
import { Draggable } from './draggable';
import type { DragEndEvent, DraggableHandle } from './draggable.types';
import { getActiveDrag, subscribeActiveDrag } from './draggable-transfer';

/** The format the chips write and the zone reads — one private MIME, as an app would. */
const MIME = 'application/x-story-item';

const CHIP_TEST_ID = 'story-draggable-chip';
const ZONE_TEST_ID = 'story-draggable-zone';
const READOUT_TEST_ID = 'story-draggable-readout';
const HANDLE_TEST_ID = 'story-draggable-handle';

/** `dragging=false size=120×32` — what the handle answered, in one line. */
const HANDLE_READOUT = /^dragging=false size=\d+×\d+$/;

const ITEMS = ['invoice.pdf', 'photo.jpg', 'notes.txt'];

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

type DropZoneProps = { onDrop: (name: string) => void };

/**
 * A drop zone that knows nothing about `Draggable`.
 *
 * Web: plain `dragover`/`drop` listeners, wired through the DOM node because
 * react-native-web does not forward those props from JSX. Setting `dropEffect` on
 * `dragover` is what makes the source's `onDragEnd` report a drop rather than a
 * cancel — the browser's verdict, which is why the component does not invent one.
 *
 * Native: there is no HTML5 drag, so it reads the registry instead. Same payload,
 * same MIME, and `useSyncExternalStore` re-renders it twice a drag rather than
 * once a frame.
 */
function DropZone({ onDrop }: DropZoneProps) {
  const ref = useRef<View | null>(null);
  const [isOver, setIsOver] = useState(false);
  const active = useSyncExternalStore(subscribeActiveDrag, getActiveDrag);

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    function onDragOver(e: DragEvent) {
      e.preventDefault();
      // Claiming the drag. Without this the browser reports 'none' at dragend.
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setIsOver(true);
    }
    function onDragLeave() {
      setIsOver(false);
    }
    function onDropped(e: DragEvent) {
      e.preventDefault();
      setIsOver(false);
      const name = e.dataTransfer?.getData(MIME);
      if (name) onDrop(name);
    }

    node.addEventListener('dragover', onDragOver, { passive: false });
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDropped);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDropped);
    };
  }, [onDrop]);

  // Native has no dragover to read, so the registry is what tells the zone a drag
  // is in flight at all.
  const incoming = active === null ? null : active.transfer.getData(MIME);

  return (
    <View
      ref={ref}
      className={cn(
        'items-center justify-center rounded-lg border border-dashed py-6',
        isOver ? 'border-info bg-info/10' : 'border-border',
      )}
      testID={ZONE_TEST_ID}
    >
      <Text className="text-muted-foreground" size="sm">
        {incoming === null || incoming === '' ? 'Drop here' : `Carrying ${incoming}`}
      </Text>
    </View>
  );
}

type TrayProps = { disabled?: boolean; onDragEnd?: (event: DragEndEvent) => void };

/** The demo: three draggable chips over one drop zone, with a live read-out. */
function DragTray({ disabled = false, onDragEnd }: TrayProps) {
  const [status, setStatus] = useState('Nothing yet');

  const handleEnd = useCallback(
    (event: DragEndEvent) => {
      const name = event.transfer.getData(MIME);
      setStatus(event.canceled ? `Canceled ${name}` : `Dropped ${name} (${event.dropEffect})`);
      onDragEnd?.(event);
    },
    [onDragEnd],
  );

  const handleDrop = useCallback((name: string) => setStatus(`Zone received ${name}`), []);

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
          >
            <Chip label={label} />
          </Draggable>
        ))}
      </View>
      <DropZone onDrop={handleDrop} />
      <Note testID={READOUT_TEST_ID}>{status}</Note>
      <Note>{HINT}</Note>
    </View>
  );
}

/** The tray plus the one knob worth turning: whether the chips can be lifted at all. */
function DragTrayPlayground() {
  const [disabled, setDisabled] = useState(false);

  return (
    <Playground>
      <ControlCard title="Options">
        <Toggle label="Disabled" onChange={setDisabled} value={disabled} />
      </ControlCard>
      <DragTray disabled={disabled} />
    </Playground>
  );
}

/**
 * The ref interface, asked its two questions out of band.
 *
 * `measure` is a promise on both platforms because native's `measureInWindow` is
 * callback-based, and a handle that resolved synchronously on web would be a
 * shape a consumer could only use on one platform.
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
  title: 'Display/Draggable',
  component: Draggable,
  parameters: { layout: 'centered' },
  // children is supplied per story; the stub satisfies the type checker.
  args: { children: null },
} satisfies Meta<typeof Draggable>;

type Story = StoryObj<typeof meta>;

export default meta;

// ─── Driving a drag in a test ──────────────────────────────────────────────────
// `userEvent` has no HTML5 drag, so these dispatch the events themselves. One
// `DataTransfer` is threaded through every event of a drag, which is what makes
// them a drag rather than four unrelated events: it is the object the source
// writes the payload into, the zone reads it out of, and the `dropEffect` the
// zone writes on `dragover` is still on it at `dragend`.
//
// This exercises the component's own wiring, not Chromium's drag transport —
// dispatching `dragstart` does not make the browser start a real drag. The part
// that cannot be faked (the browser lifting a `draggable` node at all) is
// asserted instead through the attribute the component sets on its host.

/**
 * A `DataTransfer` whose `dropEffect` a drop zone can actually claim.
 *
 * `new DataTransfer()` is in the spec's read/write "copy and paste" mode, not drag
 * mode, and there the `dropEffect` setter is defined to do nothing — so a zone's
 * `dragover` claim silently vanishes and every synthetic drag would read `'none'`
 * at `dragend`. Redefining it as a plain writable property restores the one
 * behaviour a real drag has and a constructed transfer does not. `setData` and
 * `getData`, which carry the payload, work as-is.
 */
function newDragTransfer(): DataTransfer {
  const transfer = new DataTransfer();
  Object.defineProperty(transfer, 'dropEffect', { configurable: true, value: 'none', writable: true });
  return transfer;
}

function fireDrag(node: Element, type: string, transfer: DataTransfer, point = { x: 0, y: 0 }) {
  node.dispatchEvent(
    new DragEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, dataTransfer: transfer }),
  );
}

/** The host element of a `<Draggable>` — the node its web transport listens on. */
async function chipHost(canvas: ReturnType<typeof within>, label: string): Promise<HTMLElement> {
  return await canvas.findByTestId(`${CHIP_TEST_ID}-${label}`);
}

/**
 * Lift the chip, cross the zone, and drop on it — everything except the release.
 *
 * `dragend` is left to the caller because the two halves say different things: the
 * drop is the zone reading the payload, and the release is the source learning
 * what became of it.
 */
function dragOntoZone(chip: Element, zone: Element, transfer: DataTransfer) {
  fireDrag(chip, 'dragstart', transfer, { x: 10, y: 10 });
  fireDrag(chip, 'drag', transfer, { x: 40, y: 60 });
  fireDrag(zone, 'dragenter', transfer, { x: 80, y: 120 });
  fireDrag(zone, 'dragover', transfer, { x: 80, y: 120 });
  fireDrag(zone, 'drop', transfer, { x: 80, y: 120 });
}

/** Every knob: the payload, the zone, the read-out, and the disabled flag. */
export const Interactive: Story = { render: () => <DragTrayPlayground /> };

/**
 * A drag that lands. The chip carries `{ [MIME]: label }`, the zone reads it back
 * out of the transfer it was handed, and `onDragEnd` reports the browser's
 * verdict — `canceled: false` with the `dropEffect` the zone asked for.
 *
 * The payload crossing to a listener that knows nothing about `<Draggable>` is
 * the assertion that matters: the zone here is a bare `dragover`/`drop` pair on a
 * DOM node, which is why `<FileSystem onExternalDrop>` receives these drags with
 * no adapter of any kind.
 */
export const Default: Story = {
  name: 'Demo: Drag a chip onto the zone',
  render: () => <DragTray />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await chipHost(canvas, 'invoice.pdf');
    const zone = await canvas.findByTestId(ZONE_TEST_ID);

    // The one thing a synthetic drag cannot prove: the browser will only lift a
    // node that carries `draggable`, and the component sets it on its host.
    await expect(chip).toHaveAttribute('draggable', 'true');

    const transfer = newDragTransfer();
    dragOntoZone(chip, zone, transfer);

    // The zone got the payload out of the transfer, by MIME, with no adapter.
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Zone received invoice.pdf');

    fireDrag(chip, 'dragend', transfer, { x: 80, y: 120 });

    // `onDragEnd` reports the browser's verdict, not a guess: the read-out is the
    // payload plus the `dropEffect` the zone claimed on `dragover`, and no cancel.
    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Dropped invoice.pdf (copy)');
  },
};

/**
 * A drag nothing takes. No zone claims it, so the transfer still reads `'none'` at
 * `dragend` and the component reports `canceled: true` — the same shape a native
 * drag released over empty space produces, which is why there is one branch here
 * and not one per platform.
 */
export const Canceled: Story = {
  name: 'Behaviour: A drag nothing accepts',
  render: () => <DragTray />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await chipHost(canvas, 'photo.jpg');

    const transfer = newDragTransfer();
    fireDrag(chip, 'dragstart', transfer, { x: 10, y: 10 });
    fireDrag(chip, 'drag', transfer, { x: 200, y: 400 });
    fireDrag(chip, 'dragend', transfer, { x: 200, y: 400 });

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Canceled photo.jpg');
  },
};

/**
 * `disabled` takes the host out of the drag transport entirely rather than
 * swallowing callbacks: `draggable` is never set, so the browser will not lift the
 * node in the first place.
 */
export const Disabled: Story = {
  name: 'Behaviour: Disabled chips cannot be lifted',
  render: () => <DragTray disabled={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await chipHost(canvas, 'notes.txt');

    await expect(chip).not.toHaveAttribute('draggable', 'true');

    // And nothing listens, so even a hand-dispatched drag starts no session.
    const transfer = newDragTransfer();
    fireDrag(chip, 'dragstart', transfer, { x: 10, y: 10 });
    fireDrag(chip, 'dragend', transfer, { x: 10, y: 10 });

    await expect(await canvas.findByTestId(READOUT_TEST_ID)).toHaveTextContent('Nothing yet');
  },
};

/**
 * The `DraggableHandle`. `isDragging()` and `measure()` answer on both platforms
 * from the same call site — `measure()` is a promise because native's
 * `measureInWindow` is callback-based, so the web side pays a microtask to keep one
 * signature rather than two.
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
