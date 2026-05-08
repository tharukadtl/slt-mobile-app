import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {setHasBODToday} from '@store/slices/technicianSlice';
import api from '@services/api';

type Nav = StackNavigationProp<TeamLeadStackParamList>;

interface Summary {
  totalToday: number;
  pending: number;
  accepted: number;
  inProgress: number;
  onHold: number;
  completed: number;
}

interface TechnicianStatus {
  technicianId: number;
  technicianName: string;
  checkedIn: boolean;
  checkedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
}

const EODScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const {user} = useAppSelector(state => state.auth);

  const [odometerEnd, setOdometerEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [techStatuses, setTechStatuses] = useState<TechnicianStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    api.get('/api/jobs/summary')
      .then(r => setSummary(r.data))
      .catch(() => {});

    loadTechnicianStatus();
  }, []);

  const loadTechnicianStatus = async () => {
    setLoadingStatus(true);
    try {
      const sessionRes = await api.get('/api/jobs/session');
      const sessionId: number = sessionRes.data.id;
      const statusRes = await api.get(`/api/jobs/session/${sessionId}/technician-status`);
      setTechStatuses(statusRes.data);
    } catch {
      // session may not exist yet — silent fail
    } finally {
      setLoadingStatus(false);
    }
  };

  const allCheckedOut =
    techStatuses.length > 0 && techStatuses.every(t => t.checkedOut);

  const handleSubmit = async () => {
    Alert.alert(
      'End of Day',
      'Are you sure you want to close today\'s session? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Submit EOD',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post('/api/jobs/eod', {
                odometerEnd: odometerEnd ? parseInt(odometerEnd, 10) : null,
                notes: notes || null,
              });
              dispatch(setHasBODToday(false));
              Alert.alert(
                '✅ EOD Complete',
                'Your day has been closed successfully.',
                [{text: 'OK', onPress: () => navigation.navigate('TeamLeadTabs')}],
              );
            } catch (e: any) {
              Alert.alert(
                'EOD Failed',
                e.response?.data?.message || e.message || 'Could not close session',
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--';
    return new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>End of Day</Text>
        <Text style={styles.headerSubtitle}>{user?.name || 'Team Lead'}</Text>
      </View>

      {/* Day Summary */}
      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryItem, {backgroundColor: colors.primary}]}>
              <Text style={styles.summaryValue}>{summary.totalToday}</Text>
              <Text style={styles.summaryLabel}>Total Jobs</Text>
            </View>
            <View style={[styles.summaryItem, {backgroundColor: colors.success}]}>
              <Text style={styles.summaryValue}>{summary.completed}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={[styles.summaryItem, {backgroundColor: colors.warning}]}>
              <Text style={styles.summaryValue}>{summary.inProgress}</Text>
              <Text style={styles.summaryLabel}>In Progress</Text>
            </View>
            <View style={[styles.summaryItem, {backgroundColor: colors.error}]}>
              <Text style={styles.summaryValue}>{summary.onHold + summary.pending}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
          </View>
          {summary.inProgress > 0 || summary.pending > 0 ? (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ {summary.inProgress + summary.pending} job(s) still open — they will be returned to you after EOD.
              </Text>
            </View>
          ) : (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✅ All jobs completed for today!</Text>
            </View>
          )}
        </View>
      )}

      {/* Team Checkout Status */}
      <View style={styles.checkoutCard}>
        <View style={styles.checkoutHeader}>
          <Text style={styles.sectionTitle}>Team Checkout Status</Text>
          <TouchableOpacity onPress={loadTechnicianStatus} disabled={loadingStatus}>
            <Text style={styles.refreshText}>{loadingStatus ? 'Loading...' : '↻ Refresh'}</Text>
          </TouchableOpacity>
        </View>

        {loadingStatus ? (
          <ActivityIndicator color={colors.primary} style={styles.statusLoader} />
        ) : techStatuses.length === 0 ? (
          <Text style={styles.noTechText}>No technicians in today's session.</Text>
        ) : (
          <>
            {techStatuses.map(tech => (
              <View key={tech.technicianId} style={styles.techRow}>
                <View style={styles.techInfo}>
                  <Text style={styles.techName}>{tech.technicianName}</Text>
                  <Text style={styles.techTime}>
                    {tech.checkedIn
                      ? `In: ${formatTime(tech.checkInTime)}${tech.checkedOut ? `  Out: ${formatTime(tech.checkOutTime)}` : ''}`
                      : 'Not checked in'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    tech.checkedOut
                      ? styles.statusPillDone
                      : tech.checkedIn
                      ? styles.statusPillActive
                      : styles.statusPillMissing,
                  ]}>
                  <Text
                    style={[
                      styles.statusPillText,
                      tech.checkedOut
                        ? styles.statusPillTextDone
                        : tech.checkedIn
                        ? styles.statusPillTextActive
                        : styles.statusPillTextMissing,
                    ]}>
                    {tech.checkedOut ? '✓ Done' : tech.checkedIn ? '⏳ Working' : '✕ Absent'}
                  </Text>
                </View>
              </View>
            ))}

            {allCheckedOut ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ All technicians have checked out. Ready for EOD.</Text>
              </View>
            ) : (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  ⚠️ {techStatuses.filter(t => !t.checkedOut).length} technician(s) have not checked out yet.
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Odometer Reading */}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Vehicle Odometer (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ending odometer reading (km)"
          placeholderTextColor={colors.textLight}
          keyboardType="numeric"
          value={odometerEnd}
          onChangeText={setOdometerEnd}
        />
      </View>

      {/* Notes */}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>EOD Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Any notes for today's session..."
          placeholderTextColor={colors.textLight}
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitBtnText}>🌆 Submit EOD & Close Day</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {paddingBottom: 40},
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  backBtn: {marginBottom: spacing.sm},
  backText: {color: colors.white, opacity: 0.8, fontSize: typography.sm},
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.85,
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  warningBanner: {
    backgroundColor: colors.warning + '15',
    borderRadius: 8,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  warningText: {fontSize: typography.sm, color: colors.warning},
  successBanner: {
    backgroundColor: colors.success + '15',
    borderRadius: 8,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  successText: {fontSize: typography.sm, color: colors.success, fontWeight: typography.medium},
  checkoutCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  refreshText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  statusLoader: {marginVertical: spacing.md},
  noTechText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    marginBottom: spacing.xs,
  },
  techInfo: {flex: 1},
  techName: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  techTime: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillDone: {backgroundColor: colors.success + '20'},
  statusPillActive: {backgroundColor: colors.warning + '20'},
  statusPillMissing: {backgroundColor: colors.error + '20'},
  statusPillText: {fontSize: typography.sm, fontWeight: typography.medium},
  statusPillTextDone: {color: colors.success},
  statusPillTextActive: {color: colors.warning},
  statusPillTextMissing: {color: colors.error},
  formCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: colors.error,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {backgroundColor: colors.textLight},
  submitBtnText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

export default EODScreen;
