import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Chip } from './ui';

interface BaseProps<T extends string> {
  label?: string;
  options: readonly T[];
  labelFor: (value: T) => string;
  selected: T | null;
}

/** Filter mode: a leading chip selects `null`, and tapping the selected chip clears it. */
interface FilterProps<T extends string> extends BaseProps<T> {
  allLabel: string;
  onSelect: (value: T | null) => void;
}

/** Required mode: some value is always selected. */
interface RequiredProps<T extends string> extends BaseProps<T> {
  allLabel?: undefined;
  onSelect: (value: T) => void;
}

export function ChipRow<T extends string>(props: FilterProps<T> | RequiredProps<T>) {
  const { label, options, labelFor, selected } = props;

  function press(value: T) {
    if (props.allLabel !== undefined) props.onSelect(selected === value ? null : value);
    else props.onSelect(value);
  }

  return (
    <>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {props.allLabel !== undefined && (
            <Chip label={props.allLabel} selected={!selected} onPress={() => props.onSelect(null)} />
          )}
          {options.map((value) => (
            <Chip key={value} label={labelFor(value)} selected={selected === value} onPress={() => press(value)} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
});
