import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {TechnicianStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {Material} from '@appTypes/technician.types';
import technicianService from '@services/technicianService';

type MaterialsRouteProp = RouteProp<TechnicianStackParamList, 'Materials'>;

const MaterialsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<MaterialsRouteProp>();
  const {taskId} = route.params;

  const [materials, setMaterials] = useState<Material[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  const handleAdd = () => {
    if (!name || !quantity || !unit) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const newMaterial: Material = {
      id: Date.now().toString(),
      name,
      quantity: parseInt(quantity),
      unit,
    };
    setMaterials([...materials, newMaterial]);
    setName('');
    setQuantity('');
    setUnit('');
  };

  const handleRemove = (id: string) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  const handleSubmit = async () => {
    await technicianService.submitMaterials(taskId, materials);
    Alert.alert('Success', 'Materials submitted successfully', [
      {text: 'OK', onPress: () => navigation.goBack()},
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Materials Used</Text>
      </View>

      <View style={styles.content}>
        {/* Add Material Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Material</Text>
          <TextInput
            style={styles.input}
            placeholder="Material name"
            placeholderTextColor={colors.textLight}
            value={name}
            onChangeText={setName}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Quantity"
              placeholderTextColor={colors.textLight}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Unit (e.g. pcs)"
              placeholderTextColor={colors.textLight}
              value={unit}
              onChangeText={setUnit}
            />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>+ Add Material</Text>
          </TouchableOpacity>
        </View>

        {/* Materials List */}
        {materials.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Added Materials</Text>
            {materials.map(material => (
              <View key={material.id} style={styles.materialRow}>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialName}>{material.name}</Text>
                  <Text style={styles.materialQty}>
                    {material.quantity} {material.unit}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(material.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {materials.length > 0 && (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Materials</Text>
          </TouchableOpacity>
        )}
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
  content: {
    padding: spacing.lg,
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
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  materialQty: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  removeText: {
    color: colors.error,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default MaterialsScreen;