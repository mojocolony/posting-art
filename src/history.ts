import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type Platform = "instagram" | "facebook";

export type PostingRecord = {
  id: string;
  title: string;
  format: string;
  createdAt: string;
  thumbnailUrl: string;
  instagramAt: string | null;
  facebookAt: string | null;
};

function requireDb() {
  if (!db) throw new Error("Firebase has not been configured yet.");
  return db;
}

export function subscribeToPostingRecords(
  onRecords: (records: PostingRecord[]) => void,
  onError: () => void,
) {
  const recordsQuery = query(
    collection(requireDb(), "postingRecords"),
    orderBy("createdAt", "desc"),
    limit(100),
  );
  return onSnapshot(
    recordsQuery,
    (snapshot) => onRecords(snapshot.docs.map((item) => item.data() as PostingRecord)),
    onError,
  );
}

export async function savePostingRecord(record: PostingRecord) {
  await setDoc(doc(requireDb(), "postingRecords", record.id), record, { merge: true });
  return record;
}

export async function updatePostingStatus(id: string, platform: Platform, postedAt: string | null) {
  const field = platform === "instagram" ? "instagramAt" : "facebookAt";
  await updateDoc(doc(requireDb(), "postingRecords", id), { [field]: postedAt });
}
