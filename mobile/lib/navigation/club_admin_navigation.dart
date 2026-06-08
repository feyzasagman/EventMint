import 'package:flutter/material.dart';

import '../screens/club_manage_screen.dart';
import '../screens/event_create_screen.dart';

abstract final class ClubAdminRoutes {
  static const eventCreate = '/events/create';
  static const postCreate = '/club/post/create';
  static const applications = '/club/applications';
  static const members = '/club/members';
}

String clubAdminRouteTitle(String route) {
  switch (route) {
    case ClubAdminRoutes.eventCreate:
      return 'Etkinlik Ekle';
    case ClubAdminRoutes.postCreate:
      return 'Paylaşım Oluştur';
    case ClubAdminRoutes.applications:
      return 'Başvurular';
    case ClubAdminRoutes.members:
      return 'Üyeler';
    default:
      return 'Yönetim';
  }
}

String clubAdminRouteSubtitle(String route) {
  switch (route) {
    case ClubAdminRoutes.eventCreate:
      return 'Yeni etkinlik oluştur';
    case ClubAdminRoutes.postCreate:
      return 'Kulüp duyurusu paylaş';
    case ClubAdminRoutes.applications:
      return 'Üyelik başvurularını incele';
    case ClubAdminRoutes.members:
      return 'Onaylı üyeleri görüntüle';
    default:
      return '';
  }
}

int clubAdminInitialTabIndex(String route) {
  switch (route) {
    case ClubAdminRoutes.applications:
      return 1;
    case ClubAdminRoutes.members:
      return 2;
    default:
      return 0;
  }
}

Future<void> navigateClubAdminRoute(
  BuildContext context, {
  required String route,
  required String clubId,
}) {
  if (route == ClubAdminRoutes.eventCreate) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => EventCreateScreen(clubId: clubId),
      ),
    );
  }

  if (route == ClubAdminRoutes.postCreate ||
      route == ClubAdminRoutes.applications ||
      route == ClubAdminRoutes.members) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => ClubManageScreen(
          clubId: clubId,
          initialTabIndex: clubAdminInitialTabIndex(route),
          scrollToPostSection: route == ClubAdminRoutes.postCreate,
        ),
      ),
    );
  }

  final title = clubAdminRouteTitle(route);
  final subtitle = clubAdminRouteSubtitle(route);
  return Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(child: Text(subtitle)),
      ),
    ),
  );
}
