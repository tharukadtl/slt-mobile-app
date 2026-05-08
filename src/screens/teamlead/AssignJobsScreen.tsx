import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import api from '@services/api';

type Nav = StackNavigationProp<TeamLeadStackParamList>;

interface Fault {
  id: number;
  faultNumber: string;
  customerName?: string;
  description?: string;
  locationAddress?: string;
  locationCity?: string;
  priority?: string;
  status?: string;
}

interface TeamMember {
  id: number;
  technicianId: number;
  technicianName?: string;
  fullName?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

const AssignJobsScreen = () => {
  const navigation = useNavigation<Nav>();

  const [faults, setFaults] = useState<Fault[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // technicianId selected per faultId
  const [selections, setSelections] = useState<Record<number, number>>({});
  // faultIds that have been successfully assigned
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, mRes] = await Promise.all([
        api.get('/api/faults/my'),
        api.get('/api/team/members'),
      ]);
      // Show faults assigned to this team lead that don't yet have a job (not IN_PROGRESS/COMPLETED)
      // ASSIGNED = admin assigned to team lead; IN_PROGRESS = job already dispatched to technician
      const open = (fRes.data as Fault[]).filter(
        f => !['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HOLD'].includes(f.status ?? ''),
      );
      setFaults(open);
      setMembers(mRes.data);
    } catch {
      Alert.alert('Error', 'Failed to load faults or team members');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (fault: Fault) => {
    const technicianId = selections[fault.id];
    if (!technicianId) {
      Alert.alert('Select Technician', 'Please select a technician before assigning.');
      return;
    }

    setAssigning(prev => new Set(prev).add(fault.id));
    try {
      await api.post('/api/jobs', {
        faultId: fault.id,
        technicianId,
        priority: fault.priority,
      });
      setAssigned(prev => new Set(prev).add(fault.id));
    } catch (e: any) {
      Alert.alert(
        'Assignment Failed',
        e.response?.data?.message || e.message || 'Could not assign job',
      );
    } finally {
      setAssigning(prev => {
        const s = new Set(prev);
        s.delete(fault.id);
        return s;
      });
    }
  };

  const allAssigned = faults.length > 0 && faults.every(f => assigned.has(f.id));

  const techName = (m: TeamMember) =>
    m.fullName || m.technicianName || `Tech #${m.technicianId ?? m.id}`;

  const techId = (m: TeamMember) => m.technicianId ?? m.id;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assign Jobs</Text>
        <Text style={styles.headerSubtitle}>
          {faults.length} fault{faults.length !== 1 ? 's' : ''} to assign
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading faults & team…</Text>
        </View>
      ) : faults.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No open faults</Text>
          <Text style={styles.emptySubtitle}>
            No faults are currently assigned to you.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {faults.map(fault => {
            const isAssigned = assigned.has(fault.id);
            const isAssigning = assigning.has(fault.id);
            const selectedTechId = selections[fault.id];
            const priorityColor =
              PRIORITY_COLOR[fault.priority ?? ''] ?? colors.textSecondary;

            return (
              <View
                key={fault.id}
                style={[styles.card, isAssigned && styles.cardAssigned]}>
                {/* Fault Header */}
                <View style={styles.cardHeader}>
                  <Text style={styles.faultNumber}>
                    {fault.faultNumber ?? `#${fault.id}`}
                  </Text>
                  {fault.priority && (
                    <View
                      style={[
                        styles.priorityBadge,
                        {backgroundColor: priorityColor + '20'},
                      ]}>
                      <Text
                        style={[styles.priorityText, {color: priorityColor}]}>
                        {fault.priority}
                      </Text>
                    </View>
                  )}
                  {isAssigned && (
                    <View style={styles.assignedBadge}>
                      <Text style={styles.assignedBadgeText}>✓ Assigned</Text>
                    </View>
                  )}
                </View>

                {/* Fault Details */}
                {fault.customerName && (
                  <Text style={styles.customer}>👤 {fault.customerName}</Text>
                )}
                {fault.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {fault.description}
                  </Text>
                )}
                {(fault.locationCity || fault.locationAddress) && (
                  <Text style={styles.location} numberOfLines={1}>
                    📍 {fault.locationCity || fault.locationAddress}
                  </Text>
                )}

                {!isAssigned && (
                  <>
                    {/* Technician Chips */}
                    <Text style={styles.selectLabel}>Select Technician:</Text>
                    {members.length === 0 ? (
                      <Text style={styles.noMembers}>
                        No team members in today's session
                      </Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipsScroll}>
                        {members.map(m => {
                          const tid = techId(m);
                          const selected = selectedTechId === tid;
                          return (
                            <TouchableOpacity
                              key={tid}
                              style={[
                                styles.chip,
                                selected && styles.chipSelected,
                              ]}
                              onPress={() =>
                                setSelections(prev => ({
                                  ...prev,
                                  [fault.id]: tid,
                                }))
                              }>
                              <Text
                                style={[
                                  styles.chipText,
                                  selected && styles.chipTextSelected,
                                ]}>
                                {techName(m)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {/* Assign Button */}
                    <TouchableOpacity
                      style={[
                        styles.assignBtn,
                        (!selectedTechId || isAssigning) &&
                          styles.assignBtnDisabled,
                      ]}
                      onPress={() => handleAssign(fault)}
                      disabled={!selectedTechId || isAssigning}>
                      {isAssigning ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.assignBtnText}>Assign Job →</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {isAssigned && (
                  <Text style={styles.assignedTo}>
                    Assigned to{' '}
                    {members.find(m => techId(m) === selectedTechId)
                      ? techName(
                          members.find(m => techId(m) === selectedTechId)!,
                        )
                      : 'technician'}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.replace('TeamLeadTabs')}>
          <Text style={styles.doneBtnText}>
            {allAssigned ? '✅ All Done — Go to Dashboard' : 'Skip & Go to Dashboard'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
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
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl},
  loadingText: {marginTop: spacing.md, color: colors.textSecondary, fontSize: typography.md},
  emptyIcon: {fontSize: 48, marginBottom: spacing.md},
  emptyTitle: {fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary},
  emptySubtitle: {fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center'},
  list: {padding: spacing.md, paddingBottom: spacing.xxl},
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardAssigned: {
    borderWidth: 1.5,
    borderColor: colors.success,
    backgroundColor: colors.success + '08',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  faultNumber: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {fontSize: typography.xs, fontWeight: typography.bold},
  assignedBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  assignedBadgeText: {
    color: colors.success,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  customer: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  description: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    marginBottom: 2,
    lineHeight: 18,
  },
  location: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  selectLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  noMembers: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  chipsScroll: {marginBottom: spacing.sm},
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  chipText: {fontSize: typography.sm, color: colors.textSecondary},
  chipTextSelected: {color: colors.primary, fontWeight: typography.bold},
  assignBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  assignBtnDisabled: {backgroundColor: colors.textLight},
  assignBtnText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  assignedTo: {
    fontSize: typography.sm,
    color: colors.success,
    fontWeight: typography.medium,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

export default AssignJobsScreen;
