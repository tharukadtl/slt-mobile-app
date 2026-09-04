import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
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
  workGroupId?: number;
  workGroupName?: string;
  assignedTeamLeadId?: number;
  assignedTeamLeadName?: string;
  circuitId?: number;
  circuitCode?: string;
}

interface TeamMember {
  id: number;
  technicianId: number;
  technicianName?: string;
  fullName?: string;
}

// H1c — hierarchy levels for the cascading Circuit picker (Opmc/Exchange/Cab/Dp share the same
// shape: id/code/name; Circuit adds an optional category code).
interface HierarchyItem {
  id: number;
  code: string;
  name: string;
}
interface CircuitItem {
  id: number;
  code: string;
  circuitCategoryCode?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

// SRS 5.5.1 (Stage D) — a fault reaches a Work Group's queue as a whole, not a
// specific person. The Team Lead here either self-assigns it directly ("Assign
// to Me") or dispatches it straight to one of their own Technicians; both are
// valid, independent ways to claim a queued fault, not a required sequence.
const AssignJobsScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<TeamLeadStackParamList, 'AssignJobs'>>();
  // When opened via "Reassign" from the Needs Attention / Team Jobs queue, the
  // target fault is passed so we can scroll to and highlight it. Absent when
  // opened from the header "Assign" button (params === undefined).
  const targetFaultId = route.params?.faultId
    ? Number(route.params.faultId)
    : undefined;

  const [faults, setFaults] = useState<Fault[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  // Captured y-offset of each fault card, so we can scroll the target into view
  // once the list has rendered.
  const cardOffsets = useRef<Record<number, number>>({});

  useEffect(() => {
    if (loading || targetFaultId == null) {
      return;
    }
    const y = cardOffsets.current[targetFaultId];
    if (y != null) {
      const id = setTimeout(
        () => scrollRef.current?.scrollTo({y, animated: true}),
        300,
      );
      return () => clearTimeout(id);
    }
  }, [loading, targetFaultId, faults]);

  // technicianId selected per faultId
  const [selections, setSelections] = useState<Record<number, number>>({});
  // faultIds that have been successfully dispatched to a Technician this session
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState<Set<number>>(new Set());
  const [claiming, setClaiming] = useState<Set<number>>(new Set());
  // faultId currently showing its "Transfer to Admin" reason box
  const [transferringFaultId, setTransferringFaultId] = useState<number | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, mRes] = await Promise.all([
        api.get('/api/faults/my-workgroup'),
        api.get('/api/team/members'),
      ]);
      setFaults(fRes.data as Fault[]);
      setMembers(mRes.data);
    } catch {
      Alert.alert('Error', 'Failed to load faults or team members');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (fault: Fault) => {
    setClaiming(prev => new Set(prev).add(fault.id));
    try {
      await api.post(`/api/faults/${fault.id}/self-assign`, {});
      await load();
    } catch (e: any) {
      Alert.alert(
        'Could Not Claim Fault',
        e.response?.data?.message || e.message || 'This fault may have already been claimed.',
      );
    } finally {
      setClaiming(prev => {
        const s = new Set(prev);
        s.delete(fault.id);
        return s;
      });
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

  const submitTransfer = async (fault: Fault) => {
    if (!transferReason.trim()) {
      Alert.alert('Reason Required', 'Please explain why this fault is being transferred back to Admin.');
      return;
    }
    setTransferSubmitting(true);
    try {
      await api.post(`/api/faults/${fault.id}/transfer-to-admin`, {
        reason: transferReason.trim(),
      });
      setTransferringFaultId(null);
      setTransferReason('');
      await load();
    } catch (e: any) {
      Alert.alert(
        'Transfer Failed',
        e.response?.data?.message || e.message || 'Could not transfer this fault to Admin',
      );
    } finally {
      setTransferSubmitting(false);
    }
  };

  // H1c — cascading Opmc -> Exchange -> Cab -> Dp -> Circuit picker, opened from a fault card's
  // "Attach Circuit" action. Modal-based (not inline in the card) since a 5-level cascade with
  // dynamically-loaded lists doesn't fit cleanly inside the card's own ScrollView; chip-row
  // selection reuses this screen's own existing technician-chip pattern rather than introducing
  // a Picker dependency (none is installed in this app).
  const [circuitFaultId, setCircuitFaultId] = useState<number | null>(null);
  const [circOpmcs, setCircOpmcs] = useState<HierarchyItem[]>([]);
  const [circExchanges, setCircExchanges] = useState<HierarchyItem[]>([]);
  const [circCabs, setCircCabs] = useState<HierarchyItem[]>([]);
  const [circDps, setCircDps] = useState<HierarchyItem[]>([]);
  const [circCircuits, setCircCircuits] = useState<CircuitItem[]>([]);
  const [selOpmc, setSelOpmc] = useState<number | null>(null);
  const [selExchange, setSelExchange] = useState<number | null>(null);
  const [selCab, setSelCab] = useState<number | null>(null);
  const [selDp, setSelDp] = useState<number | null>(null);
  const [selCircuit, setSelCircuit] = useState<number | null>(null);
  const [circLoading, setCircLoading] = useState<string | null>(null);
  const [attachingCircuit, setAttachingCircuit] = useState(false);

  const openCircuitPicker = (fault: Fault) => {
    setCircuitFaultId(fault.id);
    setCircExchanges([]); setCircCabs([]); setCircDps([]); setCircCircuits([]);
    setSelOpmc(null); setSelExchange(null); setSelCab(null); setSelDp(null); setSelCircuit(null);
    if (circOpmcs.length === 0) {
      setCircLoading('opmc');
      api.get('/api/opmcs?status=ACTIVE')
        .then(r => setCircOpmcs(r.data as HierarchyItem[]))
        .catch(() => Alert.alert('Error', 'Could not load OPMCs'))
        .finally(() => setCircLoading(null));
    }
  };

  const selectOpmc = (id: number) => {
    setSelOpmc(id);
    setSelExchange(null); setSelCab(null); setSelDp(null); setSelCircuit(null);
    setCircCabs([]); setCircDps([]); setCircCircuits([]);
    setCircLoading('exchange');
    api.get(`/api/exchanges?opmcId=${id}`)
      .then(r => setCircExchanges(r.data as HierarchyItem[]))
      .catch(() => Alert.alert('Error', 'Could not load Exchanges'))
      .finally(() => setCircLoading(null));
  };

  const selectExchange = (id: number) => {
    setSelExchange(id);
    setSelCab(null); setSelDp(null); setSelCircuit(null);
    setCircDps([]); setCircCircuits([]);
    setCircLoading('cab');
    api.get(`/api/cabs?exchangeId=${id}`)
      .then(r => setCircCabs(r.data as HierarchyItem[]))
      .catch(() => Alert.alert('Error', 'Could not load Cabs'))
      .finally(() => setCircLoading(null));
  };

  const selectCab = (id: number) => {
    setSelCab(id);
    setSelDp(null); setSelCircuit(null);
    setCircCircuits([]);
    setCircLoading('dp');
    api.get(`/api/dps?cabId=${id}`)
      .then(r => setCircDps(r.data as HierarchyItem[]))
      .catch(() => Alert.alert('Error', 'Could not load DPs'))
      .finally(() => setCircLoading(null));
  };

  const selectDp = (id: number) => {
    setSelDp(id);
    setSelCircuit(null);
    setCircLoading('circuit');
    // DP:Circuit is close to 1:1 in the real data (H1a's master-data import) — auto-select when
    // there's exactly one, skipping a redundant tap in the common case.
    api.get(`/api/circuits?dpId=${id}`)
      .then(r => {
        const list = r.data as CircuitItem[];
        setCircCircuits(list);
        if (list.length === 1) setSelCircuit(list[0].id);
      })
      .catch(() => Alert.alert('Error', 'Could not load Circuits'))
      .finally(() => setCircLoading(null));
  };

  const attachCircuit = async () => {
    if (!selCircuit || circuitFaultId == null) return;
    setAttachingCircuit(true);
    try {
      await api.patch(`/api/faults/${circuitFaultId}/circuit`, {circuitId: selCircuit});
      setCircuitFaultId(null);
      await load();
    } catch (e: any) {
      Alert.alert(
        'Attach Failed',
        e.response?.data?.message || e.message || 'Could not attach this Circuit',
      );
    } finally {
      setAttachingCircuit(false);
    }
  };

  const allAssigned = faults.length > 0 && faults.every(f => assigned.has(f.id) || f.assignedTeamLeadId);

  const techName = (m: TeamMember) =>
    m.fullName || m.technicianName || `Tech #${m.technicianId ?? m.id}`;

  const techId = (m: TeamMember) => m.technicianId ?? m.id;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Work Group Queue</Text>
        <Text style={styles.headerSubtitle}>
          {faults.length} fault{faults.length !== 1 ? 's' : ''} in your Work Group's queue
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
            No faults are currently in your Work Group's queue.
          </Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
          {faults.map(fault => {
            const isClaimedByMe = !!fault.assignedTeamLeadId;
            const isAssigned = assigned.has(fault.id);
            const isAssigning = assigning.has(fault.id);
            const isClaiming = claiming.has(fault.id);
            const selectedTechId = selections[fault.id];
            const isTarget = fault.id === targetFaultId;
            const isTransferring = transferringFaultId === fault.id;
            const priorityColor =
              PRIORITY_COLOR[fault.priority ?? ''] ?? colors.textSecondary;

            return (
              <View
                key={fault.id}
                onLayout={e => {
                  cardOffsets.current[fault.id] = e.nativeEvent.layout.y;
                }}
                style={[
                  styles.card,
                  isAssigned && styles.cardAssigned,
                  isTarget && styles.cardTarget,
                ]}>
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
                  {!isClaimedByMe && (
                    <View style={styles.unclaimedBadge}>
                      <Text style={styles.unclaimedBadgeText}>Unclaimed</Text>
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

                {/* H1c — attach the real Circuit this fault's infrastructure runs through.
                    Independent of assignment state, so shown regardless of claim/assign status. */}
                <TouchableOpacity
                  style={styles.circuitLink}
                  onPress={() => openCircuitPicker(fault)}>
                  <Text style={styles.circuitLinkText}>
                    {fault.circuitCode ? `🔗 Circuit ${fault.circuitCode} — change` : '🔗 Add Circuit'}
                  </Text>
                </TouchableOpacity>

                {/* Unclaimed: "Assign to Me" is the primary action, dispatch is still available below */}
                {!isClaimedByMe && (
                  <TouchableOpacity
                    style={[styles.claimBtn, isClaiming && styles.assignBtnDisabled]}
                    onPress={() => handleClaim(fault)}
                    disabled={isClaiming}>
                    {isClaiming ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.assignBtnText}>🙋 Assign to Me</Text>
                    )}
                  </TouchableOpacity>
                )}

                {!isAssigned && (
                  <>
                    {/* Technician Chips — dispatch works whether or not you've self-assigned first */}
                    <Text style={styles.selectLabel}>Or dispatch to a Technician:</Text>
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

                {/* Transfer to Admin — SRS 5.5.1: a Work Group that cannot resolve this
                    fault (e.g. it needs a specialization or resource they lack) can hand
                    it back for the Admin to reassign to a different Work Group. */}
                {!isAssigned && (
                  isTransferring ? (
                    <View style={styles.transferBox}>
                      <Text style={styles.transferLabel}>
                        Reason for transferring back to Admin *
                      </Text>
                      <TextInput
                        style={styles.transferInput}
                        value={transferReason}
                        onChangeText={setTransferReason}
                        placeholder="e.g. requires fiber splicing specialization we don't have"
                        placeholderTextColor={colors.textLight}
                        multiline
                      />
                      <View style={styles.transferActions}>
                        <TouchableOpacity
                          style={styles.transferCancelBtn}
                          onPress={() => {
                            setTransferringFaultId(null);
                            setTransferReason('');
                          }}>
                          <Text style={styles.transferCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.transferSubmitBtn,
                            (!transferReason.trim() || transferSubmitting) && styles.assignBtnDisabled,
                          ]}
                          onPress={() => submitTransfer(fault)}
                          disabled={!transferReason.trim() || transferSubmitting}>
                          {transferSubmitting ? (
                            <ActivityIndicator color={colors.white} size="small" />
                          ) : (
                            <Text style={styles.assignBtnText}>Transfer</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.transferLink}
                      onPress={() => setTransferringFaultId(fault.id)}>
                      <Text style={styles.transferLinkText}>↩️ Can't resolve this — Transfer to Admin</Text>
                    </TouchableOpacity>
                  )
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

      {/* H1c — Circuit picker modal */}
      <Modal
        visible={circuitFaultId != null}
        animationType="slide"
        transparent
        onRequestClose={() => setCircuitFaultId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Attach Circuit</Text>
            <Text style={styles.modalSubtitle}>
              Pick each level in order — each selection filters the next.
            </Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.selectLabel}>OPMC</Text>
              {circLoading === 'opmc' ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ChipRow
                  items={circOpmcs}
                  selectedId={selOpmc}
                  onSelect={item => selectOpmc(item.id)}
                />
              )}

              {selOpmc != null && (
                <>
                  <Text style={styles.selectLabel}>Exchange</Text>
                  {circLoading === 'exchange' ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : circExchanges.length === 0 ? (
                    <Text style={styles.noMembers}>No Exchanges for this OPMC</Text>
                  ) : (
                    <ChipRow
                      items={circExchanges}
                      selectedId={selExchange}
                      onSelect={item => selectExchange(item.id)}
                    />
                  )}
                </>
              )}

              {selExchange != null && (
                <>
                  <Text style={styles.selectLabel}>Cab</Text>
                  {circLoading === 'cab' ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : circCabs.length === 0 ? (
                    <Text style={styles.noMembers}>No Cabs for this Exchange</Text>
                  ) : (
                    <ChipRow
                      items={circCabs}
                      selectedId={selCab}
                      onSelect={item => selectCab(item.id)}
                    />
                  )}
                </>
              )}

              {selCab != null && (
                <>
                  <Text style={styles.selectLabel}>DP</Text>
                  {circLoading === 'dp' ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : circDps.length === 0 ? (
                    <Text style={styles.noMembers}>No DPs for this Cab</Text>
                  ) : (
                    <ChipRow
                      items={circDps}
                      selectedId={selDp}
                      onSelect={item => selectDp(item.id)}
                    />
                  )}
                </>
              )}

              {selDp != null && (
                <>
                  <Text style={styles.selectLabel}>Circuit</Text>
                  {circLoading === 'circuit' ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : circCircuits.length === 0 ? (
                    <Text style={styles.noMembers}>No Circuits for this DP</Text>
                  ) : (
                    <ChipRow
                      items={circCircuits.map(c => ({
                        id: c.id,
                        code: c.code,
                        name: c.circuitCategoryCode || '',
                      }))}
                      selectedId={selCircuit}
                      onSelect={item => setSelCircuit(item.id)}
                    />
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.transferCancelBtn}
                onPress={() => setCircuitFaultId(null)}>
                <Text style={styles.transferCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.assignBtn,
                  styles.modalAttachBtn,
                  (!selCircuit || attachingCircuit) && styles.assignBtnDisabled,
                ]}
                onPress={attachCircuit}
                disabled={!selCircuit || attachingCircuit}>
                {attachingCircuit ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.assignBtnText}>🔗 Attach Circuit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// H1c — one row of selectable chips, reusing the technician-chip visual language already
// established in this screen (styles.chip/chipSelected/chipText/chipTextSelected).
const ChipRow = ({
  items,
  selectedId,
  onSelect,
}: {
  items: HierarchyItem[];
  selectedId: number | null;
  onSelect: (item: HierarchyItem) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
    {items.map(item => {
      const selected = selectedId === item.id;
      return (
        <TouchableOpacity
          key={item.id}
          style={[styles.chip, selected && styles.chipSelected]}
          onPress={() => onSelect(item)}>
          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
            {item.code}{item.name ? ` — ${item.name}` : ''}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

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
  cardTarget: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
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
  unclaimedBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unclaimedBadgeText: {
    color: colors.primary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
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
  claimBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.xs,
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
  transferLink: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  transferLinkText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  circuitLink: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  circuitLinkText: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  modalScroll: {
    maxHeight: 380,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalAttachBtn: {
    marginTop: 0,
    paddingHorizontal: spacing.lg,
  },
  transferBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transferLabel: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  transferInput: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  transferActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  transferCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  transferCancelText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  transferSubmitBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
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
