/**
 * Security Rules Verification Suite (Dirty Dozen Payloads)
 * Maps each adversarial payload from security_spec.md to its expected PERMISSION_DENIED outcome.
 */

export const dirtyDozenPayloads = [
  { name: 'Unauthenticated Write', path: 'users/user123', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified Email Write', path: 'profiles/user123', emailVerified: false, expected: 'PERMISSION_DENIED' },
  { name: 'Identity Spoofing', path: 'profiles/user123', payload: { uid: 'other_user' }, expected: 'PERMISSION_DENIED' },
  { name: 'PII Blanket Read', path: 'users/user123', readerUid: 'user456', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow Ghost Field', path: 'profiles/user123', payload: { isAdmin: true }, expected: 'PERMISSION_DENIED' },
  { name: 'ID Poisoning', path: `videos/${'a'.repeat(500)}`, expected: 'PERMISSION_DENIED' },
  { name: 'Timestamp Forgery', path: 'users/user123', payload: { createdAt: '2020-01-01' }, expected: 'PERMISSION_DENIED' },
  { name: 'Immutable Field Tampering', path: 'videos/vid1', payload: { authorUid: 'new_uid' }, expected: 'PERMISSION_DENIED' },
  { name: 'Orphaned Transaction', path: 'wallets/no_wallet/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Private Video Scraping', path: 'videos/private_vid_1', readerUid: 'attacker', expected: 'PERMISSION_DENIED' },
  { name: 'Message Spoofing', path: 'messages/m1', payload: { senderId: 'victim_uid' }, expected: 'PERMISSION_DENIED' },
  { name: 'Subscription Escalation', path: 'subscriptions', readerUid: 'attacker', expected: 'PERMISSION_DENIED' },
  { name: 'Moderation Report Tampering', path: 'reports/r1', payload: { status: 'removed' }, expected: 'PERMISSION_DENIED' },
  { name: 'Payment Method Cross-User Access', path: 'users/user123/paymentMethods/pm1', readerUid: 'user456', expected: 'PERMISSION_DENIED' },
  { name: 'Profile ID Hijacking', path: 'profiles/user123', payload: { profileId: 'ORI-999999' }, expected: 'PERMISSION_DENIED' }
];
