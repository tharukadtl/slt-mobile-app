import {useEffect, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import notificationService, {
  NotificationData,
} from '@services/notificationService';

const useNotifications = () => {
  const navigation = useNavigation();

  const handleNotification = useCallback(
    (data: NotificationData) => {
      // Keyed on referenceType — the small, stable category the backend
      // already attaches to every notification (NotificationService.sendPush's
      // FCM data payload) — rather than the full, ever-growing NotificationType
      // enum (FAULT_REPORTED/FAULT_ASSIGNED/PAYMENT_APPROVED/... 20+ values).
      switch (data.referenceType) {
        case 'FAULT':
          if (data.referenceId) {
            navigation.navigate(
              'IssueDetail' as never,
              {issueId: data.referenceId} as never,
            );
          }
          break;
        case 'PAYMENT':
          if (data.referenceId) {
            navigation.navigate(
              'BillDetail' as never,
              {billId: data.referenceId} as never,
            );
          } else {
            navigation.navigate('BillingHistory' as never);
          }
          break;
        default:
          break;
      }
    },
    [navigation],
  );

  useEffect(() => {
    notificationService.initialize(handleNotification);
  }, [handleNotification]);
};

export default useNotifications;