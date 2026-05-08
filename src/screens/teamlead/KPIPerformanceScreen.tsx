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
import {fetchTeamKPI, fetchTargets} from '@store/slices/technicianSlice';
import {Target, TechnicianKPI} from '@appTypes/technician.types';

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

const KPIPerformanceScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const {teamKPI, targets, isLoading} = useAppSelector(
    state => state.technician,
  );

  const [selectedPeriod, setSelectedPeriod] = useState('DAILY');
  const [expandedTechnician, setExpandedTechnician] = useState
    string | null
  >(null);

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = () => {
    dispatch(fetchTeamKPI(selectedPeriod));
    dispatch(fetchTargets());
  };

  // Mock data for display when API is not connected
  const mockTeamKPI = teamKPI || {
    period: selectedPeriod,
    totalJobs: 45,
    completedJobs: 38,
    completionRate: 84,
    avgResponseTime: 25,
    avgJobDuration: 2.3,
    customerSatisfaction: 4.5,
    revenue: 125000,
    technicianKPIs: [
      {
        technicianId: '1',
        technicianName: 'Kasun Perera',
        period: selectedPeriod as any,
        totalJobs: 15,
        completedJobs: 13,
        completionRate: 87,
        avgResponseTime: 22,
        avgJobDuration: 2.1,
        customerSatisfaction: 4.7,
        onTimeCompletion: 90,
        targets: [],
      },
      {
        technicianId: '2',
        technicianName: 'Nimal Silva',
        period: selectedPeriod as any,
        totalJobs: 12,
        completedJobs: 10,
        completionRate: 83,
        avgResponseTime: 28,
        avgJobDuration: 2.5,
        customerSatisfaction: 4.3,
        onTimeCompletion: 80,
        targets: [],
      },
      {
        technicianId: '3',
        technicianName: 'Saman Fernando',
        period: selectedPeriod as any,
        totalJobs: 18,
        completedJobs: 15,
        completionRate: 83,
        avgResponseTime: 24,
        avgJobDuration: 2.2,
        customerSatisfaction: 4.6,
        onTimeCompletion: 85,
        targets: [],
      },
    ],
  };

  const mockTargets: Target[] =
    targets.length > 0
      ? targets
      : [
          {
            id: '1',
            title: 'Daily Job Completion',
            description:
              'Complete at least 10 jobs per day per technician',
            targetValue: 10,
            currentValue: 8,
            unit: 'jobs',
            period: 'DAILY',
            category: 'JOBS',
            assignedBy: 'Admin',
            dueDate: new Date().toISOString().split('T')[0],
            status: 'AT_RISK',
          },
          {
            id: '2',
            title: 'Response Time',
            description: 'Average response time under 30 minutes',
            targetValue: 30,
            currentValue: 25,
            unit: 'mins',
            period: 'DAILY',
            category: 'TIME',
            assignedBy: 'Admin',
            dueDate: new Date().toISOString().split('T')[0],
            status: 'ON_TRACK',
          },
          {
            id: '3',
            title: 'Customer Satisfaction',
            description: 'Maintain 4.5+ star rating',
            targetValue: 4.5,
            currentValue: 4.5,
            unit: 'stars',
            period: 'WEEKLY',
            category: 'SATISFACTION',
            assignedBy: 'Admin',
            dueDate: new Date().toISOString().split('T')[0],
            status: 'ON_TRACK',
          },
          {
            id: '4',
            title: 'Weekly Revenue',
            description: 'Achieve weekly revenue target',
            targetValue: 500000,
            currentValue: 125000,
            unit: 'LKR',
            period: 'WEEKLY',
            category: 'REVENUE',
            assignedBy: 'Admin',
            dueDate: new Date().toISOString().split('T')[0],
            status: 'BEHIND',
          },
          {
            id: '5',
            title: 'Monthly Completion Rate',
            description: 'Achieve 90% completion rate',
            targetValue: 90,
            currentValue: 84,
            unit: '%',
            period: 'MONTHLY',
            category: 'JOBS',
            assignedBy: 'Admin',
            dueDate: new Date().toISOString().split('T')[0],
            status: 'AT_RISK',
          },
        ];

  const filteredTargets = mockTargets.filter(
    t => t.period === selectedPeriod,
  );

  const renderProgressBar = (
    current: number,
    target: number,
    color: string,
  ) => {
    const progress = Math.min((current / target) * 100, 100);
    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {width: `${progress}%`, backgroundColor: color},
            ]}
          />
        </View>
        <Text style={styles.progressBarText}>
          {progress.toFixed(0)}%
        </Text>
      </View>
    );
  };

  const renderKPIMetric = (
    label: string,
    value: string,
    icon: string,
    color: string,
  ) => (
    <View style={[styles.kpiMetric, {borderLeftColor: color}]}>
      <Text style={styles.kpiMetricIcon}>{icon}</Text>
      <View>
        <Text style={[styles.kpiMetricValue, {color}]}>{value}</Text>
        <Text style={styles.kpiMetricLabel}>{label}</Text>
      </View>
    </View>
  );

  const renderTechnicianCard = (kpi: TechnicianKPI) => {
    const isExpanded = expandedTechnician === kpi.technicianId;
    return (
      <View key={kpi.technicianId} style={styles.technicianCard}>
        <TouchableOpacity
          style={styles.technicianCardHeader}
          onPress={() =>
            setExpandedTechnician(
              isExpanded ? null : kpi.technicianId,
            )
          }>
          <View style={styles.technicianInfo}>
            <View style={styles.technicianAvatar}>
              <Text style={styles.technicianAvatarText}>
                {kpi.technicianName.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.technicianName}>
                {kpi.technicianName}
              </Text>
              <Text style={styles.technicianJobs}>
                {kpi.completedJobs}/{kpi.totalJobs} jobs completed
              </Text>
            </View>
          </View>
          <View style={styles.technicianRating}>
            <Text style={styles.technicianRatingValue}>
              ⭐ {kpi.customerSatisfaction.toFixed(1)}
            </Text>
            <Text style={styles.expandIcon}>
              {isExpanded ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Completion Rate Bar */}
        <View style={styles.technicianProgress}>
          {renderProgressBar(
            kpi.completedJobs,
            kpi.totalJobs,
            kpi.completionRate >= 85
              ? colors.success
              : kpi.completionRate >= 70
              ? colors.warning
              : colors.error,
          )}
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.technicianDetails}>
            <View style={styles.technicianMetrics}>
              <View style={styles.technicianMetric}>
                <Text style={styles.technicianMetricValue}>
                  {kpi.completionRate}%
                </Text>
                <Text style={styles.technicianMetricLabel}>
                  Completion
                </Text>
              </View>
              <View style={styles.technicianMetric}>
                <Text style={styles.technicianMetricValue}>
                  {kpi.avgResponseTime}m
                </Text>
                <Text style={styles.technicianMetricLabel}>
                  Avg Response
                </Text>
              </View>
              <View style={styles.technicianMetric}>
                <Text style={styles.technicianMetricValue}>
                  {kpi.avgJobDuration.toFixed(1)}h
                </Text>
                <Text style={styles.technicianMetricLabel}>
                  Avg Duration
                </Text>
              </View>
              <View style={styles.technicianMetric}>
                <Text style={styles.technicianMetricValue}>
                  {kpi.onTimeCompletion}%
                </Text>
                <Text style={styles.technicianMetricLabel}>
                  On Time
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={loadData}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KPI & Performance</Text>
        <Text style={styles.headerSubtitle}>
          Team performance metrics
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
        {/* Team Overview KPI Cards */}
        <Text style={styles.sectionTitle}>Team Overview</Text>
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.primary},
            ]}>
            <Text style={styles.kpiCardValue}>
              {mockTeamKPI.completedJobs}
            </Text>
            <Text style={styles.kpiCardLabel}>Jobs Completed</Text>
            <Text style={styles.kpiCardSub}>
              of {mockTeamKPI.totalJobs} total
            </Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  mockTeamKPI.completionRate >= 85
                    ? colors.success
                    : colors.warning,
              },
            ]}>
            <Text style={styles.kpiCardValue}>
              {mockTeamKPI.completionRate}%
            </Text>
            <Text style={styles.kpiCardLabel}>Completion Rate</Text>
            <Text style={styles.kpiCardSub}>
              {mockTeamKPI.completionRate >= 85
                ? 'On Target ✅'
                : 'Needs Improvement'}
            </Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.secondary},
            ]}>
            <Text style={styles.kpiCardValue}>
              {mockTeamKPI.avgResponseTime}m
            </Text>
            <Text style={styles.kpiCardLabel}>Avg Response</Text>
            <Text style={styles.kpiCardSub}>Time to assign</Text>
          </View>
          <View
            style={[
              styles.kpiCard,
              {backgroundColor: colors.accent},
            ]}>
            <Text style={styles.kpiCardValue}>
              ⭐ {mockTeamKPI.customerSatisfaction.toFixed(1)}
            </Text>
            <Text style={styles.kpiCardLabel}>Satisfaction</Text>
            <Text style={styles.kpiCardSub}>Customer rating</Text>
          </View>
        </View>

        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsCard}>
          {renderKPIMetric(
            'Avg Job Duration',
            `${mockTeamKPI.avgJobDuration.toFixed(1)} hrs`,
            '⏱️',
            colors.primary,
          )}
          {renderKPIMetric(
            'Total Revenue',
            `LKR ${mockTeamKPI.revenue.toLocaleString()}`,
            '💰',
            colors.success,
          )}
          {renderKPIMetric(
            'Total Jobs Today',
            `${mockTeamKPI.totalJobs} jobs`,
            '📋',
            colors.secondary,
          )}
          {renderKPIMetric(
            'Pending Jobs',
            `${
              mockTeamKPI.totalJobs - mockTeamKPI.completedJobs
            } jobs`,
            '⏳',
            colors.warning,
          )}
        </View>

        {/* Targets Section */}
        {filteredTargets.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Targets Assigned by Admin
            </Text>
            {filteredTargets.map(target => (
              <View key={target.id} style={styles.targetCard}>
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
                <Text style={styles.targetDescription}>
                  {target.description}
                </Text>
                <View style={styles.targetProgress}>
                  <View style={styles.targetValues}>
                    <Text style={styles.targetCurrentValue}>
                      {target.currentValue} {target.unit}
                    </Text>
                    <Text style={styles.targetDivider}>/</Text>
                    <Text style={styles.targetValue}>
                      {target.targetValue} {target.unit}
                    </Text>
                  </View>
                  {renderProgressBar(
                    target.currentValue,
                    target.targetValue,
                    getTargetStatusColor(target.status),
                  )}
                </View>
                <View style={styles.targetFooter}>
                  <Text style={styles.targetAssignedBy}>
                    👤 Assigned by: {target.assignedBy}
                  </Text>
                  <Text style={styles.targetDueDate}>
                    📅 Due: {target.dueDate}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Individual Technician Performance */}
        <Text style={styles.sectionTitle}>
          Individual Performance
        </Text>
        {mockTeamKPI.technicianKPIs.map(renderTechnicianCard)}

        {/* Performance Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            📊 Performance Summary
          </Text>
          <Text style={styles.summaryPeriod}>
            Period: {selectedPeriod}
          </Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {mockTeamKPI.technicianKPIs.length}
              </Text>
              <Text style={styles.summaryStatLabel}>
                Active Technicians
              </Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {Math.max(
                  ...mockTeamKPI.technicianKPIs.map(
                    t => t.completionRate,
                  ),
                )}
                %
              </Text>
              <Text style={styles.summaryStatLabel}>
                Best Performance
              </Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {Math.min(
                  ...mockTeamKPI.technicianKPIs.map(
                    t => t.completionRate,
                  ),
                )}
                %
              </Text>
              <Text style={styles.summaryStatLabel}>
                Needs Attention
              </Text>
            </View>
          </View>
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
    fontSize: typography.md,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.sm,
    margin: spacing.md,
    borderRadius: 10,
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
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
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
  kpiCardValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  kpiCardLabel: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.medium,
    textAlign: 'center',
  },
  kpiCardSub: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
  metricsCard: {
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
  kpiMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  kpiMetricIcon: {
    fontSize: 24,
  },
  kpiMetricValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  kpiMetricLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  targetCard: {
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
  targetProgress: {
    marginBottom: spacing.sm,
  },
  targetValues: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  targetCurrentValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  targetDivider: {
    fontSize: typography.lg,
    color: colors.textLight,
    marginHorizontal: spacing.xs,
  },
  targetValue: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  progressBarContainer: {
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
  progressBarText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    width: 35,
    textAlign: 'right',
  },
  targetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  targetAssignedBy: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  targetDueDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  technicianCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: spacing.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  technicianCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  technicianInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  technicianAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  technicianAvatarText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  technicianName: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  technicianJobs: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  technicianRating: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  technicianRatingValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.warning,
  },
  expandIcon: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  technicianProgress: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  technicianDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  technicianMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  technicianMetric: {
    alignItems: 'center',
  },
  technicianMetricValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  technicianMetricLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  summaryPeriod: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginBottom: spacing.md,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  summaryStatLabel: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default KPIPerformanceScreen;