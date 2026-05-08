import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTargets} from '@store/slices/technicianSlice';
import {Target} from '@appTypes/technician.types';
import {formatCurrency} from '@utils/formatters';

const PERIODS = [
  {label: 'Daily', value: 'DAILY'},
  {label: 'Weekly', value: 'WEEKLY'},
  {label: 'Monthly', value: 'MONTHLY'},
];

const getTargetStatusColor = (status: string) => {
  switch (status) {
    case 'ACHIEVED': return colors.success;
    case 'ON_TRACK': return colors.secondary;
    case 'AT_RISK': return colors.warning;
    case 'BEHIND': return colors.error;
    default: return colors.textSecondary;
  }
};

const getTargetStatusIcon = (status: string) => {
  switch (status) {
    case 'ACHIEVED': return '🏆';
    case 'ON_TRACK': return '✅';
    case 'AT_RISK': return '⚠️';
    case 'BEHIND': return '❌';
    default: return '📊';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'JOBS': return '📋';
    case 'TIME': return '⏱️';
    case 'SATISFACTION': return '⭐';
    case 'REVENUE': return '💰';
    default: return '📊';
  }
};

// Mock personal KPI data
const MOCK_DAILY_KPI = {
  completedJobs: 8,
  totalJobs: 10,
  completionRate: 80,
  avgJobDuration: 2.1,
  avgResponseTime: 18,
  customerSatisfaction: 4.7,
  onTimeCompletion: 87,
  totalRevenue: 25000,
};

const MOCK_WEEKLY_KPI = {
  completedJobs: 38,
  totalJobs: 45,
  completionRate: 84,
  avgJobDuration: 2.3,
  avgResponseTime: 22,
  customerSatisfaction: 4.5,
  onTimeCompletion: 83,
  totalRevenue: 112000,
};

const MOCK_MONTHLY_KPI = {
  completedJobs: 152,
  totalJobs: 180,
  completionRate: 84,
  avgJobDuration: 2.4,
  avgResponseTime: 25,
  customerSatisfaction: 4.6,
  onTimeCompletion: 85,
  totalRevenue: 450000,
};

const MOCK_TARGETS: Target[] = [
  {
    id: '1',
    title: 'Daily Job Completion',
    description: 'Complete at least 10 jobs per day',
    targetValue: 10,
    currentValue: 8,
    unit: 'jobs',
    period: 'DAILY',
    category: 'JOBS',
    assignedBy: 'Team Lead',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'AT_RISK',
  },
  {
    id: '2',
    title: 'Response Time',
    description: 'Keep average response time under 20 minutes',
    targetValue: 20,
    currentValue: 18,
    unit: 'mins',
    period: 'DAILY',
    category: 'TIME',
    assignedBy: 'Admin',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'ON_TRACK',
  },
  {
    id: '3',
    title: 'Weekly Jobs Target',
    description: 'Complete 45 jobs per week',
    targetValue: 45,
    currentValue: 38,
    unit: 'jobs',
    period: 'WEEKLY',
    category: 'JOBS',
    assignedBy: 'Team Lead',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'AT_RISK',
  },
  {
    id: '4',
    title: 'Customer Satisfaction',
    description: 'Maintain 4.5+ star rating',
    targetValue: 4.5,
    currentValue: 4.7,
    unit: 'stars',
    period: 'WEEKLY',
    category: 'SATISFACTION',
    assignedBy: 'Admin',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'ACHIEVED',
  },
  {
    id: '5',
    title: 'On-Time Completion',
    description: 'Complete 90% of jobs on time',
    targetValue: 90,
    currentValue: 85,
    unit: '%',
    period: 'WEEKLY',
    category: 'TIME',
    assignedBy: 'Admin',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'AT_RISK',
  },
  {
    id: '6',
    title: 'Monthly Revenue',
    description: 'Generate LKR 500,000 in monthly revenue',
    targetValue: 500000,
    currentValue: 450000,
    unit: 'LKR',
    period: 'MONTHLY',
    category: 'REVENUE',
    assignedBy: 'Admin',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'AT_RISK',
  },
  {
    id: '7',
    title: 'Monthly Job Completion',
    description: 'Complete 180 jobs per month',
    targetValue: 180,
    currentValue: 152,
    unit: 'jobs',
    period: 'MONTHLY',
    category: 'JOBS',
    assignedBy: 'Team Lead',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'AT_RISK',
  },
];

const TechnicianKPITargetsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const {targets, isLoading} = useAppSelector(
    state => state.technician,
  );
  const {user} = useAppSelector(state => state.auth);

  const [selectedPeriod, setSelectedPeriod] = useState('DAILY');

  useEffect(() => {
    dispatch(fetchTargets());
  }, []);

  const allTargets =
    targets.length > 0 ? targets : MOCK_TARGETS;
  const filteredTargets = allTargets.filter(
    t => t.period === selectedPeriod,
  );

  const getKPIForPeriod = () => {
    switch (selectedPeriod) {
      case 'DAILY': return MOCK_DAILY_KPI;
      case 'WEEKLY': return MOCK_WEEKLY_KPI;
      case 'MONTHLY': return MOCK_MONTHLY_KPI;
      default: return MOCK_DAILY_KPI;
    }
  };

  const kpi = getKPIForPeriod();

  const achievedCount = filteredTargets.filter(
    t => t.status === 'ACHIEVED',
  ).length;
  const onTrackCount = filteredTargets.filter(
    t => t.status === 'ON_TRACK',
  ).length;
  const atRiskCount = filteredTargets.filter(
    t => t.status === 'AT_RISK',
  ).length;
  const behindCount = filteredTargets.filter(
    t => t.status === 'BEHIND',
  ).length;

  const renderProgressBar = (
    current: number,
    target: number,
    color: string,
  ) => {
    const progress = Math.min((current / target) * 100, 100);
    return (
      <View style={styles.progressBarRow}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {width: `${progress}%`, backgroundColor: color},
            ]}
          />
        </View>
        <Text
          style={[styles.progressPercent, {color}]}>
          {progress.toFixed(0)}%
        </Text>
      </View>
    );
  };

  const renderStarRating = (rating: number) => {
    return (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <Text
            key={star}
            style={[
              styles.star,
              {
                color:
                  star <= Math.floor(rating)
                    ? '#FFD700'
                    : star - 0.5 <= rating
                    ? '#FFD700'
                    : colors.border,
              },
            ]}>
            ★
          </Text>
        ))}
        <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => dispatch(fetchTargets())}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          KPI & My Targets
        </Text>
        <Text style={styles.headerSubtitle}>
          {user?.name || 'Technician'} — Performance Dashboard
        </Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIODS.map(period => (
          <TouchableOpacity
            key={period.value}
            style={[
              styles.periodButton,
              selectedPeriod === period.value &&
                styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.value)}>
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.value &&
                  styles.periodButtonTextActive,
              ]}>
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {/* Performance Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardLeft}>
            <Text style={styles.scoreCardTitle}>
              Overall Performance
            </Text>
            <Text style={styles.scoreCardPeriod}>
              {selectedPeriod} Summary
            </Text>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>
                {kpi.completionRate}%
              </Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>
          <View style={styles.scoreCardRight}>
            <View style={styles.scoreStatRow}>
              <Text style={styles.scoreStatIcon}>📋</Text>
              <View>
                <Text style={styles.scoreStatValue}>
                  {kpi.completedJobs}/{kpi.totalJobs}
                </Text>
                <Text style={styles.scoreStatLabel}>Jobs</Text>
              </View>
            </View>
            <View style={styles.scoreStatRow}>
              <Text style={styles.scoreStatIcon}>⏱️</Text>
              <View>
                <Text style={styles.scoreStatValue}>
                  {kpi.avgJobDuration.toFixed(1)}h
                </Text>
                <Text style={styles.scoreStatLabel}>Avg Time</Text>
              </View>
            </View>
            <View style={styles.scoreStatRow}>
              <Text style={styles.scoreStatIcon}>⭐</Text>
              <View>
                <Text style={styles.scoreStatValue}>
                  {kpi.customerSatisfaction.toFixed(1)}
                </Text>
                <Text style={styles.scoreStatLabel}>Rating</Text>
              </View>
            </View>
          </View>
        </View>

        {/* KPI Metrics Grid */}
        <Text style={styles.sectionTitle}>
          📊 Performance Metrics
        </Text>
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.primary},
            ]}>
            <Text style={styles.kpiCardIcon}>📋</Text>
            <Text style={styles.kpiCardValue}>
              {kpi.completedJobs}
            </Text>
            <Text style={styles.kpiCardLabel}>
              Jobs Completed
            </Text>
            <Text style={styles.kpiCardSub}>
              of {kpi.totalJobs} total
            </Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  kpi.completionRate >= 90
                    ? colors.success
                    : kpi.completionRate >= 75
                    ? colors.warning
                    : colors.error,
              },
            ]}>
            <Text style={styles.kpiCardIcon}>🎯</Text>
            <Text style={styles.kpiCardValue}>
              {kpi.completionRate}%
            </Text>
            <Text style={styles.kpiCardLabel}>
              Completion Rate
            </Text>
            <Text style={styles.kpiCardSub}>
              {kpi.completionRate >= 90
                ? 'Excellent'
                : kpi.completionRate >= 75
                ? 'Good'
                : 'Needs Work'}
            </Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  kpi.avgResponseTime <= 20
                    ? colors.success
                    : kpi.avgResponseTime <= 30
                    ? colors.warning
                    : colors.error,
              },
            ]}>
            <Text style={styles.kpiCardIcon}>⚡</Text>
            <Text style={styles.kpiCardValue}>
              {kpi.avgResponseTime}m
            </Text>
            <Text style={styles.kpiCardLabel}>Avg Response</Text>
            <Text style={styles.kpiCardSub}>
              {kpi.avgResponseTime <= 20
                ? 'Excellent'
                : kpi.avgResponseTime <= 30
                ? 'Good'
                : 'Improve'}
            </Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.secondary},
            ]}>
            <Text style={styles.kpiCardIcon}>⏱️</Text>
            <Text style={styles.kpiCardValue}>
              {kpi.avgJobDuration.toFixed(1)}h
            </Text>
            <Text style={styles.kpiCardLabel}>Avg Duration</Text>
            <Text style={styles.kpiCardSub}>Per job</Text>
          </View>
        </View>

        {/* Customer Satisfaction */}
        <View style={styles.satisfactionCard}>
          <View style={styles.satisfactionHeader}>
            <Text style={styles.satisfactionTitle}>
              ⭐ Customer Satisfaction
            </Text>
            <Text style={styles.satisfactionValue}>
              {kpi.customerSatisfaction.toFixed(1)}/5.0
            </Text>
          </View>
          {renderStarRating(kpi.customerSatisfaction)}
          <View style={styles.satisfactionBar}>
            <View style={styles.satisfactionBarBg}>
              <View
                style={[
                  styles.satisfactionBarFill,
                  {
                    width: `${
                      (kpi.customerSatisfaction / 5) * 100
                    }%`,
                    backgroundColor:
                      kpi.customerSatisfaction >= 4.5
                        ? colors.success
                        : kpi.customerSatisfaction >= 3.5
                        ? colors.warning
                        : colors.error,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={styles.satisfactionHint}>
            {kpi.customerSatisfaction >= 4.5
              ? '🌟 Outstanding performance!'
              : kpi.customerSatisfaction >= 4.0
              ? '👍 Good customer service'
              : '📈 Work on customer satisfaction'}
          </Text>
        </View>

        {/* On-Time Completion */}
        <View style={styles.onTimeCard}>
          <View style={styles.onTimeHeader}>
            <Text style={styles.onTimeTitle}>
              ⏰ On-Time Completion
            </Text>
            <Text
              style={[
                styles.onTimeValue,
                {
                  color:
                    kpi.onTimeCompletion >= 90
                      ? colors.success
                      : kpi.onTimeCompletion >= 75
                      ? colors.warning
                      : colors.error,
                },
              ]}>
              {kpi.onTimeCompletion}%
            </Text>
          </View>
          {renderProgressBar(
            kpi.onTimeCompletion,
            100,
            kpi.onTimeCompletion >= 90
              ? colors.success
              : kpi.onTimeCompletion >= 75
              ? colors.warning
              : colors.error,
          )}
          <Text style={styles.onTimeHint}>
            Target: 90% on-time completion
          </Text>
        </View>

        {/* Revenue Card */}
        {selectedPeriod !== 'DAILY' && (
          <View style={styles.revenueCard}>
            <Text style={styles.revenueTitle}>
              💰 Revenue Generated
            </Text>
            <Text style={styles.revenueValue}>
              {formatCurrency(kpi.totalRevenue)}
            </Text>
            <Text style={styles.revenuePeriod}>
              {selectedPeriod === 'WEEKLY'
                ? 'This week'
                : 'This month'}
            </Text>
          </View>
        )}

        {/* Targets Status Summary */}
        <Text style={styles.sectionTitle}>
          🎯 Targets Overview
        </Text>
        <View style={styles.targetsSummary}>
          <View
            style={[
              styles.targetSummaryItem,
              {backgroundColor: colors.success + '15'},
            ]}>
            <Text style={styles.targetSummaryValue}>
              {achievedCount}
            </Text>
            <Text style={styles.targetSummaryLabel}>
              🏆 Achieved
            </Text>
          </View>
          <View
            style={[
              styles.targetSummaryItem,
              {backgroundColor: colors.secondary + '15'},
            ]}>
            <Text style={styles.targetSummaryValue}>
              {onTrackCount}
            </Text>
            <Text style={styles.targetSummaryLabel}>
              ✅ On Track
            </Text>
          </View>
          <View
            style={[
              styles.targetSummaryItem,
              {backgroundColor: colors.warning + '15'},
            ]}>
            <Text style={styles.targetSummaryValue}>
              {atRiskCount}
            </Text>
            <Text style={styles.targetSummaryLabel}>
              ⚠️ At Risk
            </Text>
          </View>
          <View
            style={[
              styles.targetSummaryItem,
              {backgroundColor: colors.error + '15'},
            ]}>
            <Text style={styles.targetSummaryValue}>
              {behindCount}
            </Text>
            <Text style={styles.targetSummaryLabel}>
              ❌ Behind
            </Text>
          </View>
        </View>

        {/* Individual Targets */}
        <Text style={styles.sectionTitle}>
          📌 Assigned Targets
        </Text>
        {filteredTargets.length === 0 ? (
          <View style={styles.emptyTargets}>
            <Text style={styles.emptyTargetsIcon}>🎯</Text>
            <Text style={styles.emptyTargetsText}>
              No targets for this period
            </Text>
          </View>
        ) : (
          filteredTargets.map(target => (
            <View key={target.id} style={styles.targetCard}>
              {/* Target Header */}
              <View style={styles.targetHeader}>
                <View style={styles.targetTitleRow}>
                  <Text style={styles.targetCategoryIcon}>
                    {getCategoryIcon(target.category)}
                  </Text>
                  <Text style={styles.targetTitle}>
                    {target.title}
                  </Text>
                </View>
                <View
                  style={[
                    styles.targetStatusBadge,
                    {
                      backgroundColor:
                        getTargetStatusColor(target.status) +
                        '20',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.targetStatusText,
                      {
                        color: getTargetStatusColor(
                          target.status,
                        ),
                      },
                    ]}>
                    {getTargetStatusIcon(target.status)}{' '}
                    {target.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.targetDescription}>
                {target.description}
              </Text>

              {/* Progress */}
              <View style={styles.targetProgressSection}>
                <View style={styles.targetValuesRow}>
                  <Text style={styles.targetCurrentVal}>
                    {target.category === 'REVENUE'
                      ? formatCurrency(target.currentValue)
                      : `${target.currentValue} ${target.unit}`}
                  </Text>
                  <Text style={styles.targetSeparator}>/</Text>
                  <Text style={styles.targetGoalVal}>
                    {target.category === 'REVENUE'
                      ? formatCurrency(target.targetValue)
                      : `${target.targetValue} ${target.unit}`}
                  </Text>
                </View>
                {renderProgressBar(
                  target.currentValue,
                  target.targetValue,
                  getTargetStatusColor(target.status),
                )}
              </View>

              {/* Footer */}
              <View style={styles.targetFooter}>
                <Text style={styles.targetAssignedBy}>
                  👤 {target.assignedBy}
                </Text>
                <Text style={styles.targetDueDate}>
                  📅 Due: {target.dueDate}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Performance Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>
            💡 Performance Tips
          </Text>
          {[
            {
              icon: '🚀',
              tip: 'Complete jobs faster to improve your completion rate',
            },
            {
              icon: '😊',
              tip: 'Be courteous to customers to maintain high satisfaction',
            },
            {
              icon: '⏰',
              tip: 'Notify customers before arrival to improve punctuality',
            },
            {
              icon: '📱',
              tip: 'Update job status in real-time for better tracking',
            },
          ].map((item, index) => (
            <View key={index} style={styles.tipRow}>
              <Text style={styles.tipIcon}>{item.icon}</Text>
              <Text style={styles.tipText}>{item.tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  backText: {
    color: colors.white,
    fontSize: typography.md,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: 10,
    padding: spacing.xs,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  content: {
    padding: spacing.md,
    paddingTop: 0,
  },
  scoreCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCardLeft: {
    flex: 1,
    alignItems: 'center',
  },
  scoreCardTitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginBottom: spacing.xs,
  },
  scoreCardPeriod: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.6,
    marginBottom: spacing.md,
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.white + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white + '40',
  },
  scoreValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  scoreLabel: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
  },
  scoreCardRight: {
    flex: 1,
    paddingLeft: spacing.lg,
    gap: spacing.md,
  },
  scoreStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreStatIcon: {
    fontSize: 20,
  },
  scoreStatValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
  scoreStatLabel: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: {
    width: '47.5%',
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  kpiCardIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  kpiCardValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  kpiCardLabel: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.medium,
    textAlign: 'center',
    marginTop: 2,
  },
  kpiCardSub: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
  satisfactionCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  satisfactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  satisfactionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  satisfactionValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: '#FFD700',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  star: {
    fontSize: 24,
  },
  ratingValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  satisfactionBar: {
    marginBottom: spacing.sm,
  },
  satisfactionBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  satisfactionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  satisfactionHint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  onTimeCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  onTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  onTimeTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  onTimeValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  onTimeHint: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  revenueCard: {
    backgroundColor: colors.success,
    borderRadius: 10,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  revenueTitle: {
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.sm,
  },
  revenueValue: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  revenuePeriod: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  targetsSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  targetSummaryItem: {
    flex: 1,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  targetSummaryValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  targetSummaryLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  targetCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  targetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  targetCategoryIcon: {
    fontSize: 20,
  },
  targetTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  targetStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  targetStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  targetDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeightMd,
  },
  targetProgressSection: {
    marginBottom: spacing.sm,
  },
  targetValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  targetCurrentVal: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  targetSeparator: {
    fontSize: typography.md,
    color: colors.textLight,
    marginHorizontal: spacing.xs,
  },
  targetGoalVal: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    width: 35,
    textAlign: 'right',
  },
  targetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  targetAssignedBy: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  targetDueDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  emptyTargets: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTargetsIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTargetsText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  tipsCard: {
    backgroundColor: colors.secondary + '15',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  tipsTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tipIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeightMd,
  },
});

export default TechnicianKPITargetsScreen;