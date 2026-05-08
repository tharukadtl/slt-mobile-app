import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {submitMaterialRequest} from '@store/slices/technicianSlice';
import {formatCurrency} from '@utils/formatters';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
type MaterialRequestRouteProp = RouteProp<TeamLeadStackParamList, 'MaterialRequest'>;


type Props = NativeStackScreenProps<
  TeamLeadStackParamList,
  'MaterialRequest'
>;

interface RequestedMaterial {
  materialId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  availableStock: number;
}

const AVAILABLE_INVENTORY = [
  {
    id: '1',
    name: 'Fiber Optic Cable',
    unitPrice: 150,
    unit: 'meters',
    availableStock: 500,
    category: 'Cable',
  },
  {
    id: '2',
    name: 'RJ45 Connector',
    unitPrice: 25,
    unit: 'pcs',
    availableStock: 200,
    category: 'Connector',
  },
  {
    id: '3',
    name: 'Network Switch 8-Port',
    unitPrice: 2500,
    unit: 'pcs',
    availableStock: 15,
    category: 'Network',
  },
  {
    id: '4',
    name: 'Router Wireless',
    unitPrice: 3500,
    unit: 'pcs',
    availableStock: 10,
    category: 'Network',
  },
  {
    id: '5',
    name: 'Cable Ties (Pack)',
    unitPrice: 50,
    unit: 'pack',
    availableStock: 100,
    category: 'Accessory',
  },
  {
    id: '6',
    name: 'Wall Socket Cat6',
    unitPrice: 120,
    unit: 'pcs',
    availableStock: 80,
    category: 'Socket',
  },
  {
    id: '7',
    name: 'Patch Cable 1m',
    unitPrice: 200,
    unit: 'pcs',
    availableStock: 150,
    category: 'Cable',
  },
  {
    id: '8',
    name: 'Signal Booster',
    unitPrice: 1800,
    unit: 'pcs',
    availableStock: 20,
    category: 'Equipment',
  },
  {
    id: '9',
    name: 'Ethernet Cable 5m',
    unitPrice: 350,
    unit: 'pcs',
    availableStock: 60,
    category: 'Cable',
  },
  {
    id: '10',
    name: 'Power Adapter',
    unitPrice: 450,
    unit: 'pcs',
    availableStock: 30,
    category: 'Power',
  },
];

const MaterialRequestScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<MaterialRequestRouteProp>();
  const {taskId} = route.params;
  const dispatch = useAppDispatch();
  const {isLoading} = useAppSelector(state => state.technician);

  const [requestedMaterials, setRequestedMaterials] = useState<RequestedMaterial[]>([]);
  const [notes, setNotes] = useState('');
  const [showInventory, setShowInventory] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    'All',
    ...new Set(AVAILABLE_INVENTORY.map(m => m.category)),
  ];

  const filteredInventory = AVAILABLE_INVENTORY.filter(item => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchText.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' ||
      item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddMaterial = (item: (typeof AVAILABLE_INVENTORY)[0]) => {
    const existing = requestedMaterials.find(
      m => m.materialId === item.id,
    );
    if (existing) {
      Alert.alert('Already Added', 'This material is already in your request');
      return;
    }
    setRequestedMaterials([
      ...requestedMaterials,
      {
        materialId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: item.unitPrice,
        unit: item.unit,
        availableStock: item.availableStock,
      },
    ]);
    setShowInventory(false);
  };

  const handleQuantityChange = (
    materialId: string,
    delta: number,
  ) => {
    setRequestedMaterials(
      requestedMaterials.map(m => {
        if (m.materialId === materialId) {
          const newQty = Math.max(
            1,
            Math.min(m.availableStock, m.quantity + delta),
          );
          return {...m, quantity: newQty};
        }
        return m;
      }),
    );
  };

  const handleRemove = (materialId: string) => {
    setRequestedMaterials(
      requestedMaterials.filter(m => m.materialId !== materialId),
    );
  };

  const totalCost = requestedMaterials.reduce(
    (sum, m) => sum + m.quantity * m.unitPrice,
    0,
  );

  const handleSubmit = async () => {
    if (requestedMaterials.length === 0) {
      Alert.alert('Error', 'Please add at least one material');
      return;
    }

    Alert.alert(
      'Submit Material Request',
      `Total: ${formatCurrency(totalCost)}\nItems: ${
        requestedMaterials.length
      }\n\nSubmit this request?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Submit',
          onPress: async () => {
            const result = await dispatch(
              submitMaterialRequest({
                taskId,
                materials: requestedMaterials.map(m => ({
                  materialId: m.materialId,
                  quantity: m.quantity,
                })),
                notes,
              }),
            );

            if (
              submitMaterialRequest.fulfilled.match(result) ||
              submitMaterialRequest.rejected.match(result)
            ) {
              Alert.alert(
                'Request Submitted ✅',
                'Your material request has been submitted for approval',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Material Request</Text>
        <Text style={styles.headerSubtitle}>Task #{taskId}</Text>
      </View>

      <View style={styles.content}>
        {/* Requested Materials */}
        <Text style={styles.sectionTitle}>
          Requested Materials ({requestedMaterials.length})
        </Text>

        {requestedMaterials.map(material => (
          <View key={material.materialId} style={styles.materialCard}>
            <View style={styles.materialHeader}>
              <Text style={styles.materialName}>{material.name}</Text>
              <TouchableOpacity
                onPress={() => handleRemove(material.materialId)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.materialDetails}>
              <View style={styles.quantityStepper}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    handleQuantityChange(material.materialId, -1)
                  }>
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>
                  {material.quantity}
                </Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    handleQuantityChange(material.materialId, 1)
                  }>
                  <Text style={styles.stepperButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.materialUnit}>
                {material.unit}
              </Text>
              <Text style={styles.materialPrice}>
                {formatCurrency(
                  material.quantity * material.unitPrice,
                )}
              </Text>
            </View>
            <Text style={styles.stockInfo}>
              Available: {material.availableStock} {material.unit}
            </Text>
          </View>
        ))}

        {/* Add Material Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowInventory(true)}>
          <Text style={styles.addButtonText}>
            + Add Material from Inventory
          </Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add any special instructions or notes..."
          placeholderTextColor={colors.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Summary */}
        {requestedMaterials.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              Request Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Items:</Text>
              <Text style={styles.summaryValue}>
                {requestedMaterials.reduce(
                  (sum, m) => sum + m.quantity,
                  0,
                )}{' '}
                units
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Estimated Cost:
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  {color: colors.primary},
                ]}>
                {formatCurrency(totalCost)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Task ID:</Text>
              <Text style={styles.summaryValue}>#{taskId}</Text>
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            requestedMaterials.length === 0 &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading || requestedMaterials.length === 0}>
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              Submit Request
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Inventory Modal */}
      <Modal
        visible={showInventory}
        animationType="slide"
        onRequestClose={() => setShowInventory(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Material</Text>
            <TouchableOpacity
              onPress={() => setShowInventory(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search materials..."
              placeholderTextColor={colors.textLight}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilter}
            contentContainerStyle={styles.categoryFilterContent}>
            {categories.map(cat => (
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

          {/* Inventory List */}
          <FlatList
            data={filteredInventory}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <TouchableOpacity
                style={[
                  styles.inventoryItem,
                  item.availableStock === 0 &&
                    styles.inventoryItemOutOfStock,
                ]}
                onPress={() =>
                  item.availableStock > 0 && handleAddMaterial(item)
                }
                disabled={item.availableStock === 0}>
                <View style={styles.inventoryItemLeft}>
                  <View style={styles.inventoryItemCategory}>
                    <Text style={styles.inventoryItemCategoryText}>
                      {item.category.charAt(0)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.inventoryItemName}>
                      {item.name}
                    </Text>
                    <Text style={styles.inventoryItemDetails}>
                      {formatCurrency(item.unitPrice)}/{item.unit} •
                      Stock: {item.availableStock}
                    </Text>
                  </View>
                </View>
                {item.availableStock === 0 ? (
                  <Text style={styles.outOfStockText}>
                    Out of Stock
                  </Text>
                ) : (
                  <Text style={styles.addInventoryIcon}>+</Text>
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.inventoryList}
          />
        </View>
      </Modal>
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
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  materialCard: {
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
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  materialName: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  removeText: {
    color: colors.error,
    fontSize: typography.lg,
    fontWeight: typography.bold,
    padding: spacing.xs,
  },
  materialDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepperButton: {
    width: 32,
    height: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  quantityText: {
    paddingHorizontal: spacing.md,
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  materialUnit: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  materialPrice: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.primary,
  },
  stockInfo: {
    fontSize: typography.xs,
    color: colors.textLight,
  },
  addButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  notesInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  summaryTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
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
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.primary,
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  modalClose: {
    color: colors.white,
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
  categoryFilter: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  categoryFilterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
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
  inventoryList: {
    padding: spacing.md,
  },
  inventoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  inventoryItemOutOfStock: {
    opacity: 0.5,
  },
  inventoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  inventoryItemCategory: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inventoryItemCategoryText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  inventoryItemName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  inventoryItemDetails: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  outOfStockText: {
    fontSize: typography.xs,
    color: colors.error,
    fontWeight: typography.bold,
  },
  addInventoryIcon: {
    fontSize: typography.xxl,
    color: colors.primary,
    fontWeight: typography.bold,
    paddingHorizontal: spacing.sm,
  },
});

export default MaterialRequestScreen;