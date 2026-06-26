# Flutter integration for user-submitted accommodation edits

This backend now supports a user-driven workflow where any logged-in user can propose edits to an accommodation from the accommodation details screen. The admin later reviews and approves or rejects those edits.

## What the backend accepts

All requests go through `POST /accommodations/handle`.

### Submit an edit request

```json
{
  "action": "requestedit",
  "payload": {
    "placeId": 123,
    "accountId": 45,
    "payload": {
      "place_name": "New name",
      "address": "Updated address",
      "services": ["WiFi", "Laundry"],
      "nearbyActivities": ["River walk"],
      "gallery_photos": ["https://..."],
      "main_photo": "https://..."
    }
  }
}
```

### List the current user's edit requests

```json
{
  "action": "getmyeditrequests",
  "payload": {
    "accountId": 45
  }
}
```

### List pending edit requests for admin review

```json
{
  "action": "getpendingedits"
}
```

### Approve or reject an edit request

```json
{
  "action": "approveedit",
  "payload": {
    "id": 10
  }
}
```

```json
{
  "action": "rejectedit",
  "payload": {
    "id": 10,
    "rejectionReason": "Incorrect service information"
  }
}
```

## Important behavior

- Only logged-in users should see the edit action on the accommodation details page.
- The backend accepts user proposals for fields such as `place_name`, `address`, `phone`, `website`, `main_photo`, `place_category`, `services`, and `nearbyActivities`.
- If the proposal includes `gallery_photos`, those URLs are moderated before being stored as pending photos.
- The edit request itself remains pending until an admin approves it.
- When an admin approves the request, the backend applies the allowed fields to the accommodation.

## Flutter integration on the accommodation details page

### 1. Add a visible edit action

On the accommodation details screen, show a button like:

- `Suggest edit`
- `Report missing service`
- `Add service`

Keep it visible only for authenticated users.

### 2. Open an edit form

The form can reuse the same details screen layout and only expose the fields you want users to suggest:

- name
- address
- phone
- website
- services
- nearby activities
- main photo
- gallery photos

For your use case, the most important part is the `services` list. A user can say:

- `WiFi`
- `Laundry`
- `Breakfast`
- `Bike storage`

### 3. Submit the request

Use your auth token and current account id.

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> submitAccommodationEdit({
  required String apiBaseUrl,
  required String authToken,
  required int placeId,
  required int accountId,
  required Map<String, dynamic> proposedChanges,
}) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/accommodations/handle'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $authToken',
    },
    body: jsonEncode({
      'action': 'requestedit',
      'payload': {
        'placeId': placeId,
        'accountId': accountId,
        'payload': proposedChanges,
      },
    }),
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception('Failed to submit edit request: ${response.body}');
  }
}
```

### 4. Suggested payload structure

If the user edits only services, send:

```dart
{
  'services': ['WiFi', 'Laundry', 'Breakfast']
}
```

If the user also wants to correct the name and address:

```dart
{
  'place_name': 'Refuge Example',
  'address': 'Rua X, 123',
  'services': ['WiFi', 'Laundry']
}
```

The backend will only apply allowed fields when the admin approves.

### 5. Show request status to the user

Call `getmyeditrequests` and render a small status area on the accommodation page or in a separate "My contributions" screen.

Status values:

- `pending`
- `approved`
- `rejected`

### 6. Admin screen

For the admin side, create a simple list of pending edits:

```dart
Future<List<dynamic>> loadPendingEdits({
  required String apiBaseUrl,
  required String authToken,
}) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/accommodations/handle'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $authToken',
    },
    body: jsonEncode({'action': 'getpendingedits'}),
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception('Failed to load pending edits: ${response.body}');
  }

  return jsonDecode(response.body) as List<dynamic>;
}
```

Then show:

- accommodation name
- user name/email
- proposed changes
- approve button
- reject button

### 7. Approve or reject

```dart
Future<void> approveEdit({
  required String apiBaseUrl,
  required String authToken,
  required int requestId,
}) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/accommodations/handle'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $authToken',
    },
    body: jsonEncode({
      'action': 'approveedit',
      'payload': {'id': requestId},
    }),
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception('Failed to approve edit: ${response.body}');
  }
}
```

```dart
Future<void> rejectEdit({
  required String apiBaseUrl,
  required String authToken,
  required int requestId,
  required String reason,
}) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/accommodations/handle'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $authToken',
    },
    body: jsonEncode({
      'action': 'rejectedit',
      'payload': {
        'id': requestId,
        'rejectionReason': reason,
      },
    }),
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception('Failed to reject edit: ${response.body}');
  }
}
```

## Recommended UI flow

1. User opens accommodation details.
2. If logged in, show `Suggest edit`.
3. User proposes service additions or corrections.
4. App sends request to backend and shows `pending` state.
5. Admin reviews requests in a moderation screen.
6. Admin approves or rejects.
7. Once approved, the accommodation details page shows the updated data.

## Practical recommendation for your app

Because this is a community-fed application, keep the edit form lightweight. The best first version is:

- a multiline text field for suggested services
- a checkbox list of common services
- optional note field for the user
- submit button

You can expand it later to address, contact data, photos, and category corrections.
