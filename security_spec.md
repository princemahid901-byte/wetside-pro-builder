# OrioLiveCall Security Specification

## 1. Data Invariants
1. **PII Isolation**: Private user records (`/users/{userId}`) containing `email`, `birthDate`, and `age` can ONLY be read or written by the authenticated owner (`request.auth.uid == userId`) or a verified admin (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))`).
2. **Public Profile Integrity**: Public profiles (`/profiles/{userId}`) require `uid == request.auth.uid`, validated string lengths, and immutable `uid`/`userId` after creation. Users cannot self-assign `creatorBadge: true` unless verified or unchanged.
3. **Wallet & Transaction Master Gate**: `/wallets/{userId}` and `/wallets/{userId}/transactions/{txId}` are strictly scoped to the wallet owner (`request.auth.uid == userId`). Transactions require a valid parent wallet (`exists(/databases/$(database)/documents/wallets/$(userId))`) and positive numeric `amount`. Terminal transaction statuses (`refunded`) cannot be modified by non-admins.
4. **Private Message Isolation**: Messages in `/messages/{messageId}` can only be read (`get`/`list`) if `resource.data.senderId == request.auth.uid || resource.data.recipientId == request.auth.uid`, and created only if `incoming().senderId == request.auth.uid`.
5. **Verified Email Mandate**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time` on creation/update, and `createdAt` is immutable on update.
7. **ID Poisoning Guard**: All document IDs (`userId`, `txId`, `messageId`, `shortId`, `sessionId`, `videoId`, `likeId`, `subId`, `streamId`, `reportId`) are validated with `isValidId(id)` (`size() <= 128 && matches('^[a-zA-Z0-9_\\-]+$')`).
8. **Private & Premium Video Protection**: Non-public videos (`visibility != 'public'`) in `/videos/{videoId}` cannot be read or listed by non-owners/non-admins in Firestore; private stream bytes are served exclusively via backend-authenticated permission checks.
9. **Database-Backed Likes & Subscriptions**: `/videoLikes/{likeId}` must belong to `request.auth.uid`, and `/subscriptions/{subId}` can only be read/listed by the subscriber (`uid == request.auth.uid`) or target creator (`creatorId == request.auth.uid`).
10. **Premium Livestream Isolation**: Premium livestreams (`accessType == 'premium'`) in `/livestreams/{streamId}` cannot be listed/read publicly in Firestore by unauthorized non-owners.
11. **Moderation Report Confidentiality**: `/reports/{reportId}` can only be read/listed by the reporter (`reporterUid == request.auth.uid`) or an admin, and non-admins can only create `status: 'pending'` reports.
12. **Immutable Profile ID Integrity**: `profileId` (`^ORI-[0-9]{6,12}$`) cannot be altered by non-admins once assigned on `/users/{userId}` or `/profiles/{userId}`.
13. **Masked Payment Method Isolation**: `/users/{userId}/paymentMethods/{methodId}` is strictly isolated to `isOwner(userId)` with parent user existence gate, bounded string fields (`maskedNumber <= 32`), and no raw CVV or unmasked PAN fields allowed.

## 2. Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: Writing `/users/user123` with `request.auth == null`.
2. **Unverified Email Write**: Writing `/profiles/user123` with `email_verified: false`.
3. **Identity Spoofing**: Creating `/profiles/user123` with `uid: "other_user"`.
4. **PII Blanket Read**: Non-owner `user456` reading `/users/user123` (contains email & birthDate).
5. **Shadow Ghost Field**: Creating `/profiles/user123` with extra field `isAdmin: true`.
6. **ID Poisoning**: Writing `/videos/${'a'.repeat(500)}` (>128 chars) or invalid chars `$id`.
7. **Timestamp Forgery**: Creating `/users/user123` with client-forged `createdAt: "2020-01-01"`.
8. **Immutable Field Tampering**: Updating `/videos/vid1` changing `authorUid` or `createdAt`.
9. **Orphaned Transaction**: Creating `/wallets/user123/transactions/tx1` when parent `/wallets/user123` does not exist.
10. **Private Video Scraping**: Non-owner `attacker` reading `/videos/private_vid_1` where `visibility == 'private'`.
11. **Message Spoofing**: Creating `/messages/m1` with `senderId: "victim_uid"` while signed in as `attacker_uid`.
12. **Subscription Escalation**: Non-owner reading `/subscriptions` without filtering to `uid` or `creatorId == request.auth.uid`.
13. **Moderation Report Tampering**: Non-admin creating `/reports/r1` with `status: 'removed'` or updating another user's report.
14. **Payment Method Cross-User Read/Write**: Non-owner `user456` reading or writing `/users/user123/paymentMethods/pm1`.
15. **Profile ID Hijacking**: Non-admin changing `profileId` on update or injecting raw `cvv` field into `/users/user123/paymentMethods/pm1`.
