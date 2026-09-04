import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import api from '@services/api';

type Nav = StackNavigationProp<TeamLeadStackParamList>;

interface MaterialItem {
  materialId: number;
  materialName: string;
  requestedQuantity: number;
  unit: string;
  availableStock?: number;
}

interface PendingRequest {
  id: number;
  requestNumber: string;
  requesterName: string;
  items: MaterialItem[];
  totalQuantity: number;
  urgency: string;
  requesterNotes?: string;
  submittedTimeAgo?: string;
}

// SRS 5.5.3 (v1.9) — a Work Group's Team Lead distributes materials from that
// Work Group's OPMC-allocated balance to their own Technicians (or themself),
// extending the existing Material Request mechanism (5.3.3) rather than
// replacing it. Approval here draws down the Work Group's allocation, not the
// OPMC pool directly (MaterialRequestService.deductForApproval on the backend).
const TeamMaterialRequestsScreen = () => {
  const navigation = useNavigation<Nav>();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Set<number>>(new Set());
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/inventory/material-requests/pending');
      setRequests(res.data?.requests ?? []);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load pending material requests');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const withActing = async (id: number, fn: () => Promise<void>) => {
    setActing(prev => new Set(prev).add(id));
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert(
        'Action Failed',
        e.response?.data?.message || e.message || 'Could not complete this action.',
      );
    } finally {
      setActing(prev => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const approve = (request: PendingRequest) =>
    withActing(request.id, async () => {
      await api.post(`/api/inventory/material-requests/${request.id}/approve`, {
        notifyRequester: true,
      });
    });

  const submitReject = (request: PendingRequest) => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please explain why this request is being rejected.');
      return;
    }
    withActing(request.id, async () => {
      await api.post(`/api/inventory/material-requests/${request.id}/reject`, {
        reason: rejectReason.trim(),
        notifyRequester: true,
      });
      setRejectingId(null);
      setRejectReason('');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Material Requests</Text>
        <Text style={styles.headerSubtitle}>
          {requests.length} pending in your Work Group
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>Nothing pending</Text>
          <Text style={styles.emptySubtitle}>
            No material requests are waiting on your Work Group right now.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {requests.map(r => {
            const isActing = acting.has(r.id);
            const isRejecting = rejectingId === r.id;
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.requestNumber}>{r.requestNumber}</Text>
                  {r.urgency === 'URGENT' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>URGENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.requester}>👤 {r.requesterName}</Text>
                {r.items.map(item => (
                  <Text key={item.materialId} style={styles.item}>
                    • {item.materialName} × {item.requestedQuantity} {item.unit}
                  </Text>
                ))}
                {r.requesterNotes ? (
                  <Text style={styles.notes}>"{r.requesterNotes}"</Text>
                ) : null}
                {r.submittedTimeAgo && (
                  <Text style={styles.timeAgo}>{r.submittedTimeAgo}</Text>
                )}

                {isRejecting ? (
                  <View style={styles.rejectBox}>
                    <TextInput
                      style={styles.rejectInput}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Reason for rejecting (required)"
                      placeholderTextColor={colors.textLight}
                      multiline
                    />
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectBtn, isActing && styles.btnDisabled]}
                        onPress={() => submitReject(r)}
                        disabled={isActing}>
                        {isActing ? (
                          <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                          <Text style={styles.btnText}>Confirm Reject</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, isActing && styles.btnDisabled]}
                      onPress={() => setRejectingId(r.id)}
                      disabled={isActing}>
                      <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, isActing && styles.btnDisabled]}
                      onPress={() => approve(r)}
                      disabled={isActing}>
                      {isActing ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.btnText}>✓ Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
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
  backBtn: {marginBottom: spacing.xs},
  backBtnText: {color: colors.white, fontSize: typography.md},
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  requestNumber: {fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary},
  urgentBadge: {
    backgroundColor: '#ef444420',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  urgentBadgeText: {color: '#ef4444', fontSize: typography.xs, fontWeight: typography.bold},
  requester: {fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.xs},
  item: {fontSize: typography.sm, color: colors.textPrimary, lineHeight: 20},
  notes: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  timeAgo: {fontSize: typography.xs, color: colors.textLight, marginTop: spacing.xs},
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: {opacity: 0.6},
  btnText: {color: colors.white, fontSize: typography.sm, fontWeight: typography.bold},
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {color: colors.textSecondary, fontSize: typography.sm},
  rejectBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rejectInput: {
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
});

export default TeamMaterialRequestsScreen;
