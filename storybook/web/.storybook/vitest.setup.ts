import { setProjectAnnotations } from '@storybook/react-native-web-vite';
import { configure } from 'storybook/test';
import { beforeAll } from 'vitest';
import preview from './preview';

// The default async-query timeout (1000ms) is too tight for this suite's
// animated stories on slow hosts (WSL2/CI): a `findBy*`/`waitFor` polling a
// spring or height tween that hasn't settled yet occasionally crosses 1s and
// flakes with a "Timed out in waitFor" / "Unable to find …" error surfaced
// through @testing-library/dom's `checkRealTimersCallback`. Raise the ceiling
// so the queries tolerate a busy frame instead of failing.
configure({ asyncUtilTimeout: 5000 });

const annotations = setProjectAnnotations([preview]);

beforeAll(annotations.beforeAll);
