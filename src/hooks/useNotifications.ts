import {useEffect, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import notificationService, {
  NotificationData,
} from '@services/notificationService';

const useNotifications = () => {
  const navigation = useNavigation();

  const handleNotification = useCallback(
    (data: NotificationData) => {
      switch (data.type) {
        case 'STATUS_UPDATE':
        case 'TECHNICIAN_ASSIGNED':
          if (data.issueId) {
            navigation.navigate(
              'IssueDetail' as never,
              {issueId: data.issueId} as never,
            );
          }
          break;
        case 'JOB_COMPLETED':
          if (data.issueId) {
            navigation.navigate(
              'IssueDetail' as never,
              {issueId: data.issueId} as never,
            );
          }
          break;
        case 'BILLING':
          if (data.billId) {
            navigation.navigate(
              'BillDetail' as never,
              {billId: data.billId} as never,
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