import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    // Permission denied on /test/connection still indicates the server responded online
    return true;
  }
}

export async function signInWithGoogleFirebase(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function syncUserToFirestore(
  fbUser: FirebaseUser,
  profileData: {
    userId: string;
    profileId?: string;
    name: string;
    gender: 'girls' | 'boys' | 'other';
    country: string;
    birthDate: string;
    age: number;
    verified: boolean;
    bio?: string;
    avatar?: string;
    preferredLanguage?: 'en' | 'bn';
    videoQuality?: 'SD' | 'HD' | '4K';
    cameraEnabled?: boolean;
    micEnabled?: boolean;
  }
) {
  const uid = fbUser.uid;
  const userPath = `users/${uid}`;

  try {
    const userRef = doc(db, 'users', uid);
    const existingUser = await getDoc(userRef);

    const safeUserId = profileData.userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `ORIO-${uid.slice(0, 10)}`;
    const validProfileId =
      profileData.profileId && /^ORI-[0-9]{6,12}$/.test(profileData.profileId)
        ? profileData.profileId
        : undefined;

    if (!existingUser.exists()) {
      await setDoc(userRef, {
        uid,
        userId: safeUserId,
        ...(validProfileId ? { profileId: validProfileId } : {}),
        email: (fbUser.email || '').slice(0, 254),
        birthDate: (profileData.birthDate || '').slice(0, 20),
        age: Math.min(130, Math.max(0, Number(profileData.age || 21))),
        verified: Boolean(profileData.verified),
        preferredLanguage: profileData.preferredLanguage || 'en',
        videoQuality: profileData.videoQuality || 'HD',
        cameraEnabled: profileData.cameraEnabled ?? true,
        micEnabled: profileData.micEnabled ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingUser.data();
      await updateDoc(userRef, {
        ...(!existingData?.profileId && validProfileId ? { profileId: validProfileId } : {}),
        email: (fbUser.email || '').slice(0, 254),
        birthDate: (profileData.birthDate || '').slice(0, 20),
        age: Math.min(130, Math.max(0, Number(profileData.age || 21))),
        verified: Boolean(profileData.verified),
        preferredLanguage: profileData.preferredLanguage || 'en',
        videoQuality: profileData.videoQuality || 'HD',
        cameraEnabled: profileData.cameraEnabled ?? true,
        micEnabled: profileData.micEnabled ?? true,
        updatedAt: serverTimestamp(),
      });
    }

    const profileRef = doc(db, 'profiles', uid);
    const existingProfile = await getDoc(profileRef);
    const safeName = (profileData.name || fbUser.displayName || 'Orio User').slice(0, 100);

    if (!existingProfile.exists()) {
      await setDoc(profileRef, {
        uid,
        userId: safeUserId,
        ...(validProfileId ? { profileId: validProfileId } : {}),
        name: safeName,
        username: `@${safeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user'}`,
        gender: profileData.gender || 'other',
        country: (profileData.country || 'Bangladesh').slice(0, 80),
        bio: (profileData.bio || 'Exploring the world on OrioLiveCall!').slice(0, 500),
        avatar: (profileData.avatar || fbUser.photoURL || '').slice(0, 500),
        online: true,
        creatorBadge: false,
        subscribersCount: 0,
        monthlyPrice: 14.99,
        yearlyPrice: 119.99,
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingProfData = existingProfile.data();
      await updateDoc(profileRef, {
        ...(!existingProfData?.profileId && validProfileId ? { profileId: validProfileId } : {}),
        name: safeName,
        gender: profileData.gender || 'other',
        country: (profileData.country || 'Bangladesh').slice(0, 80),
        bio: (profileData.bio || 'Exploring the world on OrioLiveCall!').slice(0, 500),
        avatar: (profileData.avatar || fbUser.photoURL || '').slice(0, 500),
        online: true,
        updatedAt: serverTimestamp(),
      });
    }

    const walletRef = doc(db, 'wallets', uid);
    const existingWallet = await getDoc(walletRef);
    if (!existingWallet.exists()) {
      await setDoc(walletRef, {
        uid,
        balance: 250.0,
        currency: 'USD',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function loadUserFromFirestore(uid: string) {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const profileSnap = await getDoc(doc(db, 'profiles', uid));
    const walletSnap = await getDoc(doc(db, 'wallets', uid));
    return {
      user: userSnap.exists() ? userSnap.data() : null,
      profile: profileSnap.exists() ? profileSnap.data() : null,
      wallet: walletSnap.exists() ? walletSnap.data() : null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
}

export async function updateMessagingPrivacyInFirestore(
  fbUser: FirebaseUser,
  messagingPrivacy: 'everyone' | 'friends' | 'followers' | 'subscribers' | 'nobody'
) {
  const path = `users/${fbUser.uid}`;
  try {
    await updateDoc(doc(db, 'users', fbUser.uid), {
      messagingPrivacy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveVideoToFirestore(
  fbUser: FirebaseUser,
  video: {
    id: string;
    creatorName: string;
    title: string;
    description: string;
    category: string;
    visibility: 'public' | 'private' | 'premium';
    thumbnailUrl?: string;
    safeContent: boolean;
    moderationStatus: 'approved' | 'pending' | 'flagged';
  }
) {
  const safeId = video.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `videos/${safeId}`;
  try {
    await setDoc(doc(db, 'videos', safeId), {
      id: safeId,
      authorUid: fbUser.uid,
      creatorName: video.creatorName.slice(0, 100),
      title: video.title.slice(0, 160),
      description: (video.description || '').slice(0, 1000),
      category: video.category.slice(0, 40),
      visibility: video.visibility,
      thumbnailUrl: (video.thumbnailUrl || '').slice(0, 500),
      safeContent: Boolean(video.safeContent),
      moderationStatus: video.moderationStatus,
      views: 0,
      likesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleVideoLikeInFirestore(fbUser: FirebaseUser, videoId: string, liked: boolean) {
  const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const likeId = `${fbUser.uid.slice(0, 40)}_${safeVideoId}`.slice(0, 128);
  const path = `videoLikes/${likeId}`;
  try {
    if (liked) {
      await setDoc(doc(db, 'videoLikes', likeId), {
        id: likeId,
        uid: fbUser.uid,
        videoId: safeVideoId,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'videoLikes', likeId));
    }
  } catch (error) {
    handleFirestoreError(error, liked ? OperationType.CREATE : OperationType.DELETE, path);
  }
}

export async function syncSubscriptionToFirestore(
  fbUser: FirebaseUser,
  sub: {
    creatorId: string;
    creatorName: string;
    plan: 'free_follow' | 'monthly' | 'yearly';
    price: number;
    status: 'active' | 'cancelled';
    autoRenew?: boolean;
    renewalDate?: string;
    expiresAt?: string;
  }
) {
  const safeCreatorId = sub.creatorId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const subId = `${fbUser.uid.slice(0, 40)}_${safeCreatorId}`.slice(0, 128);
  const path = `subscriptions/${subId}`;
  try {
    const ref = doc(db, 'subscriptions', subId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: subId,
        uid: fbUser.uid,
        creatorId: safeCreatorId,
        creatorName: sub.creatorName.slice(0, 100),
        plan: sub.plan,
        price: Number(sub.price),
        status: sub.status,
        autoRenew: Boolean(sub.autoRenew),
        ...(sub.renewalDate ? { renewalDate: sub.renewalDate.slice(0, 40) } : {}),
        expiresAt: (sub.expiresAt || '').slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        plan: sub.plan,
        status: sub.status,
        autoRenew: Boolean(sub.autoRenew),
        ...(sub.renewalDate ? { renewalDate: sub.renewalDate.slice(0, 40) } : {}),
        expiresAt: (sub.expiresAt || '').slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePaymentMethodToFirestore(
  fbUser: FirebaseUser,
  method: {
    id: string;
    methodType: 'bank_transfer' | 'debit_card' | 'credit_card' | 'mobile_banking';
    provider: string;
    label: string;
    maskedNumber: string;
    holderName?: string;
    expiry?: string;
    isDefault: boolean;
  }
) {
  const safeId = method.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `users/${fbUser.uid}/paymentMethods/${safeId}`;
  try {
    await setDoc(doc(db, 'users', fbUser.uid, 'paymentMethods', safeId), {
      id: safeId,
      uid: fbUser.uid,
      methodType: method.methodType,
      provider: method.provider.slice(0, 80),
      label: method.label.slice(0, 100),
      maskedNumber: method.maskedNumber.slice(0, 32),
      ...(method.holderName ? { holderName: method.holderName.slice(0, 100) } : {}),
      ...(method.expiry ? { expiry: method.expiry.slice(0, 16) } : {}),
      isDefault: Boolean(method.isDefault),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePaymentMethodFromFirestore(fbUser: FirebaseUser, methodId: string) {
  const safeId = methodId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `users/${fbUser.uid}/paymentMethods/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', fbUser.uid, 'paymentMethods', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveLiveStreamToFirestore(
  fbUser: FirebaseUser,
  streamItem: {
    id: string;
    creatorName: string;
    title: string;
    category: string;
    accessType: 'free' | 'premium';
    price: number;
    isLive: boolean;
  }
) {
  const safeId = streamItem.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `livestreams/${safeId}`;
  try {
    await setDoc(doc(db, 'livestreams', safeId), {
      id: safeId,
      creatorUid: fbUser.uid,
      creatorName: streamItem.creatorName.slice(0, 100),
      title: streamItem.title.slice(0, 160),
      category: streamItem.category.slice(0, 40),
      accessType: streamItem.accessType,
      price: Number(streamItem.price),
      isLive: Boolean(streamItem.isLive),
      viewerCount: 1,
      likesCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitReportToFirestore(
  fbUser: FirebaseUser,
  report: {
    id: string;
    targetType: 'video' | 'short' | 'livestream' | 'user' | 'message';
    targetId: string;
    reason: string;
  }
) {
  const safeId = report.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `reports/${safeId}`;
  try {
    await setDoc(doc(db, 'reports', safeId), {
      id: safeId,
      reporterUid: fbUser.uid,
      targetType: report.targetType,
      targetId: report.targetId.slice(0, 128),
      reason: report.reason.slice(0, 300),
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveCallRatingToFirestore(
  fbUser: FirebaseUser,
  rating: {
    id: string;
    actionTrigger: 'next_person' | 'end_call';
    callMode: 'random_video' | 'ai_global_talk';
    partnerName: string;
    partnerCountry: string;
    overallRating: number;
    callQualityRating: number;
    durationSec: number;
    videoQuality: string;
    stabilityStatus: string;
    tags: string[];
    comment: string;
  }
) {
  const safeId = rating.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `callRatings/${safeId}`;
  try {
    await setDoc(doc(db, 'callRatings', safeId), {
      id: safeId,
      uid: fbUser.uid,
      actionTrigger: rating.actionTrigger,
      callMode: rating.callMode,
      partnerName: (rating.partnerName || 'Partner').slice(0, 100),
      partnerCountry: (rating.partnerCountry || 'Global').slice(0, 80),
      overallRating: Math.min(5, Math.max(1, Number(rating.overallRating) || 5)),
      callQualityRating: Math.min(5, Math.max(1, Number(rating.callQualityRating) || 5)),
      durationSec: Math.min(86400, Math.max(0, Number(rating.durationSec) || 0)),
      videoQuality: (rating.videoQuality || 'HD').slice(0, 16),
      stabilityStatus: (rating.stabilityStatus || 'excellent').slice(0, 32),
      tags: Array.isArray(rating.tags) ? rating.tags.slice(0, 8).map((t) => String(t).slice(0, 50)) : [],
      comment: (rating.comment || '').slice(0, 400),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncUserPreferencesToFirestore(
  fbUser: FirebaseUser,
  prefs: {
    targetGender: 'girls' | 'boys' | 'any';
    targetCountry: string;
    voluntaryGender?: string;
    preferredQuality: 'SD' | 'HD' | '4K';
  }
) {
  const path = `user_preferences/${fbUser.uid}`;
  try {
    await setDoc(doc(db, 'user_preferences', fbUser.uid), {
      uid: fbUser.uid,
      targetGender: prefs.targetGender,
      targetCountry: (prefs.targetCountry || 'all').slice(0, 80),
      ...(prefs.voluntaryGender ? { voluntaryGender: prefs.voluntaryGender.slice(0, 32) } : {}),
      preferredQuality: prefs.preferredQuality,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncAgeVerificationToFirestore(
  fbUser: FirebaseUser,
  record: {
    status: 'unverified' | 'verified' | 'rejected' | 'suspended';
    method: string;
    age: number;
    idDocType?: string;
    issuingCountry?: string;
  }
) {
  const path = `age_verification/${fbUser.uid}`;
  try {
    await setDoc(doc(db, 'age_verification', fbUser.uid), {
      uid: fbUser.uid,
      status: record.status,
      method: (record.method || 'dob_and_id_assurance').slice(0, 64),
      age: Math.min(130, Math.max(0, Number(record.age) || 18)),
      ...(record.idDocType ? { idDocType: record.idDocType.slice(0, 40) } : {}),
      ...(record.issuingCountry ? { issuingCountry: record.issuingCountry.slice(0, 80) } : {}),
      ...(record.status === 'verified' ? { verifiedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFriendRequestToFirestore(
  fbUser: FirebaseUser,
  reqData: {
    id: string;
    senderUid: string;
    recipientUid: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  }
) {
  const safeId = reqData.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const path = `friend_requests/${safeId}`;
  try {
    const ref = doc(db, 'friend_requests', safeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeId,
        senderUid: fbUser.uid,
        recipientUid: reqData.recipientUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128),
        status: reqData.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        status: reqData.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncBlockedUserToFirestore(
  fbUser: FirebaseUser,
  targetUid: string,
  blocked: boolean,
  reason?: string
) {
  const safeTarget = targetUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'target';
  const blockId = `${fbUser.uid.slice(0, 40)}_${safeTarget}`.slice(0, 128);
  const path = `blocked_users/${blockId}`;
  try {
    if (blocked) {
      await setDoc(doc(db, 'blocked_users', blockId), {
        id: blockId,
        blockerUid: fbUser.uid,
        blockedUid: safeTarget,
        ...(reason ? { reason: reason.slice(0, 300) } : {}),
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'blocked_users', blockId));
    }
  } catch (error) {
    handleFirestoreError(error, blocked ? OperationType.CREATE : OperationType.DELETE, path);
  }
}

export async function syncPrivacySettingsToFirestore(
  fbUser: FirebaseUser,
  privacy: {
    messagingPrivacy: 'everyone' | 'friends' | 'followers' | 'subscribers' | 'nobody';
    allowUnsolicitedRequests: boolean;
    showOnlineStatus: boolean;
    showInGlobalFriends: boolean;
    allowFriendRequests: boolean;
  }
) {
  const path = `user_privacy_settings/${fbUser.uid}`;
  try {
    await setDoc(doc(db, 'user_privacy_settings', fbUser.uid), {
      uid: fbUser.uid,
      messagingPrivacy: privacy.messagingPrivacy,
      allowUnsolicitedRequests: Boolean(privacy.allowUnsolicitedRequests),
      showOnlineStatus: Boolean(privacy.showOnlineStatus),
      showInGlobalFriends: Boolean(privacy.showInGlobalFriends),
      allowFriendRequests: Boolean(privacy.allowFriendRequests),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export { onAuthStateChanged, collection, query, where, getDocs, Timestamp };
export type { FirebaseUser };
