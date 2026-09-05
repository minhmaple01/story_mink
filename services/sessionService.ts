import { ChunkState } from '../App';
import { Doc3DSubStyle, Doc3DRenderTheme, ReferenceImageItem, StoryboardSegment, SegmentMode } from './geminiService';

export interface SavedSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fileName: string;
  totalChunks: number;
  completedChunks: number;
  totalPrompts: number;
  referenceImagesCount: number;
  settings: {
    segmentMode: SegmentMode;
    segmentDuration: number;
    subStyle: Doc3DSubStyle;
    renderTheme: Doc3DRenderTheme;
    allowTextInImage: boolean;
    includeMotion: boolean;
    includeCharactersPresent: boolean;
    includeCharactersAbsent: boolean;
    castList: string;
    allowLongerPacingFromPart3?: boolean;
    boostShortScenesPart1?: boolean;
  };
  referenceImages: ReferenceImageItem[];
  fileChunks: ChunkState[];
  rawFileContent: string | null;
}

const STORAGE_KEY = 'doc3d_storyboard_sessions_v1';

export const getSavedSessions = (): SavedSession[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return [];
  } catch (error) {
    console.error("Failed to load sessions from localStorage:", error);
    return [];
  }
};

export const saveSessionToStorage = (sessionData: {
  id?: string;
  name?: string;
  fileName: string;
  fileChunks: ChunkState[];
  referenceImages: ReferenceImageItem[];
  rawFileContent: string | null;
  settings: SavedSession['settings'];
}): SavedSession => {
  const sessions = getSavedSessions();
  const now = Date.now();

  const totalPrompts = sessionData.fileChunks.reduce((acc, chunk) => acc + (chunk.results?.length || 0), 0);
  const completedChunks = sessionData.fileChunks.filter(c => c.status === 'success').length;

  const sessionId = sessionData.id || `session_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionName = sessionData.name || (sessionData.fileName 
    ? sessionData.fileName.replace(/\.[^/.]+$/, "") 
    : `Phiên ${new Date(now).toLocaleString('vi-VN')}`);

  const existingIndex = sessions.findIndex(s => s.id === sessionId);

  const newSession: SavedSession = {
    id: sessionId,
    name: sessionName,
    createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : now,
    updatedAt: now,
    fileName: sessionData.fileName || 'Kịch bản chưa đặt tên',
    totalChunks: sessionData.fileChunks.length,
    completedChunks,
    totalPrompts,
    referenceImagesCount: sessionData.referenceImages.length,
    settings: sessionData.settings,
    referenceImages: sessionData.referenceImages,
    fileChunks: sessionData.fileChunks,
    rawFileContent: sessionData.rawFileContent
  };

  if (existingIndex >= 0) {
    sessions[existingIndex] = newSession;
  } else {
    sessions.unshift(newSession);
  }

  // Limit to 30 most recent sessions to avoid localStorage quota issues
  const trimmed = sessions.slice(0, 30);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Storage full, trimming oldest sessions:", err);
    // Trim to 10 and retry
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(0, 10)));
  }

  return newSession;
};

export const deleteSavedSession = (sessionId: string): SavedSession[] => {
  const sessions = getSavedSessions().filter(s => s.id !== sessionId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to delete session from localStorage:", err);
  }
  return sessions;
};

export const clearAllSavedSessions = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear sessions:", err);
  }
};
