import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {fetchTasks, updateTaskStatus} from '@store/slices/technicianSlice';
import {
  launchCamera,
  launchImageLibrary,
  MediaType,
} from 'react-native-image-picker';

type TaskDetailRouteProp = RouteProp<   
  TechnicianStackParamList,
  'TaskDetail'
>;
type TaskDetailNavigationProp =
  StackNavigationProp<TechnicianStackParamList>;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'assigned': return colors.info;
    case 'accepted': return colors.secondary;
    case 'travelling': return colors.warning;
    case 'in_progress': return colors.accent;
    case 'completed': return colors.success;
    default: return colors.textSecondary;
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return colors.error;
    case 'MEDIUM': return colors.warning;
    case 'LOW': return colors.success;
    default: return colors.secondary;
  }
};

const MATERIALS_LIST = [
  {id: '1', name: 'Fiber Optic Cable', unit: 'meters'},
  {id: '2', name: 'RJ45 Connector', unit: 'pcs'},
  {id: '3', name: 'Network Switch', unit: 'pcs'},
  {id: '4', name: 'Router', unit: 'pcs'},
  {id: '5', name: 'Cable Ties', unit: 'pack'},
  {id: '6', name: 'Wall Socket', unit: 'pcs'},
  {id: '7', name: 'Patch Cable', unit: 'pcs'},
  {id: '8', name: 'Signal Booster', unit: 'pcs'},
];

interface UsedMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

const TechnicianTaskDetailScreen = () => {
  const navigation = useNavigation<TaskDetailNavigationProp>();
  const route = useRoute<TaskDetailRouteProp>();
  const dispatch = useAppDispatch();
  const {tasks, isLoading} = useAppSelector(
    state => state.technician,
  );
  const {taskId} = route.params;

  const task = tasks.find(t => t.id === taskId);

  const [workNotes, setWorkNotes] = useState(task?.notes || '');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [usedMaterials, setUsedMaterials] = useState<UsedMaterial[]>([]);
  const [activePhotoTab, setActivePhotoTab] = useState<'before' | 'after'>('before');
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [showMaterials, setShowMaterials] = useState(false);

  useEffect(() => {
    if (tasks.length === 0) {
      dispatch(fetchTasks());
    }
  }, []);

  useEffect(() => {
    if (task?.status === 'in_progress' && !startTime) {
      setStartTime(new Date());
    }
  }, [task?.status]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (startTime && task?.status === 'in_progress') {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - startTime.getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(
          `${h.toString().padStart(2, '0')}:${m
            .toString()
            .padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startTime, task?.status]);

  const handleCallCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Error', 'Could not make call'),
    );
  };

  const handleGetDirections = () => {
    if (!task?.location) return;
    const {latitude, longitude} = task.location;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open maps'),
    );
  };

  const handleAddPhoto = (type: 'before' | 'after') => {
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: () => {
          launchCamera(
            {mediaType: 'photo' as MediaType, quality: 0.8},
            response => {
              if (
                !response.didCancel &&
                response.assets?.[0]?.uri
              ) {
                if (type === 'before') {
                  setBeforePhotos(prev => [
                    ...prev,
                    response.assets![0].uri!,
                  ]);
                } else {
                  setAfterPhotos(prev => [
                    ...prev,
                    response.assets![0].uri!,
                  ]);
                }
              }
            },
          );
        },
      },
      {
        text: 'Gallery',
        onPress: () => {
          launchImageLibrary(
            {mediaType: 'photo' as MediaType, quality: 0.8},
            response => {
              if (
                !response.didCancel &&
                response.assets?.[0]?.uri
              ) {
                if (type === 'before') {
                  setBeforePhotos(prev => [
                    ...prev,
                    response.assets![0].uri!,
                  ]);
                } else {
                  setAfterPhotos(prev => [
                    ...prev,
                    response.assets![0].uri!,
                  ]);
                }
              }
            },
          );
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const handleAddMaterial = (material: {
    id: string;
    name: string;
    unit: string;
  }) => {
    const existing = usedMaterials.find(m => m.id === material.id);
    if (existing) {
      setUsedMaterials(prev =>
        prev.map(m =>
          m.id === material.id
            ? {...m, quantity: m.quantity + 1}
            : m,
        ),
      );
    } else {
      setUsedMaterials(prev => [
        ...prev,
        {...material, quantity: 1},
      ]);
    }
    setShowMaterialPicker(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!task) return;
    setIsUpdating(true);
    if (newStatus === 'in_progress') {
      setStartTime(new Date());
    }
    if (newStatus === 'completed') {
      if (afterPhotos.length === 0) {
        Alert.alert(
          'After Photos Required',
          'Please add at least one after photo before completing',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Skip',
              onPress: async () => {
                const result = await dispatch(
                  updateTaskStatus({id: task.id, status: newStatus}),
                );
                setIsUpdating(false);
                if (updateTaskStatus.fulfilled.match(result)) {
                  Alert.alert(
                    '✅ Job Completed!',
                    'Great work! Job has been marked as complete.',
                    [{text: 'OK', onPress: () => navigation.goBack()}],
                  );
                }
              },
            },
          ],
        );
        setIsUpdating(false);
        return;
      }
    }
    const result = await dispatch(
      updateTaskStatus({id: task.id, status: newStatus}),
    );
    setIsUpdating(false);
    if (updateTaskStatus.fulfilled.match(result)) {
      const messages: Record<string, string> = {
        accepted: 'Job accepted! Navigate to customer location.',
        travelling: 'Status updated — travelling to job site.',
        in_progress: 'Work started! Timer is running.',
        completed: 'Excellent! Job marked as complete.',
      };
      Alert.alert(
        '✅ Status Updated',
        messages[newStatus] || 'Status updated successfully',
      );
    }
  };

  const handlePauseWork = () => {
    Alert.alert(
      'Pause Work',
      'Are you sure you want to pause this job?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Pause',
          onPress: () => {
            setStartTime(null);
            Alert.alert('Work Paused', 'Job has been paused');
          },
        },
      ],
    );
  };

  if (!task) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading task...</Text>
      </View>
    );
  }

  const getStatusActions = () => {
    switch (task.status) {
      case 'assigned':
        return (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {backgroundColor: colors.success},
            ]}
            onPress={() => handleUpdateStatus('accepted')}
            disabled={isUpdating}>
            {isUpdating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>
                ✅ Accept Job
              </Text>
            )}
          </TouchableOpacity>
        );
      case 'accepted':
        return (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {backgroundColor: colors.warning},
            ]}
            onPress={() => handleUpdateStatus('travelling')}
            disabled={isUpdating}>
            {isUpdating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>
                🚗 Start Travelling
              </Text>
            )}
          </TouchableOpacity>
        );
      case 'travelling':
        return (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {backgroundColor: colors.primary},
            ]}
            onPress={() => handleUpdateStatus('in_progress')}
            disabled={isUpdating}>
            {isUpdating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>
                🔧 Start Work
              </Text>
            )}
          </TouchableOpacity>
        );
      case 'in_progress':
        return (
          <View style={styles.inProgressActions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.pauseButton,
              ]}
              onPress={handlePauseWork}>
              <Text style={styles.pauseButtonText}>⏸ Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.completeButton,
              ]}
              onPress={() => handleUpdateStatus('completed')}
              disabled={isUpdating}>
              {isUpdating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.actionButtonText}>
                  ✅ Complete Job
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'completed':
        return (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>
              ✅ Job Completed
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Task #{task.id}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  getStatusColor(task.status) + '30',
              },
            ]}>
            <Text
              style={[
                styles.statusText,
                {color: getStatusColor(task.status)},
              ]}>
              {task.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        {task.priority && (
          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor:
                  getPriorityColor(task.priority) + '30',
              },
            ]}>
            <Text
              style={[
                styles.priorityText,
                {color: getPriorityColor(task.priority)},
              ]}>
              {task.priority === 'HIGH'
                ? '🔴'
                : task.priority === 'MEDIUM'
                ? '🟡'
                : '🟢'}{' '}
              {task.priority} PRIORITY
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {/* Time Tracker */}
        {task.status === 'in_progress' && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>⏱️ Work Timer</Text>
            <Text style={styles.timerValue}>{elapsed}</Text>
            <Text style={styles.timerStarted}>
              Started at:{' '}
              {startTime?.toLocaleTimeString() || 'N/A'}
            </Text>
          </View>
        )}

        {/* Customer Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Customer Information</Text>
          <View style={styles.customerInfo}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {task.customerName?.charAt(0) || 'C'}
              </Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>
                {task.customerName || 'N/A'}
              </Text>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() =>
                  handleCallCustomer('0717730773')
                }>
                <Text style={styles.callButtonText}>
                  📞 Call Customer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>
              {task.category || 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Scheduled</Text>
            <Text style={styles.infoValue}>
              {task.scheduledDate}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Est. Time</Text>
            <Text style={styles.infoValue}>
              {task.estimatedDuration} hours
            </Text>
          </View>
        </View>

        {/* Location & Map */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            📍 Location & Navigation
          </Text>
          <Text style={styles.addressText}>
            {task.location?.address || 'Address not available'}
          </Text>
          {task.location?.latitude && task.location?.longitude && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: task.location.latitude,
                  longitude: task.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}>
                <Marker
                  coordinate={{
                    latitude: task.location.latitude,
                    longitude: task.location.longitude,
                  }}
                  title="Job Location"
                  pinColor={colors.primary}
                />
              </MapView>
            </View>
          )}
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={handleGetDirections}>
            <Text style={styles.directionsButtonText}>
              🗺️ Get Directions
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Update Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            🔄 Status Update
          </Text>
          {getStatusActions()}
        </View>

        {/* Work Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Work Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add work notes, observations, or remarks..."
            placeholderTextColor={colors.textLight}
            value={workNotes}
            onChangeText={setWorkNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.notesCharCount}>
            {workNotes.length} characters
          </Text>
        </View>

        {/* Before/After Photos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📷 Work Photos</Text>

          {/* Tab Switcher */}
          <View style={styles.photoTabBar}>
            <TouchableOpacity
              style={[
                styles.photoTab,
                activePhotoTab === 'before' &&
                  styles.photoTabActive,
              ]}
              onPress={() => setActivePhotoTab('before')}>
              <Text
                style={[
                  styles.photoTabText,
                  activePhotoTab === 'before' &&
                    styles.photoTabTextActive,
                ]}>
                Before ({beforePhotos.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.photoTab,
                activePhotoTab === 'after' &&
                  styles.photoTabActive,
              ]}
              onPress={() => setActivePhotoTab('after')}>
              <Text
                style={[
                  styles.photoTabText,
                  activePhotoTab === 'after' &&
                    styles.photoTabTextActive,
                ]}>
                After ({afterPhotos.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Photo Grid */}
          <View style={styles.photoGrid}>
            {(activePhotoTab === 'before'
              ? beforePhotos
              : afterPhotos
            ).map((uri, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{uri}} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => {
                    if (activePhotoTab === 'before') {
                      setBeforePhotos(prev =>
                        prev.filter((_, i) => i !== index),
                      );
                    } else {
                      setAfterPhotos(prev =>
                        prev.filter((_, i) => i !== index),
                      );
                    }
                  }}>
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Photo Button */}
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={() => handleAddPhoto(activePhotoTab)}>
              <Text style={styles.addPhotoIcon}>📷</Text>
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Materials Used */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.materialsHeader}
            onPress={() => setShowMaterials(!showMaterials)}>
            <Text style={styles.cardTitle}>
              📦 Materials Used ({usedMaterials.length})
            </Text>
            <Text style={styles.expandIcon}>
              {showMaterials ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showMaterials && (
            <>
              {/* Materials List */}
              {usedMaterials.map((material, index) => (
                <View key={index} style={styles.materialRow}>
                  <Text style={styles.materialName}>
                    {material.name}
                  </Text>
                  <View style={styles.materialQuantity}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() =>
                        setUsedMaterials(prev =>
                          prev.map(m =>
                            m.id === material.id
                              ? {
                                  ...m,
                                  quantity: Math.max(
                                    1,
                                    m.quantity - 1,
                                  ),
                                }
                              : m,
                          ),
                        )
                      }>
                      <Text style={styles.qtyButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>
                      {material.quantity} {material.unit}
                    </Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() =>
                        setUsedMaterials(prev =>
                          prev.map(m =>
                            m.id === material.id
                              ? {...m, quantity: m.quantity + 1}
                              : m,
                          ),
                        )
                      }>
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setUsedMaterials(prev =>
                        prev.filter(m => m.id !== material.id),
                      )
                    }>
                    <Text style={styles.removeMaterialText}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Material Button */}
              <TouchableOpacity
                style={styles.addMaterialButton}
                onPress={() =>
                  setShowMaterialPicker(!showMaterialPicker)
                }>
                <Text style={styles.addMaterialButtonText}>
                  + Add Material
                </Text>
              </TouchableOpacity>

              {/* Material Picker */}
              {showMaterialPicker && (
                <View style={styles.materialPickerList}>
                  {MATERIALS_LIST.map(material => (
                    <TouchableOpacity
                      key={material.id}
                      style={styles.materialPickerItem}
                      onPress={() =>
                        handleAddMaterial(material)
                      }>
                      <Text style={styles.materialPickerName}>
                        {material.name}
                      </Text>
                      <Text style={styles.materialPickerUnit}>
                        {material.unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Save Notes Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() =>
            Alert.alert('Saved', 'Work notes and materials saved')
          }>
          <Text style={styles.saveButtonText}>
            💾 Save Work Details
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
    color: colors.textSecondary,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  statusText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    marginTop: spacing.xs,
  },
  priorityText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  content: {
    padding: spacing.lg,
  },
  timerCard: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerLabel: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    marginBottom: spacing.xs,
  },
  timerValue: {
    fontSize: 40,
    fontWeight: typography.bold,
    color: colors.white,
    fontFamily: 'monospace',
  },
  timerStarted: {
    fontSize: typography.xs,
    color: colors.white,
    opacity: 0.7,
    marginTop: spacing.xs,
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
  cardTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  customerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  callButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  callButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.md,
  },
  infoLabel: {
    width: 80,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textPrimary,
  },
  addressText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeightMd,
  },
  mapContainer: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  map: {
    flex: 1,
  },
  directionsButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  inProgressActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  pauseButtonText: {
    color: colors.warning,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  completeButton: {
    flex: 2,
    backgroundColor: colors.success,
  },
  completedBanner: {
    backgroundColor: colors.success + '15',
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  completedBannerText: {
    color: colors.success,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesCharCount: {
    fontSize: typography.xs,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  photoTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.md,
  },
  photoTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  photoTabActive: {
    backgroundColor: colors.primary,
  },
  photoTabText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  photoTabTextActive: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  addPhotoButton: {
    width: 90,
    height: 90,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  addPhotoIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  addPhotoText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  materialsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  expandIcon: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.sm,
  },
  materialName: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  materialQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
  },
  qtyButton: {
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  qtyValue: {
    paddingHorizontal: spacing.sm,
    fontSize: typography.sm,
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  removeMaterialText: {
    color: colors.error,
    fontSize: typography.md,
    fontWeight: typography.bold,
    padding: spacing.xs,
  },
  addMaterialButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addMaterialButtonText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  materialPickerList: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  materialPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  materialPickerName: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  materialPickerUnit: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default TechnicianTaskDetailScreen;