import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppSelector} from '@store/hooks';
import {formatCurrency} from '@utils/formatters';

interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  type: string;
  status: 'ASSIGNED' | 'AVAILABLE' | 'MAINTENANCE';
  lastService: string;
  odometer: number;
  fuelLevel: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  availableStock: number;
  unit: string;
  unitPrice: number;
  minThreshold: number;
  isFOC: boolean;
}

interface RequestedItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface MaterialRequest {
  id: string;
  taskId: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED';
  items: RequestedItem[];
  notes: string;
  totalCost: number;
}

const MOCK_VEHICLE: Vehicle = {
  id: 'V001',
  registrationNumber: 'WP CAB 1234',
  make: 'Toyota',
  model: 'HiAce',
  type: 'Van',
  status: 'ASSIGNED',
  lastService: '2026-03-15',
  odometer: 45230,
  fuelLevel: 75,
};

const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: '1',
    name: 'Fiber Optic Cable',
    category: 'Cable',
    sku: 'CAB-FOC-001',
    availableStock: 500,
    unit: 'meters',
    unitPrice: 150,
    minThreshold: 100,
    isFOC: false,
  },
  {
    id: '2',
    name: 'RJ45 Connector Cat6',
    category: 'Connector',
    sku: 'CON-RJ45-001',
    availableStock: 200,
    unit: 'pcs',
    unitPrice: 25,
    minThreshold: 50,
    isFOC: true,
  },
  {
    id: '3',
    name: 'Network Switch 8-Port',
    category: 'Network',
    sku: 'NET-SW8-001',
    availableStock: 15,
    unit: 'pcs',
    unitPrice: 2500,
    minThreshold: 5,
    isFOC: false,
  },
  {
    id: '4',
    name: 'Wireless Router',
    category: 'Network',
    sku: 'NET-RTR-001',
    availableStock: 10,
    unit: 'pcs',
    unitPrice: 3500,
    minThreshold: 3,
    isFOC: false,
  },
  {
    id: '5',
    name: 'Cable Ties 100pcs',
    category: 'Accessory',
    sku: 'ACC-CT-001',
    availableStock: 100,
    unit: 'pack',
    unitPrice: 50,
    minThreshold: 20,
    isFOC: true,
  },
  {
    id: '6',
    name: 'Wall Socket Cat6',
    category: 'Socket',
    sku: 'SOC-WL-001',
    availableStock: 80,
    unit: 'pcs',
    unitPrice: 120,
    minThreshold: 20,
    isFOC: false,
  },
  {
    id: '7',
    name: 'Patch Cable 1m',
    category: 'Cable',
    sku: 'CAB-PCT-001',
    availableStock: 150,
    unit: 'pcs',
    unitPrice: 200,
    minThreshold: 30,
    isFOC: false,
  },
  {
    id: '8',
    name: 'Signal Booster',
    category: 'Equipment',
    sku: 'EQP-SB-001',
    availableStock: 20,
    unit: 'pcs',
    unitPrice: 1800,
    minThreshold: 5,
    isFOC: false,
  },
  {
    id: '9',
    name: 'Ethernet Cable 5m',
    category: 'Cable',
    sku: 'CAB-ETH-001',
    availableStock: 60,
    unit: 'pcs',
    unitPrice: 350,
    minThreshold: 15,
    isFOC: false,
  },
  {
    id: '10',
    name: 'Power Adapter 12V',
    category: 'Power',
    sku: 'PWR-ADP-001',
    availableStock: 30,
    unit: 'pcs',
    unitPrice: 450,
    minThreshold: 8,
    isFOC: false,
  },
  {
    id: '11',
    name: 'Fiber Splice Tray',
    category: 'Equipment',
    sku: 'EQP-FST-001',
    availableStock: 25,
    unit: 'pcs',
    unitPrice: 800,
    minThreshold: 5,
    isFOC: false,
  },
  {
    id: '12',
    name: 'Network Tester',
    category: 'Tool',
    sku: 'TL-NT-001',
    availableStock: 8,
    unit: 'pcs',
    unitPrice: 5000,
    minThreshold: 2,
    isFOC: false,
  },
];

const MOCK_REQUESTS: MaterialRequest[] = [
  {
    id: 'REQ001',
    taskId: 'TASK001',
    submittedAt: '2026-04-10T09:00:00',
    status: 'DELIVERED',
    items: [
      {
        id: '1',
        name: 'Fiber Optic Cable',
        quantity: 10,
        unit: 'meters',
        unitPrice: 150,
      },
    ],
    notes: 'Urgent requirement',
    totalCost: 1500,
  },
  {
    id: 'REQ002',
    taskId: 'TASK002',
    submittedAt: '2026-04-11T10:00:00',
    status: 'APPROVED',
    items: [
      {
        id: '3',
        name: 'Network Switch 8-Port',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 2500,
      },
    ],
    notes: '',
    totalCost: 2500,
  },
  {
    id: 'REQ003',
    taskId: 'TASK003',
    submittedAt: '2026-04-12T08:00:00',
    status: 'PENDING',
    items: [
      {
        id: '4',
        name: 'Wireless Router',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 3500,
      },
      {
        id: '2',
        name: 'RJ45 Connector Cat6',
        quantity: 5,
        unit: 'pcs',
        unitPrice: 25,
      },
    ],
    notes: 'Customer requested upgrade',
    totalCost: 3625,
  },
];

const CATEGORIES = [
  'All',
  'Cable',
  'Connector',
  'Network',
  'Socket',
  'Equipment',
  'Accessory',
  'Power',
  'Tool',
];

const TechnicianResourceManagementScreen = () => {
  const navigation = useNavigation();
  const {tasks} = useAppSelector(state => state.technician);

  const [activeTab, setActiveTab] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestItems, setRequestItems] = useState<RequestedItem[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInventoryDetail, setShowInventoryDetail] =
    useState<InventoryItem | null>(null);

  const TABS = ['Vehicle', 'Inventory', 'Requests'];

  const filteredInventory = MOCK_INVENTORY.filter(item => {
    const matchesSearch =
      searchText === '' ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' ||
      item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (item: InventoryItem) => {
    if (item.availableStock === 0) return 'OUT_OF_STOCK';
    if (item.availableStock <= item.minThreshold) return 'LOW_STOCK';
    return 'IN_STOCK';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'IN_STOCK': return colors.success;
      case 'LOW_STOCK': return colors.warning;
      case 'OUT_OF_STOCK': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return colors.success;
      case 'APPROVED': return colors.secondary;
      case 'PENDING': return colors.warning;
      case 'REJECTED': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getRequestStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED': return '✅';
      case 'APPROVED': return '👍';
      case 'PENDING': return '⏳';
      case 'REJECTED': return '❌';
      default: return '📋';
    }
  };

  const getFuelColor = (level: number) => {
    if (level > 50) return colors.success;
    if (level > 25) return colors.warning;
    return colors.error;
  };

  const handleAddToRequest = (item: InventoryItem) => {
    const existing = requestItems.find(r => r.id === item.id);
    if (existing) {
      setRequestItems(prev =>
        prev.map(r =>
          r.id === item.id
            ? {...r, quantity: r.quantity + 1}
            : r,
        ),
      );
    } else {
      setRequestItems(prev => [
        ...prev,
        {
          id: item.id,
          name: item.name,
          quantity: 1,
          unit: item.unit,
          unitPrice: item.unitPrice,
        },
      ]);
    }
    setShowInventoryDetail(null);
    Alert.alert(
      'Added ✅',
      `${item.name} added to request`,
    );
  };

  const handleSubmitRequest = async () => {
    if (requestItems.length === 0) {
      Alert.alert('Error', 'Add at least one item');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowRequestModal(false);
      setRequestItems([]);
      setRequestNotes('');
      Alert.alert(
        '✅ Request Submitted',
        'Your material request has been submitted for approval',
      );
    }, 1500);
  };

  const totalRequestCost = requestItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const renderVehicleTab = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Vehicle Card */}
      <View style={styles.vehicleCard}>
        <View style={styles.vehicleHeader}>
          <Text style={styles.vehicleIcon}>🚐</Text>
          <View style={styles.vehicleHeaderInfo}>
            <Text style={styles.vehicleReg}>
              {MOCK_VEHICLE.registrationNumber}
            </Text>
            <Text style={styles.vehicleName}>
              {MOCK_VEHICLE.make} {MOCK_VEHICLE.model}
            </Text>
            <View
              style={[
                styles.vehicleStatusBadge,
                {
                  backgroundColor:
                    MOCK_VEHICLE.status === 'ASSIGNED'
                      ? colors.success + '20'
                      : colors.warning + '20',
                },
              ]}>
              <Text
                style={[
                  styles.vehicleStatusText,
                  {
                    color:
                      MOCK_VEHICLE.status === 'ASSIGNED'
                        ? colors.success
                        : colors.warning,
                  },
                ]}>
                {MOCK_VEHICLE.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle Details */}
        <View style={styles.vehicleDetails}>
          <View style={styles.vehicleDetailRow}>
            <Text style={styles.vehicleDetailLabel}>Type</Text>
            <Text style={styles.vehicleDetailValue}>
              {MOCK_VEHICLE.type}
            </Text>
          </View>
          <View style={styles.vehicleDetailRow}>
            <Text style={styles.vehicleDetailLabel}>
              Last Service
            </Text>
            <Text style={styles.vehicleDetailValue}>
              {MOCK_VEHICLE.lastService}
            </Text>
          </View>
          <View style={styles.vehicleDetailRow}>
            <Text style={styles.vehicleDetailLabel}>Odometer</Text>
            <Text style={styles.vehicleDetailValue}>
              {MOCK_VEHICLE.odometer.toLocaleString()} km
            </Text>
          </View>
        </View>

        {/* Fuel Level */}
        <View style={styles.fuelSection}>
          <View style={styles.fuelHeader}>
            <Text style={styles.fuelLabel}>⛽ Fuel Level</Text>
            <Text
              style={[
                styles.fuelValue,
                {color: getFuelColor(MOCK_VEHICLE.fuelLevel)},
              ]}>
              {MOCK_VEHICLE.fuelLevel}%
            </Text>
          </View>
          <View style={styles.fuelBar}>
            <View
              style={[
                styles.fuelFill,
                {
                  width: `${MOCK_VEHICLE.fuelLevel}%`,
                  backgroundColor: getFuelColor(
                    MOCK_VEHICLE.fuelLevel,
                  ),
                },
              ]}
            />
          </View>
          {MOCK_VEHICLE.fuelLevel <= 25 && (
            <Text style={styles.lowFuelWarning}>
              ⚠️ Low fuel — please refuel soon
            </Text>
          )}
        </View>
      </View>

      {/* Vehicle Actions */}
      <View style={styles.vehicleActions}>
        <TouchableOpacity
          style={styles.vehicleActionButton}
          onPress={() =>
            Alert.alert(
              'Report Issue',
              'Report a vehicle issue to your team lead',
            )
          }>
          <Text style={styles.vehicleActionIcon}>🔧</Text>
          <Text style={styles.vehicleActionText}>
            Report Issue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.vehicleActionButton}
          onPress={() =>
            Alert.alert(
              'Request Service',
              'Request vehicle maintenance',
            )
          }>
          <Text style={styles.vehicleActionIcon}>🛠️</Text>
          <Text style={styles.vehicleActionText}>
            Request Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.vehicleActionButton}
          onPress={() =>
            Alert.alert('Fuel Log', 'Log fuel refill')
          }>
          <Text style={styles.vehicleActionIcon}>⛽</Text>
          <Text style={styles.vehicleActionText}>Fuel Log</Text>
        </TouchableOpacity>
      </View>

      {/* Equipment Allocation */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          🔨 Equipment in Vehicle
        </Text>
        {[
          {name: 'Fiber Splicing Kit', status: 'OK'},
          {name: 'Network Cable Tester', status: 'OK'},
          {name: 'Drill Machine', status: 'OK'},
          {name: 'Ladder (3m)', status: 'NEEDS CHECK'},
          {name: 'Safety Harness', status: 'OK'},
          {name: 'Multimeter', status: 'OK'},
        ].map((equipment, index) => (
          <View key={index} style={styles.equipmentRow}>
            <Text style={styles.equipmentIcon}>🔧</Text>
            <Text style={styles.equipmentName}>
              {equipment.name}
            </Text>
            <View
              style={[
                styles.equipmentStatus,
                {
                  backgroundColor:
                    equipment.status === 'OK'
                      ? colors.success + '20'
                      : colors.warning + '20',
                },
              ]}>
              <Text
                style={[
                  styles.equipmentStatusText,
                  {
                    color:
                      equipment.status === 'OK'
                        ? colors.success
                        : colors.warning,
                  },
                ]}>
                {equipment.status}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderInventoryTab = () => (
    <View style={styles.inventoryContainer}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials by name or SKU..."
          placeholderTextColor={colors.textLight}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText !== '' && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat &&
                styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat)}>
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat &&
                  styles.categoryChipTextActive,
              ]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Request Button */}
      {requestItems.length > 0 && (
        <TouchableOpacity
          style={styles.viewRequestButton}
          onPress={() => setShowRequestModal(true)}>
          <Text style={styles.viewRequestButtonText}>
            📦 View Request ({requestItems.length} items) —{' '}
            {formatCurrency(totalRequestCost)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Inventory List */}
      <FlatList
        data={filteredInventory}
        keyExtractor={item => item.id}
        renderItem={({item}) => {
          const stockStatus = getStockStatus(item);
          return (
            <TouchableOpacity
              style={styles.inventoryItem}
              onPress={() => setShowInventoryDetail(item)}>
              <View style={styles.inventoryItemLeft}>
                <View
                  style={[
                    styles.inventoryCategoryBadge,
                    {
                      backgroundColor:
                        colors.primary + '20',
                    },
                  ]}>
                  <Text style={styles.inventoryCategoryText}>
                    {item.category.charAt(0)}
                  </Text>
                </View>
                <View style={styles.inventoryItemInfo}>
                  <Text style={styles.inventoryItemName}>
                    {item.name}
                  </Text>
                  <Text style={styles.inventoryItemSKU}>
                    {item.sku}
                  </Text>
                  <View style={styles.inventoryItemMeta}>
                    <Text style={styles.inventoryItemPrice}>
                      {formatCurrency(item.unitPrice)}/
                      {item.unit}
                    </Text>
                    {item.isFOC && (
                      <View style={styles.focBadge}>
                        <Text style={styles.focBadgeText}>
                          FOC
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.inventoryItemRight}>
                <Text
                  style={[
                    styles.stockCount,
                    {
                      color: getStockStatusColor(stockStatus),
                    },
                  ]}>
                  {item.availableStock}
                </Text>
                <Text style={styles.stockUnit}>{item.unit}</Text>
                <View
                  style={[
                    styles.stockStatusBadge,
                    {
                      backgroundColor:
                        getStockStatusColor(stockStatus) + '20',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.stockStatusText,
                      {
                        color:
                          getStockStatusColor(stockStatus),
                      },
                    ]}>
                    {stockStatus === 'IN_STOCK'
                      ? '✅'
                      : stockStatus === 'LOW_STOCK'
                      ? '⚠️'
                      : '❌'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.inventoryList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              No items found
            </Text>
          </View>
        }
      />
    </View>
  );

  const renderRequestsTab = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* New Request Button */}
      <TouchableOpacity
        style={styles.newRequestButton}
        onPress={() => setShowRequestModal(true)}>
        <Text style={styles.newRequestButtonText}>
          + New Material Request
        </Text>
      </TouchableOpacity>

      {/* Requests List */}
      {MOCK_REQUESTS.map(request => (
        <View key={request.id} style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <View>
              <Text style={styles.requestId}>
                Request #{request.id}
              </Text>
              <Text style={styles.requestTask}>
                Task #{request.taskId}
              </Text>
            </View>
            <View
              style={[
                styles.requestStatusBadge,
                {
                  backgroundColor:
                    getRequestStatusColor(request.status) + '20',
                },
              ]}>
              <Text style={styles.requestStatusIcon}>
                {getRequestStatusIcon(request.status)}
              </Text>
              <Text
                style={[
                  styles.requestStatusText,
                  {
                    color: getRequestStatusColor(
                      request.status,
                    ),
                  },
                ]}>
                {request.status}
              </Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.requestItems}>
            {request.items.map((item, index) => (
              <View key={index} style={styles.requestItemRow}>
                <Text style={styles.requestItemName}>
                  • {item.name}
                </Text>
                <Text style={styles.requestItemQty}>
                  {item.quantity} {item.unit}
                </Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.requestFooter}>
            <Text style={styles.requestDate}>
              📅 {new Date(request.submittedAt).toLocaleDateString()}
            </Text>
            <Text style={styles.requestTotal}>
              {formatCurrency(request.totalCost)}
            </Text>
          </View>

          {request.notes && (
            <Text style={styles.requestNotes}>
              📝 {request.notes}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resources</Text>
        <Text style={styles.headerSubtitle}>
          Vehicle, inventory & requests
        </Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === index && styles.tabActive,
            ]}
            onPress={() => setActiveTab(index)}>
            <Text
              style={[
                styles.tabText,
                activeTab === index && styles.tabTextActive,
              ]}>
              {tab}
              {tab === 'Requests' && MOCK_REQUESTS.filter(r => r.status === 'PENDING').length > 0
                ? ` (${MOCK_REQUESTS.filter(r => r.status === 'PENDING').length})`
                : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 0 && renderVehicleTab()}
        {activeTab === 1 && renderInventoryTab()}
        {activeTab === 2 && renderRequestsTab()}
      </View>

      {/* Inventory Detail Modal */}
      <Modal
        visible={showInventoryDetail !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInventoryDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showInventoryDetail?.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowInventoryDetail(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {showInventoryDetail && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>SKU</Text>
                  <Text style={styles.detailValue}>
                    {showInventoryDetail.sku}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>
                    {showInventoryDetail.category}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Available Stock
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color: getStockStatusColor(
                          getStockStatus(showInventoryDetail),
                        ),
                        fontWeight: typography.bold,
                      },
                    ]}>
                    {showInventoryDetail.availableStock}{' '}
                    {showInventoryDetail.unit}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Unit Price</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(showInventoryDetail.unitPrice)}/
                    {showInventoryDetail.unit}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color: showInventoryDetail.isFOC
                          ? colors.success
                          : colors.warning,
                        fontWeight: typography.bold,
                      },
                    ]}>
                    {showInventoryDetail.isFOC
                      ? 'FOC (Free of Charge)'
                      : 'Chargeable'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Min Threshold
                  </Text>
                  <Text style={styles.detailValue}>
                    {showInventoryDetail.minThreshold}{' '}
                    {showInventoryDetail.unit}
                  </Text>
                </View>

                {/* Stock Level Bar */}
                <View style={styles.stockLevelSection}>
                  <Text style={styles.stockLevelLabel}>
                    Stock Level
                  </Text>
                  <View style={styles.stockLevelBar}>
                    <View
                      style={[
                        styles.stockLevelFill,
                        {
                          width: `${Math.min(
                            (showInventoryDetail.availableStock /
                              (showInventoryDetail.minThreshold *
                                3)) *
                              100,
                            100,
                          )}%`,
                          backgroundColor: getStockStatusColor(
                            getStockStatus(showInventoryDetail),
                          ),
                        },
                      ]}
                    />
                  </View>
                </View>
              </ScrollView>
            )}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelDetailButton}
                onPress={() => setShowInventoryDetail(null)}>
                <Text style={styles.cancelDetailText}>Close</Text>
              </TouchableOpacity>
              {showInventoryDetail &&
                showInventoryDetail.availableStock > 0 && (
                  <TouchableOpacity
                    style={styles.addToRequestButton}
                    onPress={() =>
                      handleAddToRequest(showInventoryDetail)
                    }>
                    <Text style={styles.addToRequestText}>
                      + Add to Request
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Material Request Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.requestModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Material Request ({requestItems.length} items)
              </Text>
              <TouchableOpacity
                onPress={() => setShowRequestModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Task Selection */}
              <Text style={styles.requestFormLabel}>
                Select Task (Optional)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.taskSelector}
                contentContainerStyle={
                  styles.taskSelectorContent
                }>
                {tasks
                  .filter(t => t.status !== 'completed')
                  .map(task => (
                    <TouchableOpacity
                      key={task.id}
                      style={[
                        styles.taskChip,
                        selectedTaskId === task.id &&
                          styles.taskChipActive,
                      ]}
                      onPress={() => setSelectedTaskId(task.id)}>
                      <Text
                        style={[
                          styles.taskChipText,
                          selectedTaskId === task.id &&
                            styles.taskChipTextActive,
                        ]}>
                        #{task.id}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              {/* Request Items */}
              {requestItems.length === 0 ? (
                <View style={styles.emptyRequest}>
                  <Text style={styles.emptyRequestText}>
                    No items added yet.{'\n'}Browse the Inventory
                    tab to add items.
                  </Text>
                </View>
              ) : (
                requestItems.map((item, index) => (
                  <View key={index} style={styles.requestItemCard}>
                    <View style={styles.requestItemCardInfo}>
                      <Text style={styles.requestItemCardName}>
                        {item.name}
                      </Text>
                      <Text style={styles.requestItemCardPrice}>
                        {formatCurrency(item.unitPrice)}/
                        {item.unit}
                      </Text>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() =>
                          setRequestItems(prev =>
                            prev
                              .map(r =>
                                r.id === item.id
                                  ? {
                                      ...r,
                                      quantity: Math.max(
                                        0,
                                        r.quantity - 1,
                                      ),
                                    }
                                  : r,
                              )
                              .filter(r => r.quantity > 0),
                          )
                        }>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() =>
                          setRequestItems(prev =>
                            prev.map(r =>
                              r.id === item.id
                                ? {...r, quantity: r.quantity + 1}
                                : r,
                            ),
                          )
                        }>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.requestItemSubtotal}>
                      {formatCurrency(
                        item.quantity * item.unitPrice,
                      )}
                    </Text>
                  </View>
                ))
              )}

              {/* Notes */}
              <Text style={styles.requestFormLabel}>Notes</Text>
              <TextInput
                style={styles.requestNotesInput}
                placeholder="Add any special instructions..."
                placeholderTextColor={colors.textLight}
                value={requestNotes}
                onChangeText={setRequestNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Total */}
              {requestItems.length > 0 && (
                <View style={styles.requestTotal}>
                  <Text style={styles.requestTotalLabel}>
                    Total Estimated Cost:
                  </Text>
                  <Text style={styles.requestTotalValue}>
                    {formatCurrency(totalRequestCost)}
                  </Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRequestModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitRequestButton,
                  (requestItems.length === 0 || isSubmitting) &&
                    styles.submitRequestButtonDisabled,
                ]}
                onPress={handleSubmitRequest}
                disabled={
                  requestItems.length === 0 || isSubmitting
                }>
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitRequestButtonText}>
                    Submit Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingBottom: spacing.md,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.bold,
  },
  tabContent: {
    flex: 1,
    padding: spacing.md,
  },
  vehicleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  vehicleIcon: {
    fontSize: 48,
  },
  vehicleHeaderInfo: {
    flex: 1,
  },
  vehicleReg: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  vehicleName: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  vehicleStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vehicleStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  vehicleDetails: {
    marginBottom: spacing.md,
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  vehicleDetailLabel: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  vehicleDetailValue: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  fuelSection: {
    marginTop: spacing.sm,
  },
  fuelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fuelLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  fuelValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  fuelBar: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fuelFill: {
    height: '100%',
    borderRadius: 6,
  },
  lowFuelWarning: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.sm,
    fontWeight: typography.medium,
  },
  vehicleActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  vehicleActionButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  vehicleActionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  vehicleActionText: {
    fontSize: typography.xs,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.sm,
  },
  equipmentIcon: {
    fontSize: 16,
  },
  equipmentName: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  equipmentStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equipmentStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  inventoryContainer: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: typography.md,
    padding: spacing.xs,
  },
  categoryFilter: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  categoryFilterContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.white,
    fontWeight: typography.medium,
  },
  viewRequestButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  viewRequestButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  inventoryList: {
    paddingBottom: spacing.lg,
  },
  inventoryItem: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  inventoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  inventoryCategoryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inventoryCategoryText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  inventoryItemInfo: {
    flex: 1,
  },
  inventoryItemName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  inventoryItemSKU: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginBottom: 2,
  },
  inventoryItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inventoryItemPrice: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  focBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 3,
  },
  focBadgeText: {
    fontSize: 9,
    color: colors.success,
    fontWeight: typography.bold,
  },
  inventoryItemRight: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  stockCount: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  stockUnit: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  stockStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stockStatusText: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  newRequestButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  newRequestButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  requestId: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  requestTask: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  requestStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    gap: spacing.xs,
  },
  requestStatusIcon: {
    fontSize: 12,
  },
  requestStatusText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  requestItems: {
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  requestItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  requestItemName: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  requestItemQty: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  requestTotal: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff", // optional
    borderRadius: 8,
  },
  requestNotes: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  requestModal: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  modalClose: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  modalContent: {
    padding: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.md,
  },
  detailLabel: {
    width: 110,
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  detailValue: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textPrimary,
  },
  stockLevelSection: {
    marginTop: spacing.md,
  },
  stockLevelLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stockLevelBar: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  stockLevelFill: {
    height: '100%',
    borderRadius: 5,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelDetailButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelDetailText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  addToRequestButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  addToRequestText: {
    color: colors.white,
    fontWeight: typography.bold,
  },
  requestFormLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  taskSelector: {
    maxHeight: 44,
    marginBottom: spacing.md,
  },
  taskSelectorContent: {
    gap: spacing.sm,
  },
  taskChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskChipText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  taskChipTextActive: {
    color: colors.white,
    fontWeight: typography.medium,
  },
  emptyRequest: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  emptyRequestText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeightMd,
  },
  requestItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  requestItemCardInfo: {
    flex: 1,
  },
  requestItemCardName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  requestItemCardPrice: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  qtyText: {
    paddingHorizontal: spacing.sm,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
  requestItemSubtotal: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.primary,
    minWidth: 70,
    textAlign: 'right',
  },
  requestNotesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  requestTotalSection: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTotalLabel: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  requestTotalValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  submitRequestButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  submitRequestButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  submitRequestButtonText: {
    color: colors.white,
    fontWeight: typography.bold,
    fontSize: typography.md,
  },
});

export default TechnicianResourceManagementScreen;