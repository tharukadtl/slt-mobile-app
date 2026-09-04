import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {TeamLeadStackParamList} from '@appTypes/navigation.types';
import {colors} from '@theme/colors';
import {typography} from '@theme/typography';
import {spacing} from '@theme/spacing';
import {useAppDispatch, useAppSelector} from '@store/hooks';
import {performBOD, submitMaterialRequest} from '@store/slices/technicianSlice';
import Geolocation from '@react-native-community/geolocation';
import MapView, {Marker, UrlTile} from 'react-native-maps';
import api from '@services/api';
import technicianService from '@services/technicianService';

type BODNavigationProp = StackNavigationProp<TeamLeadStackParamList>;

interface Technician {
  id: number;
  username: string;
  fullName?: string;
  phone?: string;
  isActive?: boolean;
  role?: string;
}

interface Vehicle {
  id: number;
  registrationNumber: string;
  make?: string;
  model?: string;
  status?: string;
}

// FR-33 Stage 3b — GET /api/resource-plans/lookup. One row per shift that has
// a confirmed Predictive Resource Plan for this Team Lead's own OPMC today.
// Starting-point suggestions only (SRS 5.6.8) — nothing here is locked or
// auto-submitted; the Team Lead can adjust every field below regardless.
interface SuggestedMaterial {
  materialId: number | null;
  materialName: string;
  suggestedQuantity: number | null;
  unit?: string | null;
}

interface SuggestedPlanRow {
  shift: string;
  zoneName?: string;
  predictedFaultCount?: number;
  suggestedTechnicians: number | null;
  suggestedVehicles: number | null;
  materials: SuggestedMaterial[];
}

const SHIFT_LABEL: Record<string, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
};

// SRS 5.4.0 — Material Allocation. Design decision (investigated, not
// assumed): TEAM_LEAD has zero direct stock-mutation capability anywhere in
// the backend (every /stock/adjust, /material-requests/{id}/approve|deliver
// endpoint is ADMIN-only) — the only real mechanism a Team Lead has for
// getting materials is submitting a MaterialRequest for Admin approval,
// already proven end-to-end via teamlead/MaterialRequestScreen.tsx. So "BOD
// material allocation" reuses that exact mechanism (submitMaterialRequest)
// rather than inventing a new "allocation" entity that would bypass the
// same stock governance every other material flow goes through — it's
// submitted as one request, tagged to this BOD session via the existing
// `taskId` field (no new backend field needed), right after BOD succeeds.
// Mirrors backend's StockDTO.StockLevelDTO (InventoryController's
// GET /api/inventory/materials/search) — used for the live stock browser.
interface MaterialSearchResult {
  materialId: number;
  materialName: string;
  sku?: string;
  unit?: string;
  currentStock: number;
  minThreshold?: number;
  stockStatus?: string;
}

interface AllocatedMaterial {
  materialId: number;
  name: string;
  quantity: number;
  unit?: string;
  currentStock: number;
  stockStatus?: string;
}

const getStockStatusColor = (status?: string) => {
  switch (status) {
    case 'IN_STOCK': return colors.success;
    case 'LOW_STOCK': return colors.warning;
    case 'OUT_OF_STOCK': return colors.error;
    default: return colors.textSecondary;
  }
};

const BODScreen = () => {
  const navigation = useNavigation<BODNavigationProp>();
  const dispatch = useAppDispatch();
  const {isLoading} = useAppSelector(state => state.technician);
  const {user} = useAppSelector(state => state.auth);

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [odometerStart, setOdometerStart] = useState('');

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);

  const [suggestedPlan, setSuggestedPlan] = useState<SuggestedPlanRow[]>([]);
  const [loadingSuggestedPlan, setLoadingSuggestedPlan] = useState(false);
  // Pre-check technicians from the suggestion exactly once — never re-apply
  // on a later re-render/refetch, so it can't stomp on a manual adjustment.
  const appliedSuggestionRef = useRef(false);

  // Material Allocation (SRS 5.4.0) — searchable live-stock browser + a
  // running allocation list, submitted as one MaterialRequest right after
  // BOD succeeds.
  const [materialSearchText, setMaterialSearchText] = useState('');
  const [materialSearchResults, setMaterialSearchResults] = useState<MaterialSearchResult[]>([]);
  const [loadingMaterialSearch, setLoadingMaterialSearch] = useState(false);
  const [allocatedMaterials, setAllocatedMaterials] = useState<AllocatedMaterial[]>([]);

  useEffect(() => {
    fetchTechnicians();
    fetchVehicles();
    fetchSuggestedPlan();
    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.opmcId]);

  useEffect(() => {
    if (appliedSuggestionRef.current) return;
    if (technicians.length === 0 || suggestedPlan.length === 0) return;

    const maxSuggestedTechnicians = Math.max(
      0,
      ...suggestedPlan.map(p => p.suggestedTechnicians ?? 0),
    );
    if (maxSuggestedTechnicians > 0) {
      const startingIds = technicians
        .filter(t => t.isActive !== false)
        .slice(0, maxSuggestedTechnicians)
        .map(t => t.id);
      setSelectedIds(startingIds);
    }
    appliedSuggestionRef.current = true;
  }, [technicians, suggestedPlan]);

  const fetchTechnicians = async () => {
    setLoadingTechs(true);
    try {
      const opmcId = user?.opmcId;
      const url = opmcId
        ? `/api/users?role=TECHNICIAN&opmcId=${opmcId}&activeOnly=true`
        : '/api/users?role=TECHNICIAN';
      const response = await api.get(url);
      setTechnicians(response.data);
    } catch {
      Alert.alert('Error', 'Failed to load technicians');
    } finally {
      setLoadingTechs(false);
    }
  };

  const fetchVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const opmcId = user?.opmcId;
      const url = opmcId
        ? `/api/vehicles?opmcId=${opmcId}&activeOnly=true`
        : '/api/vehicles';
      const response = await api.get(url);
      setVehicles(response.data);
    } catch {
      // non-fatal — vehicle selection remains optional
    } finally {
      setLoadingVehicles(false);
    }
  };

  const fetchSuggestedPlan = async () => {
    setLoadingSuggestedPlan(true);
    try {
      // No `date` param — the backend defaults to today's date server-side,
      // avoiding any client/server timezone mismatch on "today".
      const response = await api.get('/api/resource-plans/lookup');
      setSuggestedPlan(response.data || []);
    } catch {
      // Non-fatal — no confirmed plan for today (or admin hasn't set one up
      // yet) just means BOD starts blank, same as before Stage 3b.
      setSuggestedPlan([]);
    } finally {
      setLoadingSuggestedPlan(false);
    }
  };

  // Debounced live-stock search — same pattern already used by
  // technician/ResourceManagementScreen.tsx for its inventory browser.
  useEffect(() => {
    if (!materialSearchText.trim()) {
      setMaterialSearchResults([]);
      return;
    }
    let cancelled = false;
    setLoadingMaterialSearch(true);
    const timer = setTimeout(async () => {
      try {
        const results = await technicianService.searchMaterials(materialSearchText);
        if (!cancelled) setMaterialSearchResults(Array.isArray(results) ? results : []);
      } catch {
        if (!cancelled) setMaterialSearchResults([]);
      } finally {
        if (!cancelled) setLoadingMaterialSearch(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [materialSearchText]);

  const addMaterial = (item: MaterialSearchResult, quantity: number = 1) => {
    setAllocatedMaterials(prev => {
      const existing = prev.find(m => m.materialId === item.materialId);
      if (existing) {
        return prev.map(m =>
          m.materialId === item.materialId ? {...m, quantity: m.quantity + quantity} : m,
        );
      }
      return [
        ...prev,
        {
          materialId: item.materialId,
          name: item.materialName,
          quantity,
          unit: item.unit,
          currentStock: item.currentStock,
          stockStatus: item.stockStatus,
        },
      ];
    });
    setMaterialSearchText('');
    setMaterialSearchResults([]);
  };

  const removeMaterial = (materialId: number) => {
    setAllocatedMaterials(prev => prev.filter(m => m.materialId !== materialId));
  };

  const updateMaterialQuantity = (materialId: number, quantity: number) => {
    if (quantity <= 0) {
      removeMaterial(materialId);
      return;
    }
    setAllocatedMaterials(prev =>
      prev.map(m => (m.materialId === materialId ? {...m, quantity} : m)),
    );
  };

  // One-shot pull from the FR-33 suggested plan (informed by it, not blocked
  // on it) — resolves each suggestion's materialName against a live stock
  // search, since the suggestion itself carries no stock/unit context beyond
  // materialId/name/unit. Skips suggestions with no materialId (can't order
  // stock for a suggestion that isn't tied to a real Material row).
  const addSuggestedMaterials = async () => {
    const suggested = suggestedPlan
      .flatMap(p => p.materials)
      .filter(m => m.materialId != null);
    for (const m of suggested) {
      try {
        const results = await technicianService.searchMaterials(m.materialName);
        const match = results.find((r: any) => r.materialId === m.materialId);
        if (match) {
          addMaterial(
            {
              materialId: match.materialId,
              materialName: match.materialName,
              unit: match.unit,
              currentStock: match.currentStock,
              stockStatus: match.stockStatus,
            },
            Math.max(1, Math.round(m.suggestedQuantity ?? 1)),
          );
        }
      } catch {
        // Non-fatal — skip this suggestion, Team Lead can still add it manually.
      }
    }
  };

  const applyCoords = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await res.json();
      setLocation({
        latitude,
        longitude,
        address: data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      });
    } catch {
      setLocation({latitude, longitude, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`});
    }
    setGettingLocation(false);
  };

  const getLocation = async () => {
    // Request permission (Android only — on iOS Geolocation handles it natively)
    if (PermissionsAndroid.request) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'SLT App needs your location for BOD check-in',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Permission Denied',
          'Location permission was denied. You can still submit BOD without it.',
        );
        return;
      }
    }

    setGettingLocation(true);

    // First attempt: high-accuracy GPS (15 s)
    Geolocation.getCurrentPosition(
      pos => applyCoords(pos.coords.latitude, pos.coords.longitude),
      () => {
        // Fallback: network/coarse location (10 s)
        Geolocation.getCurrentPosition(
          pos => applyCoords(pos.coords.latitude, pos.coords.longitude),
          error => {
            setGettingLocation(false);
            const msg =
              error.code === 1
                ? 'Location permission denied. Enable it in Settings.'
                : error.code === 2
                ? 'Location unavailable. Make sure GPS or Wi-Fi is on.'
                : 'Location timed out. You can submit BOD without it.';
            Alert.alert('Location Error', msg);
          },
          {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000},
        );
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
    );
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {headers: {'User-Agent': 'SLTMobileApp/1.0'}},
      );
      const data = await res.json();
      return data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    } catch {
      return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
  };

  const toggleTechnician = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Validation', 'Please select at least one technician');
      return;
    }

    const payload: any = {
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      locationAddress: location?.address ?? null,
      technicianIds: selectedIds,
    };
    if (selectedVehicleId != null) {
      payload.vehicleId = selectedVehicleId;
    }
    if (odometerStart.trim()) {
      payload.odometerStart = parseInt(odometerStart, 10);
    }

    const result = await dispatch(performBOD(payload));
    if (!performBOD.fulfilled.match(result)) {
      Alert.alert(
        'Error',
        (result.payload as string) || 'BOD submission failed',
      );
      return;
    }

    // Material allocation is a real request to Admin (SRS 5.4.0 — Team Lead
    // has no direct stock authority, see the design-decision comment on
    // AllocatedMaterial above), submitted as its own MaterialRequest tagged
    // to this BOD session via the existing taskId field — not a new backend
    // concept. Best-effort: BOD (the time-critical part — dispatching the
    // team) already succeeded, so a failed material submission is surfaced
    // honestly rather than either silently dropped or blocking navigation.
    if (allocatedMaterials.length > 0) {
      const sessionId = (result.payload as {id: number}).id;
      const matResult = await dispatch(
        submitMaterialRequest({
          taskId: `BOD-${sessionId}`,
          materials: allocatedMaterials.map(m => ({
            materialId: String(m.materialId),
            quantity: m.quantity,
          })),
          notes: `BOD material allocation for today's session.`,
        }),
      );
      if (!submitMaterialRequest.fulfilled.match(matResult)) {
        Alert.alert(
          'BOD Started, Material Request Failed',
          `Your day has started, but the material allocation could not be submitted: ${
            (matResult.payload as string) || 'unknown error'
          }. You can submit it separately from Material Requests.`,
          [{text: 'OK', onPress: () => navigation.replace('AssignJobs')}],
        );
        return;
      }
    }

    navigation.replace('AssignJobs');
  };

  return (
    <View style={styles.container}>
      {/* Header — no back button; BOD is a required gate */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Beginning of Day</Text>
        <Text style={styles.headerSubtitle}>Start your team's daily session</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Current Location</Text>
          {gettingLocation ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.locationText}>Getting location...</Text>
            </View>
          ) : !gettingLocation && !location ? (
            <View>
              <Text style={styles.locationWarning}>
                ⚠️ Location unavailable — you can still submit BOD without it.
              </Text>
              <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
                <Text style={styles.retryText}>🔄 Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : location ? (
            <>
              <MapView
                style={styles.map}
                region={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                }}>
                <UrlTile
                  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                  flipY={false}
                />
                <Marker
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  draggable
                  onDragEnd={async e => {
                    const {latitude, longitude} = e.nativeEvent.coordinate;
                    const address = await reverseGeocode(latitude, longitude);
                    setLocation({latitude, longitude, address});
                  }}
                />
              </MapView>
              <Text style={styles.locationText} numberOfLines={2}>
                {location.address}
              </Text>
              <Text style={styles.coordsText}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
              <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
                <Text style={styles.retryText}>🔄 Refresh Location</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={getLocation} style={styles.retryButton}>
              <Text style={styles.retryText}>🔄 Get Location</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Suggested Resource Plan (Stage 3b) — starting point only, nothing
            here is locked; Technicians below are pre-checked from this, but
            Vehicle/Material stay informational since BOD only supports a
            single vehicle and has no material-quantity field of its own. */}
        {!loadingSuggestedPlan && suggestedPlan.length > 0 && (
          <View style={[styles.card, styles.suggestionCard]}>
            <Text style={styles.sectionTitle}>📊 Suggested for Today</Text>
            <Text style={styles.suggestionSubtitle}>
              From Resource Planning — a starting point you can adjust below.
            </Text>
            {suggestedPlan.map((row, i) => (
              <View key={`${row.shift}-${i}`} style={styles.suggestionRow}>
                <Text style={styles.suggestionShift}>
                  {SHIFT_LABEL[row.shift] || row.shift}
                  {row.zoneName ? ` · ${row.zoneName}` : ''}
                </Text>
                <Text style={styles.suggestionDetail}>
                  👥 {row.suggestedTechnicians ?? '—'} technicians · 🚗{' '}
                  {row.suggestedVehicles ?? '—'} vehicles
                </Text>
                {row.materials.length > 0 && (
                  <Text style={styles.suggestionMaterials}>
                    📦{' '}
                    {row.materials
                      .map(
                        m =>
                          `${m.materialName}: ${m.suggestedQuantity ?? '—'}${
                            m.unit ? ` ${m.unit}` : ''
                          }`,
                      )
                      .join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Vehicle Selection (Optional) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🚗 Vehicle (Optional)</Text>
          {loadingVehicles ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : vehicles.length === 0 ? (
            <Text style={styles.emptyText}>No active vehicles found</Text>
          ) : (
            <>
              {/* None option */}
              <TouchableOpacity
                style={[
                  styles.vehicleRow,
                  selectedVehicleId === null && styles.vehicleRowSelected,
                ]}
                onPress={() => setSelectedVehicleId(null)}>
                <View
                  style={[
                    styles.radio,
                    selectedVehicleId === null && styles.radioSelected,
                  ]}>
                  {selectedVehicleId === null && (
                    <View style={styles.radioDot} />
                  )}
                </View>
                <Text style={styles.vehicleLabel}>None</Text>
              </TouchableOpacity>

              {vehicles.map(v => {
                const selected = selectedVehicleId === v.id;
                const label = [v.registrationNumber, v.make, v.model]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.vehicleRow,
                      selected && styles.vehicleRowSelected,
                    ]}
                    onPress={() => setSelectedVehicleId(v.id)}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleLabel}>{label}</Text>
                      {v.status && (
                        <Text style={styles.vehicleStatus}>{v.status}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {selectedVehicleId != null && (
            <TextInput
              style={[styles.input, {marginTop: spacing.sm}]}
              placeholder="Odometer Start (km)"
              placeholderTextColor={colors.textLight}
              value={odometerStart}
              onChangeText={setOdometerStart}
              keyboardType="numeric"
            />
          )}
        </View>

        {/* Material Allocation (SRS 5.4.0) — submitted as a MaterialRequest
            right after BOD succeeds, see the design-decision comment above. */}
        <View style={styles.card}>
          <View style={styles.materialHeaderRow}>
            <Text style={styles.sectionTitle}>📦 Material Allocation (Optional)</Text>
            {suggestedPlan.some(p => p.materials.length > 0) && (
              <TouchableOpacity onPress={addSuggestedMaterials}>
                <Text style={styles.addSuggestedText}>+ Add Suggested</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Search materials to allocate..."
            placeholderTextColor={colors.textLight}
            value={materialSearchText}
            onChangeText={setMaterialSearchText}
          />

          {loadingMaterialSearch ? (
            <ActivityIndicator size="small" color={colors.primary} style={{marginTop: spacing.sm}} />
          ) : (
            materialSearchResults.length > 0 && (
              <View style={styles.searchResults}>
                {materialSearchResults.map(item => (
                  <TouchableOpacity
                    key={item.materialId}
                    style={styles.searchResultRow}
                    onPress={() => addMaterial(item)}>
                    <View style={{flex: 1}}>
                      <Text style={styles.vehicleLabel}>{item.materialName}</Text>
                      <Text
                        style={[
                          styles.stockText,
                          {color: getStockStatusColor(item.stockStatus)},
                        ]}>
                        {item.currentStock} {item.unit || ''} in stock
                        {item.stockStatus ? ` · ${item.stockStatus.replace('_', ' ')}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.addText}>+ Add</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}

          {allocatedMaterials.length === 0 ? (
            <Text style={styles.emptyText}>No materials allocated yet.</Text>
          ) : (
            allocatedMaterials.map(m => {
              const overStock = m.quantity > m.currentStock;
              return (
                <View key={m.materialId} style={styles.allocatedRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.vehicleLabel}>{m.name}</Text>
                    <Text
                      style={[
                        styles.stockText,
                        {color: overStock ? colors.error : getStockStatusColor(m.stockStatus)},
                      ]}>
                      {overStock
                        ? `⚠️ Only ${m.currentStock} ${m.unit || ''} in stock`
                        : `${m.currentStock} ${m.unit || ''} in stock`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => updateMaterialQuantity(m.materialId, m.quantity - 1)}
                    style={styles.qtyButton}>
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{m.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => updateMaterialQuantity(m.materialId, m.quantity + 1)}
                    style={styles.qtyButton}>
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeMaterial(m.materialId)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Technician Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            👥 Select Technicians ({selectedIds.length} selected)
          </Text>
          {loadingTechs ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : technicians.length === 0 ? (
            <Text style={styles.emptyText}>No technicians found</Text>
          ) : (
            technicians.map(tech => {
              const selected = selectedIds.includes(tech.id);
              const displayName = tech.fullName || tech.username || 'User';
              return (
                <TouchableOpacity
                  key={tech.id}
                  style={[styles.techRow, selected && styles.techRowSelected]}
                  onPress={() => toggleTechnician(tech.id)}>
                  <View
                    style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.techAvatar}>
                    <Text style={styles.techAvatarText}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.techInfo}>
                    <Text style={styles.techName}>{displayName}</Text>
                    {tech.phone && (
                      <Text style={styles.techPhone}>{tech.phone}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: tech.isActive
                          ? colors.success
                          : colors.error,
                      },
                    ]}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isLoading || selectedIds.length === 0) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading || selectedIds.length === 0}>
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>🌅 Start BOD Session</Text>
          )}
        </TouchableOpacity>
      </View>
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
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
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  suggestionCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    backgroundColor: colors.secondary + '08',
  },
  suggestionSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  suggestionRow: {
    marginBottom: spacing.sm,
  },
  suggestionShift: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  suggestionDetail: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  suggestionMaterials: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  coordsText: {
    fontSize: typography.xs,
    color: colors.textLight,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
  map: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  retryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retryText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  locationWarning: {
    fontSize: typography.sm,
    color: colors.warning,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  materialHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addSuggestedText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  searchResults: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  stockText: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  addText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  allocatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  qtyValue: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  removeText: {
    color: colors.error,
    fontSize: typography.md,
    fontWeight: typography.bold,
    paddingHorizontal: spacing.xs,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  vehicleRowSelected: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  vehicleStatus: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  techRowSelected: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: typography.bold,
  },
  techAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  techAvatarText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  techInfo: {
    flex: 1,
  },
  techName: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  techPhone: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
});

export default BODScreen;
