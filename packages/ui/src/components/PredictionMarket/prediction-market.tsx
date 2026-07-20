// biome-ignore-all lint/style/noExcessiveLinesPerFile: outcome editing, probability bar, and input handling collocated for state sharing

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, type StyleProp, Text, TextInput, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useMountEffect } from '../../hooks/use-mount-effect';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { Banknote } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { Button } from '../Button/button';
import { NumberTicker } from '../NumberTicker/number-ticker';
import { Tabs, TabsList, TabsTrigger } from '../Tabs/tabs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PredictionMarketMode = 'buy' | 'sell';

export type PredictionMarketOutcome = { id: string; label: string; price: number };

export type PredictionMarketOrderValue = { mode: PredictionMarketMode; outcomeId: string; amount: string };

export type PredictionMarketQuote = {
  valid: boolean;
  amount: number;
  price: number;
  shares: number;
  payout: number;
  error?: string;
};

// biome-ignore lint/style/useExportsLast: props type before internal constants — collocated for readability
export type PredictionMarketProps = {
  outcomes?: PredictionMarketOutcome[];
  value?: PredictionMarketOrderValue;
  defaultValue?: Partial<PredictionMarketOrderValue>;
  onValueChange?: (value: PredictionMarketOrderValue) => void;
  onTrade?: (order: PredictionMarketOrderValue, quote: PredictionMarketQuote) => void;
  authenticated?: boolean;
  balance?: number;
  positions?: Record<string, number>;
  quickAmounts?: number[];
  minTrade?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_OUTCOMES: PredictionMarketOutcome[] = [
  { id: 'up', label: 'Up', price: 0.09 },
  { id: 'down', label: 'Down', price: 0.91 },
];

const MODES: { id: PredictionMarketMode; label: string }[] = [
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
];

const LABEL_DOLLAR_SIGN = '$';
const LABEL_CONNECT = 'Connect';

function isPredictionMarketMode(value: string): value is PredictionMarketMode {
  return value === 'buy' || value === 'sell';
}

const DEFAULT_QUICK_AMOUNTS = [10, 50, 100, 500];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeAmount(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole, ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('');
  if (decimalParts.length === 0) return whole ?? '';
  return `${whole ?? ''}.${decimal.slice(0, 2)}`;
}

function parseAmount(value: string) {
  return Number(value) || 0;
}

function formatCurrency(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return value >= 100 ? formatCurrency(value, 0) : formatCurrency(value, value % 1 === 0 ? 0 : 2);
}

function formatCents(value: number) {
  const cents = value * 100;
  const precision = Number.isInteger(cents) ? 0 : 1;
  return `${cents.toFixed(precision)}¢`;
}

/** Copied exactly from the web source. */
type BuildQuoteParams = {
  order: PredictionMarketOrderValue;
  outcome: PredictionMarketOutcome;
  balance: number;
  position: number;
  minTrade: number;
};

function buildQuote({ order, outcome, balance, position, minTrade }: BuildQuoteParams): PredictionMarketQuote {
  const amount = parseAmount(order.amount);
  const price = Math.max(0.01, Math.min(0.99, outcome.price));
  const shares = order.mode === 'buy' ? amount / price : amount;
  const payout = order.mode === 'buy' ? shares : amount * price;

  if (amount <= 0) return { valid: false, amount, price, shares: 0, payout: 0, error: 'Enter an amount' };
  if (order.mode === 'buy' && amount < minTrade)
    return { valid: false, amount, price, shares, payout, error: `Minimum ${formatCompactCurrency(minTrade)}` };
  if (order.mode === 'buy' && amount > balance)
    return { valid: false, amount, price, shares, payout, error: 'Insufficient balance' };
  if (order.mode === 'sell' && amount > position)
    return { valid: false, amount, price, shares, payout, error: 'Not enough shares' };
  return { valid: true, amount, price, shares, payout };
}

function amountFontSize(value: string) {
  const len = value.replace(/\D/g, '').length;
  if (len >= 10) return 28;
  if (len >= 8) return 32;
  if (len >= 6) return 40;
  return 48;
}

// ─── Controllable order hook ──────────────────────────────────────────────────

type UseControllableOrderParams = {
  value?: PredictionMarketOrderValue;
  defaultValue?: Partial<PredictionMarketOrderValue>;
  outcomes: PredictionMarketOutcome[];
  onValueChange?: (value: PredictionMarketOrderValue) => void;
};
function useControllableOrder({ value, defaultValue, outcomes, onValueChange }: UseControllableOrderParams) {
  const initialValue: PredictionMarketOrderValue = {
    mode: defaultValue?.mode ?? 'buy',
    outcomeId: defaultValue?.outcomeId ?? outcomes[0]?.id ?? '',
    amount: defaultValue?.amount ?? '',
  };
  const [internalValue, setInternalValue] = useState(initialValue);
  const controlled = value !== undefined;
  const order = value ?? internalValue;

  const setOrder = useCallback(
    (next: PredictionMarketOrderValue) => {
      if (!controlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  return [order, setOrder] as const;
}

// ─── Quick-amount chip ────────────────────────────────────────────────────────

type AmountChipProps = { label: string; onPress: () => void; disabled: boolean };

function AmountChip({ label, onPress, disabled }: AmountChipProps) {
  const [pressed, setPressed] = useState(false);
  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  return (
    <MotiView animate={{ scale: pressed ? 0.95 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        style={{
          height: 36,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111111' }}>{label}</Text>
      </Pressable>
    </MotiView>
  );
}

// Binds its own amount to the stable onSelect so the list never creates a
// per-chip arrow in the parent's render.
type QuickAmountChipProps = { amount: number; label: string; disabled: boolean; onSelect: (amount: number) => void };

function QuickAmountChip({ amount, label, disabled, onSelect }: QuickAmountChipProps) {
  const handlePress = useCallback(() => onSelect(amount), [onSelect, amount]);
  return <AmountChip label={label} onPress={handlePress} disabled={disabled} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: real-time probability rebalance requires all outcome state in one closure
export function PredictionMarket({
  outcomes = DEFAULT_OUTCOMES,
  value,
  defaultValue,
  onValueChange,
  onTrade,
  authenticated = true,
  balance = 500,
  positions = {},
  quickAmounts = DEFAULT_QUICK_AMOUNTS,
  minTrade = 1,
  style,
  testID,
}: PredictionMarketProps) {
  const reduce = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'idle' | 'placing' | 'filled'>('idle');

  // Shake animation on invalid submit (reanimated — works in stories on web too).
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const [order, setOrder] = useControllableOrder({ value, defaultValue, outcomes, onValueChange });

  const selectedOutcome = outcomes.find((o) => o.id === order.outcomeId) ?? outcomes[0];
  const position = selectedOutcome ? (positions[selectedOutcome.id] ?? 0) : 0;

  const quote = useMemo(
    () =>
      buildQuote({
        order,
        outcome: selectedOutcome ?? { id: '', label: '', price: 0.5 },
        balance,
        position,
        minTrade,
      }),
    [balance, minTrade, order, position, selectedOutcome],
  );

  const setOrderValue = useCallback(
    (next: Partial<PredictionMarketOrderValue>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setStatus('idle');
      setOrder({ ...order, ...next });
    },
    [order, setOrder],
  );

  useMountEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  });

  const addAmount = useCallback(
    (increment: number) => {
      const next = parseAmount(order.amount) + increment;
      setOrderValue({ amount: String(next) });
    },
    [order.amount, setOrderValue],
  );

  const setMax = useCallback(() => {
    if (order.mode === 'buy') {
      setOrderValue({ amount: String(Math.floor(balance)) });
      return;
    }
    setOrderValue({ amount: position.toFixed(position % 1 === 0 ? 0 : 2) });
  }, [order.mode, balance, position, setOrderValue]);

  const handleModeChange = useCallback(
    (mode: string) => {
      if (isPredictionMarketMode(mode)) setOrderValue({ mode, amount: '' });
    },
    [setOrderValue],
  );

  const handleOutcomeChange = useCallback((outcomeId: string) => setOrderValue({ outcomeId }), [setOrderValue]);

  const handleAmountChange = useCallback((text: string) => setOrderValue({ amount: sanitizeAmount(text) }), [setOrderValue]);

  const formatPayout = useCallback((cents: number) => formatCurrency(cents / 100), []);

  const submit = useCallback(() => {
    if (!authenticated) return;

    if (!quote.valid) {
      if (!reduce)
        shakeX.value = withSequence(
          withTiming(-5, { duration: 50 }),
          withTiming(5, { duration: 60 }),
          withTiming(-3, { duration: 50 }),
          withTiming(3, { duration: 60 }),
          withTiming(-1, { duration: 50 }),
          withTiming(0, { duration: 60 }),
        );
      return;
    }

    setStatus('placing');
    timeoutRef.current = setTimeout(() => {
      setStatus('filled');
      onTrade?.(order, quote);
      // Reset after 1.5s
      timeoutRef.current = setTimeout(() => setStatus('idle'), 1500);
    }, 650);
  }, [authenticated, quote, reduce, shakeX, onTrade, order]);

  const fontSize = amountFontSize(order.amount);
  const isPlacing = status === 'placing';
  const isFilled = status === 'filled';

  let buttonLabel: string;
  if (isFilled) buttonLabel = 'Trade filled';
  else if (quote.valid) buttonLabel = 'Trade';
  else buttonLabel = quote.error ?? 'Enter an amount';

  return (
    <View
      testID={testID}
      style={[
        {
          width: '100%',
          maxWidth: 400,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Header: Buy/Sell tabs + mode label */}
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(229,231,235,0.8)',
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
      >
        <Tabs value={order.mode} onValueChange={handleModeChange} variant="underline">
          <TabsList>
            {MODES.map((mode) => (
              <TabsTrigger key={mode.id} value={mode.id}>
                {mode.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </View>

      {/* Body */}
      <View style={{ gap: 16, padding: 12 }}>
        {/* Outcome selector */}
        <Tabs value={selectedOutcome?.id ?? ''} onValueChange={handleOutcomeChange} variant="pill">
          <TabsList>
            {outcomes.map((outcome) => (
              <TabsTrigger key={outcome.id} value={outcome.id}>
                {`${outcome.label} ${formatCents(outcome.price)}`}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Amount input */}
        <Animated.View style={[{ borderRadius: 24, backgroundColor: '#f9fafb', padding: 16 }, shakeStyle]}>
          <View style={{ minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '500', color: '#111111' }}>
              {order.mode === 'buy' ? 'Amount' : 'Shares'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {order.mode === 'buy' ? (
                <Text
                  style={{
                    fontSize,
                    fontWeight: '600',
                    color: 'rgba(17,17,17,0.4)',
                    lineHeight: fontSize * 1.1,
                  }}
                >
                  {LABEL_DOLLAR_SIGN}
                </Text>
              ) : null}
              <TextInput
                accessibilityLabel={order.mode === 'buy' ? 'Amount' : 'Shares'}
                value={order.amount}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor="rgba(17,17,17,0.35)"
                inputMode="decimal"
                editable={!isPlacing}
                style={{
                  fontSize,
                  fontWeight: '600',
                  color: '#111111',
                  minWidth: 24,
                  textAlign: 'center',
                  padding: 0,
                  outlineWidth: 0,
                }}
              />
            </View>
          </View>

          {/* Quick amount chips */}
          <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {quickAmounts.map((amount) => (
              <QuickAmountChip
                key={amount}
                amount={amount}
                label={`+${order.mode === 'buy' ? formatCompactCurrency(amount) : amount}`}
                onSelect={addAmount}
                disabled={isPlacing}
              />
            ))}
            <AmountChip label="Max" onPress={setMax} disabled={isPlacing} />
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      {authenticated ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(229,231,235,0.8)',
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          {/* Payout row */}
          <View
            style={{
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '600', color: '#111111' }}>
                  {order.mode === 'buy' ? 'To win' : 'To receive'}
                </Text>
                <Banknote size={20} color="#10b981" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#6b7280', marginTop: 2 }}>
                {`Avg. Price ${formatCents(quote.price)}`}
              </Text>
            </View>
            <NumberTicker
              value={quote.payout * 100}
              startOnView={false}
              duration={0.45}
              stagger={0}
              blur={true}
              className="font-semibold text-emerald-500"
              style={{ alignSelf: 'flex-end' }}
              format={formatPayout}
              accessibilityLabel={`Payout ${formatCurrency(quote.payout)}`}
            />
          </View>

          {/* Trade button */}
          <Button
            variant="primary"
            size="lg"
            onPress={submit}
            loading={isPlacing}
            disabled={isFilled}
            style={{ borderRadius: 16 }}
            testID="trade-button"
          >
            {buttonLabel}
          </Button>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          <Button variant="primary" size="lg" onPress={submit} style={{ borderRadius: 16 }} testID="connect-button">
            {LABEL_CONNECT}
          </Button>
        </View>
      )}
    </View>
  );
}
