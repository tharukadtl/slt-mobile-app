import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import {LaborDetails} from '@appTypes/technician.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {formatCurrency} from '@utils/formatters';

interface Step2LaborProps {
  labor: LaborDetails;
  onLaborChange: (labor: LaborDetails) => void;
  materialsTotal: number;
}

const HOURS = Array.from({length: 24}, (_, i) =>
  i.toString().padStart(2, '0'),
);
const MINUTES = ['00', '15', '30', '45'];

const Step2Labor: React.FC<Step2LaborProps> = ({
  labor,
  onLaborChange,
  materialsTotal,
}) => {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('10');
  const [endMinute, setEndMinute] = useState('00');

  const calculateLabor = (
    sHour: string,
    sMin: string,
    eHour: string,
    eMin: string,
  ) => {
    const startMinutes =
      parseInt(sHour) * 60 + parseInt(sMin);
    const endMinutes = parseInt(eHour) * 60 + parseInt(eMin);
    const totalMinutes = Math.max(0, endMinutes - startMinutes);
    const totalHours = totalMinutes / 60;
    const laborCharges = totalHours * labor.hourlyRate;

    onLaborChange({
      ...labor,
      startTime: `${sHour}:${sMin}`,
      endTime: `${eHour}:${eMin}`,
      totalHours,
      laborCharges,
    });
  };

  const handleStartTime = (hour: string, minute: string) => {
    setStartHour(hour);
    setStartMinute(minute);
    setShowStartPicker(false);
    calculateLabor(hour, minute, endHour, endMinute);
  };

  const handleEndTime = (hour: string, minute: string) => {
    setEndHour(hour);
    setEndMinute(minute);
    setShowEndPicker(false);
    calculateLabor(startHour, startMinute, hour, minute);
  };

  const formatDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m} minutes`;
    if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`;
    return `${h} hour${h > 1 ? 's' : ''} ${m} minutes`;
  };

  const TimePicker = ({
    visible,
    onSelect,
    onClose,
    title,
  }: {
    visible: boolean;
    onSelect: (h: string, m: string) => void;
    onClose: () => void;
    title: string;
  }) => {
    if (!visible) return null;
    const [selectedHour, setSelectedHour] = useState(
      title === 'Start' ? startHour : endHour,
    );
    const [selectedMinute, setSelectedMinute] = useState(
      title === 'Start' ? startMinute : endMinute,
    );

    return (
      <View style={styles.timePickerOverlay}>
        <View style={styles.timePicker}>
          <Text style={styles.timePickerTitle}>
            Select {title} Time
          </Text>
          <View style={styles.timePickerContent}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeColumnLabel}>Hour</Text>
              {HOURS.map(h => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.timeOption,
                    selectedHour === h && styles.timeOptionSelected,
                  ]}
                  onPress={() => setSelectedHour(h)}>
                  <Text
                    style={[
                      styles.timeOptionText,
                      selectedHour === h &&
                        styles.timeOptionTextSelected,
                    ]}>
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeColumn}>
              <Text style={styles.timeColumnLabel}>Min</Text>
              {MINUTES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.timeOption,
                    selectedMinute === m && styles.timeOptionSelected,
                  ]}
                  onPress={() => setSelectedMinute(m)}>
                  <Text
                    style={[
                      styles.timeOptionText,
                      selectedMinute === m &&
                        styles.timeOptionTextSelected,
                    ]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.timePickerActions}>
            <TouchableOpacity
              style={styles.cancelPickerButton}
              onPress={onClose}>
              <Text style={styles.cancelPickerText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmPickerButton}
              onPress={() => onSelect(selectedHour, selectedMinute)}>
              <Text style={styles.confirmPickerText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 2: Labor Details</Text>
      <Text style={styles.stepDescription}>
        Enter work start and end time to calculate labor charges
      </Text>

      {/* Time Selection */}
      <View style={styles.card}>
        {/* Start Time */}
        <Text style={styles.label}>Work Start Time</Text>
        <TouchableOpacity
          style={styles.timePicker2}
          onPress={() => setShowStartPicker(true)}>
          <Text style={styles.timePickerIcon}>🕐</Text>
          <Text style={styles.timePickerValue}>
            {labor.startTime || `${startHour}:${startMinute}`}
          </Text>
          <Text style={styles.timePickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* End Time */}
        <Text style={[styles.label, {marginTop: spacing.md}]}>
          Work End Time
        </Text>
        <TouchableOpacity
          style={styles.timePicker2}
          onPress={() => setShowEndPicker(true)}>
          <Text style={styles.timePickerIcon}>🕐</Text>
          <Text style={styles.timePickerValue}>
            {labor.endTime || `${endHour}:${endMinute}`}
          </Text>
          <Text style={styles.timePickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Duration */}
        {labor.totalHours > 0 && (
          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>Total Duration</Text>
            <Text style={styles.durationValue}>
              {formatDuration(labor.totalHours)}
            </Text>
          </View>
        )}
      </View>

      {/* Hourly Rate */}
      <View style={styles.card}>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>Hourly Rate</Text>
          <Text style={styles.rateValue}>
            {formatCurrency(labor.hourlyRate)}/hour
          </Text>
        </View>
        {labor.totalHours > 0 && (
          <View style={styles.calculationRow}>
            <Text style={styles.calculationText}>
              {labor.totalHours.toFixed(2)} hours ×{' '}
              {formatCurrency(labor.hourlyRate)} ={' '}
              <Text style={styles.calculationResult}>
                {formatCurrency(labor.laborCharges)}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* FOC/Chargeable Toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Labor Type</Text>
            <Text style={styles.toggleHint}>
              Labor can only be marked FOC with admin approval
            </Text>
          </View>
          <View style={styles.typeToggle}>
            <Text
              style={[
                styles.typeLabel,
                labor.type === 'FOC' && styles.typeLabelFOC,
              ]}>
              {labor.type}
            </Text>
            <Switch
              value={labor.type === 'CHARGEABLE'}
              onValueChange={value =>
                onLaborChange({
                  ...labor,
                  type: value ? 'CHARGEABLE' : 'FOC',
                })
              }
              trackColor={{
                false: colors.success + '80',
                true: colors.warning + '80',
              }}
              thumbColor={
                labor.type === 'CHARGEABLE'
                  ? colors.warning
                  : colors.success
              }
            />
          </View>
        </View>
      </View>

      {/* Summary */}
      {labor.totalHours > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Labor Chargeable:
            </Text>
            <Text style={[styles.summaryValue, {color: colors.warning}]}>
              {formatCurrency(
                labor.type === 'CHARGEABLE' ? labor.laborCharges : 0,
              )}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total So Far:</Text>
            <Text
              style={[
                styles.summaryValue,
                {color: colors.primary, fontSize: typography.lg},
              ]}>
              {formatCurrency(
                materialsTotal +
                  (labor.type === 'CHARGEABLE'
                    ? labor.laborCharges
                    : 0),
              )}
            </Text>
          </View>
        </View>
      )}

      {/* Time Pickers */}
      <TimePicker
        visible={showStartPicker}
        title="Start"
        onSelect={handleStartTime}
        onClose={() => setShowStartPicker(false)}
      />
      <TimePicker
        visible={showEndPicker}
        title="End"
        onSelect={handleEndTime}
        onClose={() => setShowEndPicker(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  stepTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  timePicker2: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePickerIcon: {fontSize: 20, marginRight: spacing.sm},
  timePickerValue: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  timePickerArrow: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  durationCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  durationValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  rateValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  calculationRow: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 6,
  },
  calculationText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  calculationResult: {
    fontWeight: typography.bold,
    color: colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  toggleHint: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginTop: 2,
    maxWidth: 200,
  },
  typeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.warning,
  },
  typeLabelFOC: {color: colors.success},
  summaryCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  timePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  timePicker: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    width: '80%',
    maxHeight: '70%',
  },
  timePickerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  timePickerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    maxHeight: 200,
  },
  timeColumn: {
    width: 80,
    alignItems: 'center',
  },
  timeColumnLabel: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  timeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    marginBottom: 2,
    width: '100%',
    alignItems: 'center',
  },
  timeOptionSelected: {
    backgroundColor: colors.primary,
  },
  timeOptionText: {
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  timeOptionTextSelected: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  timeSeparator: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginHorizontal: spacing.sm,
    marginTop: 32,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelPickerButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelPickerText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  confirmPickerButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  confirmPickerText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
});

export default Step2Labor;