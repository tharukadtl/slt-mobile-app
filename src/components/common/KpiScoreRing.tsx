import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';

/**
 * SRS 5.4.3 — Team KPI dashboard performance bands. Matches the bands already
 * computed server-side by KpiCalculationService (fieldops), not the sheet's
 * originally-proposed 3-tier system: EXCELLENT >=90, GOOD >=75, AVERAGE >=60,
 * BELOW_AVERAGE >=40, NEEDS_IMPROVEMENT below — confirmed live against the
 * backend, where "55" is BELOW_AVERAGE ("BELOW AVG" as rendered), not the
 * bottom tier.
 */
export const tierForScore = (
  score: number,
): {label: string; color: string} => {
  if (score >= 90) return {label: 'EXCELLENT', color: colors.success};
  if (score >= 75) return {label: 'GOOD', color: colors.info};
  if (score >= 60) return {label: 'AVERAGE', color: colors.warning};
  if (score >= 40) return {label: 'BELOW AVG', color: colors.accent};
  return {label: 'NEEDS IMPROVEMENT', color: colors.error};
};

interface KpiScoreRingProps {
  score: number;
}

const KpiScoreRing: React.FC<KpiScoreRingProps> = ({score}) => {
  const {label, color} = tierForScore(score);

  return (
    <View style={[styles.ring, {borderColor: color}]}>
      <Text style={styles.value}>{score}</Text>
      <Text style={[styles.label, {color}]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    backgroundColor: colors.white,
  },
  value: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 8,
    fontWeight: typography.bold,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default KpiScoreRing;
