import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import {PaymentMaterial} from '@appTypes/technician.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {formatCurrency} from '@utils/formatters';

const AVAILABLE_MATERIALS = [
  {id: '1', name: 'Fiber Optic Cable', unitPrice: 150},
  {id: '2', name: 'RJ45 Connector', unitPrice: 25},
  {id: '3', name: 'Network Switch', unitPrice: 2500},
  {id: '4', name: 'Router', unitPrice: 3500},
  {id: '5', name: 'Cable Tie', unitPrice: 5},
  {id: '6', name: 'Wall Socket', unitPrice: 120},
  {id: '7', name: 'Patch Cable', unitPrice: 200},
  {id: '8', name: 'Signal Booster', unitPrice: 1800},
];

interface Step1MaterialsProps {
  materials: PaymentMaterial[];
  onMaterialsChange: (materials: PaymentMaterial[]) => void;
  materialsFOC: number;
  materialsChargeable: number;
}

const Step1Materials: React.FC<Step1MaterialsProps> = ({
  materials,
  onMaterialsChange,
  materialsFOC,
  materialsChargeable,
}) => {
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filteredMaterials = AVAILABLE_MATERIALS.filter(m =>
    m.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const handleAddMaterial = (material: {
    id: string;
    name: string;
    unitPrice: number;
  }) => {
    const existing = materials.find(m => m.id === material.id);
    if (existing) {
      Alert.alert('Already Added', 'This material is already in the list');
      return;
    }
    const newMaterial: PaymentMaterial = {
      id: material.id,
      name: material.name,
      quantity: 1,
      unitPrice: material.unitPrice,
      type: 'CHARGEABLE',
      subtotal: material.unitPrice,
    };
    onMaterialsChange([...materials, newMaterial]);
    setShowMaterialPicker(false);
    setSearchText('');
  };

  const handleQuantityChange = (id: string, delta: number) => {
    const updated = materials.map(m => {
      if (m.id === id) {
        const newQty = Math.max(1, m.quantity + delta);
        return {...m, quantity: newQty, subtotal: newQty * m.unitPrice};
      }
      return m;
    });
    onMaterialsChange(updated);
  };

  const handleTypeToggle = (id: string) => {
    const updated = materials.map(m => {
      if (m.id === id) {
        return {
          ...m,
          type: m.type === 'FOC' ? 'CHARGEABLE' : ('FOC' as any),
        };
      }
      return m;
    });
    onMaterialsChange(updated);
  };

  const handleRemove = (id: string) => {
    onMaterialsChange(materials.filter(m => m.id !== id));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 1: Materials Used</Text>
      <Text style={styles.stepDescription}>
        Add materials used and categorize as FOC or Chargeable
      </Text>

      {/* Materials List */}
      {materials.map(material => (
        <View key={material.id} style={styles.materialCard}>
          <View style={styles.materialHeader}>
            <Text style={styles.materialName}>{material.name}</Text>
            <TouchableOpacity onPress={() => handleRemove(material.id)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.materialDetails}>
            {/* Quantity Stepper */}
            <View style={styles.quantityStepper}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleQuantityChange(material.id, -1)}>
                <Text style={styles.stepperButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{material.quantity}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleQuantityChange(material.id, 1)}>
                <Text style={styles.stepperButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Unit Price */}
            <Text style={styles.unitPrice}>
              {formatCurrency(material.unitPrice)}/unit
            </Text>

            {/* FOC/Chargeable Toggle */}
            <View style={styles.typeToggle}>
              <Text
                style={[
                  styles.typeLabel,
                  material.type === 'FOC' && styles.typeLabelFOC,
                ]}>
                {material.type === 'FOC' ? 'FOC' : 'Charge'}
              </Text>
              <Switch
                value={material.type === 'CHARGEABLE'}
                onValueChange={() => handleTypeToggle(material.id)}
                trackColor={{
                  false: colors.success + '80',
                  true: colors.warning + '80',
                }}
                thumbColor={
                  material.type === 'CHARGEABLE'
                    ? colors.warning
                    : colors.success
                }
              />
            </View>
          </View>

          {/* Subtotal */}
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Subtotal:</Text>
            <Text
              style={[
                styles.subtotalValue,
                material.type === 'FOC'
                  ? styles.subtotalFOC
                  : styles.subtotalChargeable,
              ]}>
              {formatCurrency(material.subtotal)}{' '}
              ({material.type})
            </Text>
          </View>
        </View>
      ))}

      {/* Add Material Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowMaterialPicker(true)}>
        <Text style={styles.addButtonText}>+ Add Material</Text>
      </TouchableOpacity>

      {/* Summary Card */}
      {materials.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Materials FOC:</Text>
            <Text style={[styles.summaryValue, {color: colors.success}]}>
              {formatCurrency(materialsFOC)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Materials Chargeable:
            </Text>
            <Text
              style={[styles.summaryValue, {color: colors.warning}]}>
              {formatCurrency(materialsChargeable)}
            </Text>
          </View>
        </View>
      )}

      {/* Material Picker Modal */}
      <Modal
        visible={showMaterialPicker}
        animationType="slide"
        onRequestClose={() => setShowMaterialPicker(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Material</Text>
            <TouchableOpacity
              onPress={() => setShowMaterialPicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search materials..."
            placeholderTextColor={colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          <FlatList
            data={filteredMaterials}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.materialPickerItem}
                onPress={() => handleAddMaterial(item)}>
                <View>
                  <Text style={styles.materialPickerName}>
                    {item.name}
                  </Text>
                  <Text style={styles.materialPickerPrice}>
                    {formatCurrency(item.unitPrice)}/unit
                  </Text>
                </View>
                <Text style={styles.addIcon}>+</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.sm,
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
  unitPrice: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  typeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.warning,
  },
  typeLabelFOC: {
    color: colors.success,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.background,
    paddingTop: spacing.sm,
  },
  subtotalLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  subtotalValue: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  subtotalFOC: {
    color: colors.success,
  },
  subtotalChargeable: {
    color: colors.warning,
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
  summaryCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
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
  searchInput: {
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  materialPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    elevation: 1,
  },
  materialPickerName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  materialPickerPrice: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addIcon: {
    fontSize: typography.xl,
    color: colors.primary,
    fontWeight: typography.bold,
  },
});

export default Step1Materials;