import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarBlank, Check } from 'phosphor-react-native';
import type { GridCell } from '../../lib/availability';
import { AmbitFont, Brand } from '../../constants/theme';

interface Props {
  cells:        GridCell[][];  // [rowIdx][colIdx]
  mySelected:   Set<string>;
  theirSelected: Set<string>;
  busy:         Set<string>;   // pre-blocked by my own calendar events
  /// When false, cells aren't tappable (e.g. closed poll). Pre-blocked
  /// cells are always unresponsive regardless of this flag.
  editable:     boolean;
  onToggle:     (cellKey: string) => void;
}

/// When-to-meet grid. Vertical scroll for the time axis; horizontal
/// scroll for the day axis when more than three days are visible.
/// Cells are tinted by 4 axes: mine, theirs, both, busy.
export function AvailabilityGrid({
  cells,
  mySelected,
  theirSelected,
  busy,
  editable,
  onToggle,
}: Props) {
  const dayCount = cells[0]?.length ?? 0;
  const rowCount = cells.length;

  const dayHeaders = useMemo(() => {
    if (rowCount === 0) return [];
    return cells[0].map((c) =>
      c.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    );
  }, [cells, rowCount]);

  const timeLabels = useMemo(() => {
    return cells.map((row) => formatTimeLabel(row[0].start));
  }, [cells]);

  if (rowCount === 0) return null;

  return (
    <View style={styles.root}>
      {/* Sticky top-left corner spacer + day headers (horizontal scroll) */}
      <View style={styles.headerRow}>
        <View style={styles.timeColSpacer} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.headerScroll}
        >
          {dayHeaders.map((label, i) => (
            <View key={i} style={[styles.dayHeader, { width: CELL_W }]}>
              <Text style={styles.dayHeaderText} numberOfLines={2}>
                {label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Body — time-of-day labels stay anchored, grid cells scroll horizontally */}
      <ScrollView
        style={styles.bodyScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row' }}>
          {/* Time-of-day labels */}
          <View style={styles.timeCol}>
            {timeLabels.map((t, i) => (
              <View key={i} style={[styles.timeCell, { height: CELL_H }]}>
                <Text style={styles.timeCellText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>

          {/* The cells themselves */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View>
              {cells.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.cellRow}>
                  {row.map((cell) => (
                    <Cell
                      key={cell.key}
                      cell={cell}
                      mine={mySelected.has(cell.key)}
                      theirs={theirSelected.has(cell.key)}
                      busy={busy.has(cell.key)}
                      editable={editable}
                      onPress={() => onToggle(cell.key)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <Legend swatchStyle={styles.legendBusy} label="Busy" />
        <Legend swatchStyle={styles.legendMine} label="Yours" />
        <Legend swatchStyle={styles.legendTheirs} label="Theirs" />
        <Legend swatchStyle={styles.legendBoth} label="Both" />
      </View>
    </View>
  );
}

const CELL_H = 36;
const CELL_W = 64;

interface CellProps {
  cell:     GridCell;
  mine:     boolean;
  theirs:   boolean;
  busy:     boolean;
  editable: boolean;
  onPress:  () => void;
}

function Cell({ cell, mine, theirs, busy, editable, onPress }: CellProps) {
  const isBoth = mine && theirs;
  const disabled = busy || !editable;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.cell,
        busy   && styles.cellBusy,
        mine && !theirs && styles.cellMine,
        theirs && !mine && styles.cellTheirs,
        isBoth          && styles.cellBoth,
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      {busy ? (
        <CalendarBlank size={12} color={Brand.inkMuted} weight="bold" />
      ) : isBoth ? (
        <Check size={12} color={Brand.canvas} weight="bold" />
      ) : null}
    </Pressable>
  );
}

function Legend({ swatchStyle, label }: { swatchStyle: object; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendSwatch, swatchStyle]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const TIME_COL_W = 66;

const styles = StyleSheet.create({
  root: { gap: 8 },

  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderDefault,
  },
  timeColSpacer: { width: TIME_COL_W },
  headerScroll: { flexDirection: 'row' },
  dayHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.inkLabel,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  bodyScroll: {
    maxHeight: 380,
  },

  timeCol: { width: TIME_COL_W },
  timeCell: {
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.borderDefault,
  },
  timeCellText: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    color: Brand.inkMuted,
    marginTop: -6,
  },

  cellRow: { flexDirection: 'row' },
  cell: {
    width: CELL_W,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.borderDefault,
  },
  cellBusy: {
    backgroundColor: Brand.surface2,
    opacity: 0.75,
  },
  cellMine: {
    backgroundColor: Brand.selected, // Yours — iris purple
  },
  cellTheirs: {
    backgroundColor: Brand.canvas,
    borderColor: Brand.actionDeep,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  cellBoth: {
    backgroundColor: Brand.actionDeep, // Both — deep royal
    borderColor: Brand.actionDeep,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  legendBusy:   { backgroundColor: Brand.surface2 },
  legendMine:   { backgroundColor: Brand.selected, borderColor: Brand.selected },
  legendTheirs: { backgroundColor: Brand.canvas, borderColor: Brand.actionDeep, borderStyle: 'dashed' },
  legendBoth:   { backgroundColor: Brand.actionDeep, borderColor: Brand.actionDeep },
  legendLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkMuted,
  },
});
