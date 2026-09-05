import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  generateStoryboardChunk, 
  parseStoryboardOutput, 
  StoryboardSegment, 
  splitSRTByTime, 
  SRTChunk,
  timestampToSeconds,
  Doc3DSubStyle,
  Doc3DRenderTheme,
  analyzeCastFromSubtitles,
  getPromptCountForDuration,
  ReferenceImageItem,
  analyzeReferenceImagesFromSubtitles,
  SegmentMode
} from './services/geminiService';
import { 
  SavedSession, 
  getSavedSessions, 
  saveSessionToStorage, 
  deleteSavedSession 
} from './services/sessionService';
import { parseExcelStoryboard } from './services/excelService';
import Dropzone from './components/Dropzone';
import ResultCard from './components/ResultCard';
import ReferenceImagesManager from './components/ReferenceImagesManager';
import SessionHistoryModal from './components/SessionHistoryModal';
import { StyleModal } from './components/StyleModal';
import { 
  VisualStyle, 
  getStoredStyles, 
  addCustomStyle, 
  deleteCustomStyle, 
  updateCustomStyle 
} from './services/styleRegistry';
import { 
  Sparkles, 
  Loader2, 
  Box, 
  Trash2, 
  FileText, 
  FileSpreadsheet, 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  Play, 
  RotateCcw, 
  Users, 
  Timer, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  Map, 
  Activity, 
  Maximize2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  History,
  Save,
  Upload,
  LayoutList,
  LayoutGrid,
  Search,
  Plus,
  Edit3,
  Palette
} from 'lucide-react';

export interface ChunkState extends SRTChunk {
  status: 'idle' | 'loading' | 'success' | 'error';
  results: StoryboardSegment[];
  errorMessage?: string;
}

const renderThemeOptions: { id: Doc3DRenderTheme; label: string; desc: string; previewClass: string }[] = [
  {
    id: 'auto_dynamic',
    label: 'Tự động linh hoạt (Khuyên dùng)',
    desc: 'Tự động chọn Trắng nhám, Vật liệu thực tế hoặc Không gian tối HUD theo từng phân cảnh',
    previewClass: 'bg-cyan-50 border-cyan-300 text-cyan-800'
  },
  {
    id: 'clay_white',
    label: 'Trắng nhám (Matte Clay)',
    desc: 'Chuẩn Studio sạch sẽ, đổ bóng mềm, điểm nhấn màu sắc chọn lọc',
    previewClass: 'bg-slate-100 border-slate-300 text-slate-800'
  },
  {
    id: 'realistic_materials',
    label: 'Vật liệu thực tế',
    desc: 'Mô hình kính trong suốt, bê tông, mặt nước & cây xanh tươi tắn',
    previewClass: 'bg-emerald-50 border-emerald-300 text-emerald-800'
  },
  {
    id: 'dark_cyber_hud',
    label: 'Không gian tối & HUD',
    desc: 'Nền tối xám than, khối mô hình với đường nét & tọa độ neon phát quang',
    previewClass: 'bg-slate-800 border-slate-700 text-cyan-300'
  }
];

const App: React.FC = () => {
  const [fileChunks, setFileChunks] = useState<ChunkState[]>([]);
  const fileChunksRef = useRef<ChunkState[]>([]);
  
  useEffect(() => {
    fileChunksRef.current = fileChunks;
  }, [fileChunks]);

  const [fileName, setFileName] = useState<string>('');
  const [castList, setCastList] = useState<string>('');
  const [segmentMode, setSegmentMode] = useState<SegmentMode>('dynamic_grid_4_9');
  const [segmentDuration, setSegmentDuration] = useState<number>(10);
  const [allowLongerPacingFromPart3, setAllowLongerPacingFromPart3] = useState<boolean>(false);
  const [boostShortScenesPart1, setBoostShortScenesPart1] = useState<boolean>(true);
  
  // 3D Specific Settings
  const [availableStyles, setAvailableStyles] = useState<VisualStyle[]>(() => getStoredStyles());
  const [subStyle, setSubStyle] = useState<Doc3DSubStyle>('mink_psychology');
  const [isStyleModalOpen, setIsStyleModalOpen] = useState<boolean>(false);
  const [editingStyle, setEditingStyle] = useState<VisualStyle | null>(null);
  const [renderTheme, setRenderTheme] = useState<Doc3DRenderTheme>('auto_dynamic');
  const [allowTextInImage, setAllowTextInImage] = useState<boolean>(true);
  const [includeMotion, setIncludeMotion] = useState<boolean>(true);
  const [includeCharactersPresent, setIncludeCharactersPresent] = useState<boolean>(false);
  const [includeCharactersAbsent, setIncludeCharactersAbsent] = useState<boolean>(false);

  const handleSaveStyle = (styleData: { label: string; desc: string; systemPromptGuidelines: string }) => {
    if (editingStyle) {
      const updated = updateCustomStyle(editingStyle.id, styleData);
      setAvailableStyles(updated);
      setEditingStyle(null);
    } else {
      const created = addCustomStyle(styleData);
      const updated = getStoredStyles();
      setAvailableStyles(updated);
      setSubStyle(created.id);
    }
  };

  const handleDeleteStyle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Bạn có chắc muốn xóa phong cách tùy chỉnh này?")) {
      const updated = deleteCustomStyle(id);
      setAvailableStyles(updated);
      if (subStyle === id) {
        setSubStyle('');
      }
    }
  };

  const handleEditStyle = (e: React.MouseEvent, style: VisualStyle) => {
    e.stopPropagation();
    setEditingStyle(style);
    setIsStyleModalOpen(true);
  };

  // Dropdown / Collapsible Expand States
  const [isStyleExpanded, setIsStyleExpanded] = useState<boolean>(false);
  const [isThemeExpanded, setIsThemeExpanded] = useState<boolean>(false);
  const [isModeExpanded, setIsModeExpanded] = useState<boolean>(false);
  
  const [rawFileContent, setRawFileContent] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isAnalyzingCast, setIsAnalyzingCast] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [excludeAbsent, setExcludeAbsent] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // Reference Images State (Bối cảnh & Ảnh tham chiếu chuẩn tỉ lệ)
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>([]);
  const [isAnalyzingRefImages, setIsAnalyzingRefImages] = useState<boolean>(false);

  // Session History State
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => getSavedSessions());
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Result Display Options (Compact vs Detailed, Search, Collapse)
  const [resultViewMode, setResultViewMode] = useState<'compact' | 'detailed'>('compact');
  const [collapsedMinutes, setCollapsedMinutes] = useState<Set<string>>(new Set());
  const [resultSearchQuery, setResultSearchQuery] = useState<string>('');

  const toggleMinuteCollapse = (minute: string) => {
    setCollapsedMinutes(prev => {
      const next = new Set(prev);
      if (next.has(minute)) {
        next.delete(minute);
      } else {
        next.add(minute);
      }
      return next;
    });
  };

  const handleCollapseAllMinutes = (allMinuteKeys: string[]) => {
    setCollapsedMinutes(new Set(allMinuteKeys));
  };

  const handleExpandAllMinutes = () => {
    setCollapsedMinutes(new Set());
  };

  // Flash notification helper
  const showNotice = (msg: string) => {
    setSaveSuccessNotice(msg);
    setTimeout(() => {
      setSaveSuccessNotice(null);
    }, 4000);
  };

  // Helper to persist current session state
  const handleSaveCurrentSession = (customName?: string) => {
    if (fileChunks.length === 0 && referenceImages.length === 0) {
      alert("Chưa có dữ liệu nào để lưu phiên.");
      return;
    }

    const saved = saveSessionToStorage({
      id: activeSessionId || undefined,
      name: customName,
      fileName: fileName || 'Kịch bản 3D',
      fileChunks,
      referenceImages,
      rawFileContent,
      settings: {
        segmentMode,
        segmentDuration,
        subStyle,
        renderTheme,
        allowTextInImage,
        includeMotion,
        includeCharactersPresent,
        includeCharactersAbsent,
        castList,
        allowLongerPacingFromPart3,
        boostShortScenesPart1
      }
    });

    setActiveSessionId(saved.id);
    setSavedSessions(getSavedSessions());
    showNotice(`Đã lưu phiên: "${saved.name}" (${saved.totalPrompts} prompt, ${saved.referenceImagesCount} ảnh tham chiếu)`);
  };

  // Restore saved session
  const handleRestoreSession = (session: SavedSession) => {
    setActiveSessionId(session.id);
    setFileName(session.fileName || '');
    setRawFileContent(session.rawFileContent || null);
    setFileChunks(session.fileChunks || []);
    setReferenceImages(session.referenceImages || []);
    
    if (session.settings) {
      setSegmentMode(session.settings.segmentMode || 'dynamic_grid_468');
      setSegmentDuration(session.settings.segmentDuration || 10);
      const restoredStyle = session.settings.subStyle || '';
      setSubStyle(restoredStyle);
      setIsStyleExpanded(!restoredStyle);
      setRenderTheme(session.settings.renderTheme || 'auto_dynamic');
      setAllowTextInImage(session.settings.allowTextInImage !== undefined ? session.settings.allowTextInImage : true);
      setIncludeMotion(session.settings.includeMotion !== undefined ? session.settings.includeMotion : true);
      setIncludeCharactersPresent(session.settings.includeCharactersPresent || false);
      setIncludeCharactersAbsent(session.settings.includeCharactersAbsent || false);
      setCastList(session.settings.castList || '');
      setAllowLongerPacingFromPart3(session.settings.allowLongerPacingFromPart3 ?? false);
      setBoostShortScenesPart1(session.settings.boostShortScenesPart1 ?? true);
    }

    showNotice(`Đã khôi phục phiên: "${session.name}"`);
    setTimeout(() => {
      if (session.fileChunks.some(c => c.results && c.results.length > 0)) {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 200);
  };

  // Load and Resume from Excel File (.xlsx)
  const handleLoadExcelFile = async (file: File) => {
    try {
      const result = await parseExcelStoryboard(file);
      setFileName(result.fileName);
      setFileChunks(result.reconstructedChunks);
      setReferenceImages(result.referenceImages);
      setRawFileContent(result.synthesizedSrt);

      // Auto-save this imported session
      const saved = saveSessionToStorage({
        fileName: result.fileName,
        fileChunks: result.reconstructedChunks,
        referenceImages: result.referenceImages,
        rawFileContent: result.synthesizedSrt,
        settings: {
          segmentMode,
          segmentDuration,
          subStyle,
          renderTheme,
          allowTextInImage,
          includeMotion,
          includeCharactersPresent,
          includeCharactersAbsent,
          castList,
          allowLongerPacingFromPart3,
          boostShortScenesPart1
        }
      });
      setActiveSessionId(saved.id);
      setSavedSessions(getSavedSessions());

      showNotice(`Đã nạp thành công ${result.segments.length} phân cảnh và ${result.referenceImages.length} ảnh tham chiếu từ "${file.name}"!`);
      
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (error: any) {
      console.error("Lỗi nạp tệp Excel:", error);
      alert("Không thể nạp tệp Excel: " + (error.message || "Tệp không đúng định dạng."));
    }
  };

  const handleExcelInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLoadExcelFile(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

  // Flatten all results from all chunks
  const allSegments = useMemo(() => {
    return fileChunks.flatMap(chunk => chunk.results);
  }, [fileChunks]);

  // Calculate Total Estimated Prompts based on chunk segments
  const estimatedTotalPrompts = useMemo(() => {
    if (fileChunks.length === 0) return 0;
    
    let total = 0;
    for (const chunk of fileChunks) {
      if (segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') {
        const endTimeToUse = chunk.realEndTime || chunk.gridEnd;
        const totalSec = Math.max(1, timestampToSeconds(endTimeToUse) - timestampToSeconds(chunk.gridStart));
        let avgSec = 6;
        if (allowLongerPacingFromPart3) {
          if (chunk.id === 0 && boostShortScenesPart1) {
            avgSec = 4.5;
          } else if (chunk.id === 1) {
            avgSec = 6.0;
          } else if (chunk.id >= 2) {
            avgSec = 11.0;
          }
        }
        total += Math.max(1, Math.round(totalSec / avgSec));
      } else if (segmentMode === 'line') {
        total += chunk.content.split(/\n\n+/).filter(b => b.trim().length > 0).length;
      } else if (segmentMode === 'multi_prompt_line') {
        const blocks = chunk.content.split(/\n\n+/).filter(b => b.trim().length > 0);
        for (const block of blocks) {
          const lines = block.split('\n');
          const timeLine = lines.find(l => l.includes('-->'));
          if (timeLine) {
            const parts = timeLine.split('-->');
            if (parts.length === 2) {
              const s = timestampToSeconds(parts[0].trim());
              const e = timestampToSeconds(parts[1].trim());
              const dur = Math.max(1, e - s);
              total += getPromptCountForDuration(dur);
            } else {
              total += 1;
            }
          } else {
            total += 1;
          }
        }
      } else {
        const endTimeToUse = chunk.realEndTime || chunk.gridEnd;
        const expectedSegments = Math.max(1, Math.ceil((timestampToSeconds(endTimeToUse) - timestampToSeconds(chunk.gridStart)) / segmentDuration));
        total += expectedSegments;
      }
    }
    
    return total;
  }, [fileChunks, segmentDuration, segmentMode, allowLongerPacingFromPart3, boostShortScenesPart1]);

  // Group segments by minute for organized display (supports search query)
  const groupedSegments = useMemo(() => {
    const groups: Record<string, StoryboardSegment[]> = {};
    const query = resultSearchQuery.toLowerCase().trim();
    const sorted = [...allSegments].sort((a, b) => a.timeRange.localeCompare(b.timeRange));

    sorted.forEach(seg => {
      if (query) {
        const matchAction = seg.jsonContent?.story_action?.toLowerCase().includes(query);
        const matchVoice = seg.jsonContent?.voiceover_context?.toLowerCase().includes(query);
        const matchBg = seg.jsonContent?.background?.toLowerCase().includes(query);
        const matchRef = (seg.jsonContent?.reference_image || seg.jsonContent?.reference || '')?.toLowerCase().includes(query);
        const matchMotion = seg.jsonContent?.motion?.toLowerCase().includes(query);
        const matchTime = seg.timeRange.toLowerCase().includes(query);
        const matchElements = seg.jsonContent?.elements?.toLowerCase().includes(query);
        
        if (!matchAction && !matchVoice && !matchBg && !matchRef && !matchMotion && !matchTime && !matchElements) {
          return;
        }
      }

      const startStr = seg.timeRange.split(/[-–]/)[0].trim();
      const minute = startStr.split(':')[0] || '00';
      if (minute) {
        if (!groups[minute]) groups[minute] = [];
        groups[minute].push(seg);
      }
    });
    return groups;
  }, [allSegments, resultSearchQuery]);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const processContent = (
    content: string, 
    name: string, 
    duration: number,
    mode: SegmentMode = segmentMode
  ) => {
    setFileName(name);
    setRawFileContent(content);
    
    const rawChunks = splitSRTByTime(content, duration, mode);
    
    setFileChunks(rawChunks.map(c => ({
      ...c,
      status: 'idle',
      results: []
    })));
  };

  const handleFileLoaded = (content: string, name: string) => {
    processContent(content, name, segmentDuration, segmentMode);
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    const newDuration = isNaN(val) || val < 1 ? 10 : val;
    setSegmentDuration(newDuration);
    
    if (rawFileContent && fileName) {
      processContent(rawFileContent, fileName, newDuration, segmentMode);
    }
  };

  const handleModeChange = (mode: SegmentMode) => {
    setSegmentMode(mode);
    if (mode === 'multi_prompt_line' || mode === 'dynamic_grid_468') {
      setIncludeMotion(true);
    }
    if (rawFileContent && fileName) {
      processContent(rawFileContent, fileName, segmentDuration, mode);
    }
  };

  const handleGenerateChunk = async (chunkId: number): Promise<boolean> => {
    if (!subStyle) {
      alert("Vui lòng chọn một phong cách hình ảnh Storyboard trước khi tạo!");
      setIsStyleExpanded(true);
      return false;
    }

    setFileChunks(prev => prev.map(c => 
      c.id === chunkId ? { ...c, status: 'loading' } : c
    ));

    const currentChunks = fileChunksRef.current;
    const chunk = currentChunks.find(c => c.id === chunkId);
    if (!chunk) return false;

    let previousContext = null;
    if (chunkId > 0) {
      const prevChunk = currentChunks.find(c => c.id === chunkId - 1);
      if (prevChunk && prevChunk.status === 'success' && prevChunk.results.length > 0) {
        const lastSegment = prevChunk.results[prevChunk.results.length - 1];
        if (lastSegment && lastSegment.jsonContent) {
          const parts = lastSegment.timeRange.replace(/[\[\]]/g, '').split(/[-–]/);
          const lastEnd = parts.length > 1 ? parts[1].trim() : undefined;
          previousContext = {
            lastBackground: lastSegment.jsonContent.background || "",
            lastOutfitContext: "",
            lastEndTime: lastEnd || prevChunk.endTime,
            lastVoiceover: lastSegment.jsonContent.voiceover_context || ""
          };
        }
      }
    }

    try {
      const timeLabel = `${chunk.gridStart} - ${chunk.gridEnd}`;
      const selectedStyleObj = availableStyles.find(s => s.id === subStyle);
      const customStylePrompt = selectedStyleObj?.systemPromptGuidelines;
      
      const outputText = await generateStoryboardChunk(
        chunk.content, 
        timeLabel, 
        castList,
        segmentDuration,
        null,
        previousContext,
        chunk.realEndTime,
        subStyle,
        renderTheme,
        chunk.id === 0,
        segmentMode,
        includeCharactersPresent,
        includeCharactersAbsent,
        includeMotion,
        allowTextInImage,
        referenceImages,
        customStylePrompt,
        chunk.id,
        allowLongerPacingFromPart3,
        boostShortScenesPart1
      );
      const parsed = parseStoryboardOutput(outputText);

      const endTimeToUse = chunk.realEndTime || chunk.gridEnd;
      let expectedSegments = 1;
      if (segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') {
        const totalChunkSec = Math.max(1, timestampToSeconds(endTimeToUse) - timestampToSeconds(chunk.gridStart));
        // In flexible 4-9s mode (or 8-14s from Part 3 onwards, or boost short scenes in Part 1), minimum acceptable segment count is based on max step
        const maxStepSec = (allowLongerPacingFromPart3 && chunk.id >= 2) 
          ? 14.5 
          : (allowLongerPacingFromPart3 && chunk.id === 0 && boostShortScenesPart1) 
            ? 6.5 
            : 9.5;
        expectedSegments = Math.max(1, Math.floor(totalChunkSec / maxStepSec));
      } else if (segmentMode === 'line') {
        expectedSegments = chunk.content.split(/\n\n+/).filter(b => b.trim().length > 0).length;
      } else if (segmentMode === 'multi_prompt_line') {
        const blocks = chunk.content.split(/\n\n+/).filter(b => b.trim().length > 0);
        expectedSegments = 0;
        for (const block of blocks) {
          const lines = block.split('\n');
          const timeLine = lines.find(l => l.includes('-->'));
          if (timeLine) {
            const parts = timeLine.split('-->');
            if (parts.length === 2) {
              const s = timestampToSeconds(parts[0].trim());
              const e = timestampToSeconds(parts[1].trim());
              expectedSegments += getPromptCountForDuration(Math.max(1, e - s));
            } else {
              expectedSegments += 1;
            }
          } else {
            expectedSegments += 1;
          }
        }
      } else {
        expectedSegments = Math.max(1, Math.ceil((timestampToSeconds(endTimeToUse) - timestampToSeconds(chunk.gridStart)) / segmentDuration));
      }

      if (parsed.length === 0) {
        throw new Error("Không thể phân tích dữ liệu 3D được trả về từ AI.");
      }

      if (parsed.length < expectedSegments) {
        throw new Error(`Thiếu prompt: Cần ${expectedSegments} cảnh nhưng chỉ tạo được ${parsed.length}.`);
      }

      setFileChunks(prev => prev.map(c => 
        c.id === chunkId ? { ...c, status: 'success', results: parsed, errorMessage: undefined } : c
      ));

      // Auto-save after successful chunk generation
      setTimeout(() => {
        const updatedChunks = fileChunksRef.current.map(c => 
          c.id === chunkId ? { ...c, status: 'success' as const, results: parsed, errorMessage: undefined } : c
        );
        const saved = saveSessionToStorage({
          id: activeSessionId || undefined,
          fileName: fileName || 'Kịch bản 3D',
          fileChunks: updatedChunks,
          referenceImages,
          rawFileContent,
          settings: {
            segmentMode,
            segmentDuration,
            subStyle,
            renderTheme,
            allowTextInImage,
            includeMotion,
            includeCharactersPresent,
            includeCharactersAbsent,
            castList,
            allowLongerPacingFromPart3,
            boostShortScenesPart1
          }
        });
        setActiveSessionId(saved.id);
        setSavedSessions(getSavedSessions());
      }, 100);

      return true;

    } catch (error: any) {
      console.error(error);
      setFileChunks(prev => prev.map(c => 
        c.id === chunkId ? { ...c, status: 'error', errorMessage: error.message || "Lỗi xử lý 3D" } : c
      ));
      return false;
    }
  };

  const handleGenerateAll = async () => {
    const pendingChunks = fileChunks.filter(c => c.status === 'idle' || c.status === 'error');
    if (pendingChunks.length === 0) return;

    setIsBulkProcessing(true);

    for (const chunk of pendingChunks) {
      const success = await handleGenerateChunk(chunk.id);
      if (!success) {
        alert(`Quá trình tạo dừng lại vì Phần ${chunk.id + 1} gặp sự cố.`);
        break;
      }
    }

    setIsBulkProcessing(false);
  };

  const handleClear = () => {
    setFileChunks([]);
    setFileName('');
    setRawFileContent(null);
    setCastList('');
    setReferenceImages([]);
    setActiveSessionId(null);
    setSubStyle('');
    setIsStyleExpanded(true);
  };

  const handleAnalyzeReferenceImages = async () => {
    if (!rawFileContent) return;
    
    setIsAnalyzingRefImages(true);
    try {
      const items = await analyzeReferenceImagesFromSubtitles(rawFileContent);
      setReferenceImages(items);

      // Auto-save updated reference images
      if (fileChunks.length > 0) {
        const saved = saveSessionToStorage({
          id: activeSessionId || undefined,
          fileName: fileName || 'Kịch bản 3D',
          fileChunks,
          referenceImages: items,
          rawFileContent,
          settings: {
            segmentMode,
            segmentDuration,
            subStyle,
            renderTheme,
            allowTextInImage,
            includeMotion,
            includeCharactersPresent,
            includeCharactersAbsent,
            castList,
            allowLongerPacingFromPart3,
            boostShortScenesPart1
          }
        });
        setActiveSessionId(saved.id);
        setSavedSessions(getSavedSessions());
      }
    } catch (error: any) {
      alert("Lỗi khi phân tích bối cảnh & tạo prompt ảnh tham chiếu: " + error.message);
    } finally {
      setIsAnalyzingRefImages(false);
    }
  };

  const handleAnalyzeCast = async () => {
    if (!rawFileContent) return;
    
    setIsAnalyzingCast(true);
    try {
      const result = await analyzeCastFromSubtitles(rawFileContent);
      setCastList(result);
    } catch (error: any) {
      alert("Lỗi khi phân tích thực thể 3D: " + error.message);
    } finally {
      setIsAnalyzingCast(false);
    }
  };

  const handleExportExcel = (includeVoiceover: boolean) => {
    if (allSegments.length === 0) return;

    // Auto-save session on export
    handleSaveCurrentSession();

    const wb = XLSX.utils.book_new();
    const sortedSegments = [...allSegments].sort((a, b) => a.timeRange.localeCompare(b.timeRange));

    let currentVoiceover = "";
    let currentPartCounter = 0;

    const data = sortedSegments.map((s, index) => {
      const exportContent = { ...s.jsonContent };
      const voContext = exportContent.voiceover_context || "";
      const refImgTag = exportContent.reference_image || exportContent.reference || "";
      
      let partNumber = exportContent.part;
      if (typeof partNumber !== 'number' || isNaN(partNumber)) {
        if (voContext && voContext === currentVoiceover) {
          currentPartCounter += 1;
          partNumber = currentPartCounter;
        } else {
          currentVoiceover = voContext;
          currentPartCounter = 1;
          partNumber = 1;
        }
      } else {
        currentVoiceover = voContext;
        currentPartCounter = partNumber;
      }

      const motionText = exportContent.motion || s.jsonContent?.motion || "";
      delete exportContent.voiceover_context;
      delete exportContent.motion;
      delete exportContent.part;
      delete exportContent.duration_tag;
      delete exportContent.duration;

      if (excludeAbsent) {
        delete exportContent.characters_absent;
      }

      const stt = index + 1;
      const row: Record<string, any> = {
        "STT": stt,
        "Thời gian": s.timeRange,
        "Part": partNumber,
      };

      if (refImgTag) {
        row["Ảnh tham chiếu (@name)"] = refImgTag.startsWith('@') ? refImgTag : `@${refImgTag}`;
      }

      if (includeVoiceover) {
        row["Lời thoại (Voiceover)"] = voContext;
      }

      row["Chuyển động 3D (Motion)"] = motionText;
      row["Nội dung Prompt 3D"] = JSON.stringify(exportContent);

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    const wscols = [
      { wch: 6 },   // STT
      { wch: 16 },  // Thời gian
      { wch: 8 },   // Part
    ];
    if (referenceImages.length > 0) {
      wscols.push({ wch: 22 }); // Ảnh tham chiếu
    }
    if (includeVoiceover) {
      wscols.push({ wch: 45 }); // Lời thoại
    }
    wscols.push({ wch: 55 }); // Chuyển động 3D
    wscols.push({ wch: 110 }); // Prompt 3D
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Tu_Lieu_3D_Storyboard");

    // Add Reference Images sheet if available
    if (referenceImages.length > 0) {
      const refData = referenceImages.map((item, idx) => ({
        "STT": idx + 1,
        "Tên định danh (@name)": `@${item.name}`,
        "Chủ thể chính": item.subject,
        "Bối cảnh 1 (Vị trí)": item.context1,
        "Bối cảnh 2 (Không gian mở rộng)": item.context2,
        "Loại ảnh": item.imageType,
        "Chi tiết cấu trúc": item.structureDetails,
        "Góc máy": item.perspective,
        "Ánh sáng": item.lighting,
        "Prompt Ảnh Tham Chiếu Chuẩn": item.fullPrompt
      }));
      const wsRef = XLSX.utils.json_to_sheet(refData);
      wsRef['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 30 },
        { wch: 25 },
        { wch: 35 },
        { wch: 35 },
        { wch: 45 },
        { wch: 30 },
        { wch: 40 },
        { wch: 110 }
      ];
      XLSX.utils.book_append_sheet(wb, wsRef, "Danh_Sach_Anh_Tham_Chieu");
    }
    
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Tu_Lieu_3D";
    const suffix = includeVoiceover ? '_day_du' : '_prompt';
    XLSX.writeFile(wb, `${baseName}_3D_Storyboard${suffix}.xlsx`);
  };

  const pendingCount = fileChunks.filter(c => c.status === 'idle' || c.status === 'error').length;
  const generatedCount = allSegments.length;

  return (
    <div className="min-h-screen bg-slate-50/80 pb-20 relative text-slate-800 font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-cyan-400 p-1.5 rounded-lg flex items-center justify-center shadow-xs">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">TƯ LIỆU 3D STORYBOARD AI</h1>
                <span className="bg-cyan-50 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-200">
                  Chuyên biệt Tư liệu 3D
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Sa bàn Isometric • Mặt cắt phân tầng • Bản đồ 3D • Infographic</p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Hidden Excel input */}
            <input 
              type="file" 
              ref={excelFileInputRef} 
              accept=".xlsx,.xls" 
              onChange={handleExcelInputChange} 
              className="hidden" 
            />

            {/* Resume / Load from Excel Button */}
            <button
              onClick={() => excelFileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-md transition-all shadow-2xs active:scale-95"
              title="Nạp lại file Excel (.xlsx) đã xuất trước đó để tiếp tục tạo hoặc chỉnh sửa"
            >
              <Upload size={14} className="text-emerald-600" />
              <span>Nạp lại file Excel</span>
            </button>

            {/* Session History Modal Trigger */}
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-md transition-all shadow-2xs active:scale-95 relative"
              title="Xem và khôi phục các phiên làm việc đã lưu"
            >
              <History size={14} className="text-cyan-600" />
              <span>Lịch sử phiên</span>
              {savedSessions.length > 0 && (
                <span className="bg-slate-900 text-cyan-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                  {savedSessions.length}
                </span>
              )}
            </button>

            {/* Quick Save Current Session Button */}
            {(fileChunks.length > 0 || referenceImages.length > 0) && (
              <button
                onClick={() => handleSaveCurrentSession()}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 px-3 py-1.5 rounded-md transition-all active:scale-95"
                title="Lưu trạng thái phiên hiện tại vào bộ nhớ trình duyệt"
              >
                <Save size={14} className="text-cyan-700" />
                <span>Lưu phiên</span>
              </button>
            )}

            <a 
              href="https://ai.google.dev/" 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md border border-slate-200"
            >
              Mã API Gemini &rarr;
            </a>
          </div>
        </div>

        {/* Global Toast Notification */}
        {saveSuccessNotice && (
          <div className="bg-slate-900 text-cyan-300 text-xs px-4 py-2 flex items-center justify-between border-t border-slate-800 animate-fadeIn">
            <div className="flex items-center gap-2 max-w-screen-2xl mx-auto w-full">
              <CheckCircle2 size={14} className="text-cyan-400 shrink-0" />
              <span className="font-medium truncate">{saveSuccessNotice}</span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">
        {/* Top Control Bar */}
        <section className="space-y-3">
          <div className="flex justify-between items-end px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">01. CẤU HÌNH TƯ LIỆU 3D</span>
            </div>
            {fileChunks.length > 0 && (
              <button 
                onClick={handleClear} 
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition-colors"
                disabled={isBulkProcessing}
              >
                <Trash2 size={12} /> Cài lại từ đầu
              </button>
            )}
          </div>

          {/* Quick Perspective Selector for 3D */}
          <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-xs">
            <div className="flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setIsStyleExpanded(!isStyleExpanded)}
                className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none"
              >
                <Palette size={15} className="text-cyan-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-slate-900 transition-colors">
                  Phong cách hình ảnh Storyboard
                </h3>
                <span className="text-[11px] font-normal text-slate-400">
                  {isStyleExpanded 
                    ? '(Nhấn để thu gọn)' 
                    : !subStyle 
                      ? '(⚠️ Chưa chọn style • Nhấn để chọn)' 
                      : `(${availableStyles.length} style • Nhấn để đổi)`}
                </span>
              </button>

              <div className="flex items-center gap-2">
                {subStyle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubStyle('');
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Bỏ chọn phong cách"
                  >
                    Bỏ chọn
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setEditingStyle(null);
                    setIsStyleModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-cyan-700 hover:text-cyan-800 px-2 py-1 rounded-md bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-all cursor-pointer shadow-2xs"
                  title="Thêm phong cách mới"
                >
                  <Plus size={12} className="stroke-[2.5]" />
                  <span>Thêm style mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStyleExpanded(!isStyleExpanded)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100/80 hover:bg-slate-200/80 transition-colors cursor-pointer"
                >
                  <span className="text-[11px]">
                    {isStyleExpanded ? 'Thu gọn' : (subStyle ? 'Đổi phong cách' : 'Chọn phong cách')}
                  </span>
                  {isStyleExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            {/* Selected item summary (when collapsed) */}
            {!isStyleExpanded && (
              <div 
                onClick={() => setIsStyleExpanded(true)}
                className={`mt-2.5 flex items-center justify-between p-3 rounded-lg border transition-all shadow-xs cursor-pointer ${
                  !subStyle 
                    ? 'border-dashed border-amber-300 bg-amber-50/90 hover:bg-amber-100/90 text-amber-950'
                    : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${
                    !subStyle
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  }`}>
                    <Sparkles size={14} />
                  </div>
                  <div>
                    {(() => {
                      if (!subStyle) {
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-amber-950">Chưa chọn phong cách hình ảnh storyboard</span>
                            <span className="text-[11px] text-amber-800 hidden md:inline ml-1">• Nhấn vào đây để chọn phong cách phù hợp</span>
                          </div>
                        );
                      }
                      const currentOpt = availableStyles.find(o => o.id === subStyle);
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-white">{currentOpt?.label || subStyle}</span>
                          {currentOpt?.isDefault && (
                            <span className="text-[9px] bg-cyan-900/80 text-cyan-200 font-semibold px-1.5 py-0.2 rounded border border-cyan-700/50">
                              Hợp nhất Sa bàn, Mặt cắt & Bản đồ 3D
                            </span>
                          )}
                          {currentOpt?.isCustom && (
                            <span className="text-[9px] bg-amber-900/80 text-amber-200 font-semibold px-1.5 py-0.2 rounded border border-amber-700/50">
                              Tùy chỉnh của bạn
                            </span>
                          )}
                          {currentOpt?.desc && <span className="text-[11px] text-slate-300 hidden md:inline ml-1">• {currentOpt.desc}</span>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                    !subStyle 
                      ? 'text-amber-900 bg-amber-200/90 border-amber-300 font-bold'
                      : 'text-cyan-300 bg-slate-800 border-slate-700'
                  }`}>
                    {!subStyle ? '⚠️ Chưa chọn • Nhấn để chọn' : 'Đang chọn • Nhấn để xem danh sách'}
                  </span>
                </div>
              </div>
            )}

            {/* All options list (when expanded) */}
            {isStyleExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 items-stretch mt-3 pt-3 border-t border-slate-100">
                {availableStyles.map((opt) => {
                  const isSelected = subStyle === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        if (subStyle === opt.id) {
                          setSubStyle('');
                        } else {
                          setSubStyle(opt.id);
                          setIsStyleExpanded(false);
                        }
                      }}
                      className={`group relative flex flex-col justify-between text-left transition-all rounded-lg border p-3 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900 ring-offset-1'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between w-full">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Sparkles size={14} className={isSelected ? 'text-cyan-300' : 'text-slate-500'} />
                            <span className={isSelected ? 'text-white' : 'text-slate-900'}>{opt.label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isSelected && <Check size={14} className="text-cyan-400 shrink-0" />}
                            {opt.isCustom && (
                              <div className="flex items-center gap-1 ml-1 opacity-80 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={(e) => handleEditStyle(e, opt)}
                                  className={`p-1 rounded hover:bg-slate-700 transition-colors ${isSelected ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                                  title="Chỉnh sửa phong cách"
                                >
                                  <Edit3 size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteStyle(e, opt.id)}
                                  className={`p-1 rounded hover:bg-red-900/60 transition-colors ${isSelected ? 'text-red-300 hover:text-red-200' : 'text-slate-400 hover:text-red-600'}`}
                                  title="Xóa phong cách"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className={`text-[11px] leading-relaxed mt-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {opt.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/40 flex items-center justify-between text-[10px]">
                        <span className={isSelected ? 'text-cyan-300 font-medium' : 'text-slate-400'}>
                          {opt.isDefault ? 'Style mặc định' : 'Style tự tạo'}
                        </span>
                        {isSelected && (
                          <span className="text-cyan-300 font-bold">Đang áp dụng</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add new style button card */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingStyle(null);
                    setIsStyleModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-500 hover:text-cyan-700 transition-all cursor-pointer group min-h-[110px]"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-cyan-100 flex items-center justify-center text-slate-500 group-hover:text-cyan-700 transition-colors mb-2">
                    <Plus size={16} />
                  </div>
                  <span className="text-xs font-bold">Thêm phong cách mới</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-cyan-600 mt-0.5">
                    Tùy biến Anime, Cinematic, Cyberpunk...
                  </span>
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Column: File Upload & Generation Settings (4 cols) */}
            <div className="md:col-span-4 flex flex-col gap-4">
              {/* Dropzone with SRT & Excel support */}
              <Dropzone 
                onFileLoaded={handleFileLoaded} 
                onExcelLoaded={handleLoadExcelFile}
                isLoading={isBulkProcessing} 
              />

              {/* Mode & Timing Settings */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={() => setIsModeExpanded(!isModeExpanded)}
                    className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Timer size={14} className="text-cyan-600" />
                    <h3>Chế độ phân đoạn thời gian</h3>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModeExpanded(!isModeExpanded)}
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded bg-slate-100/80 hover:bg-slate-200/80 transition-colors cursor-pointer"
                  >
                    <span>{isModeExpanded ? 'Thu gọn' : 'Đổi'}</span>
                    {isModeExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                
                {/* Collapsed view: Show ONLY selected option */}
                {!isModeExpanded ? (
                  <div 
                    onClick={() => setIsModeExpanded(true)}
                    className="p-2.5 rounded-lg border border-slate-800 bg-slate-50/90 cursor-pointer hover:bg-slate-100/80 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          {(segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') && 'Lưới thời gian linh hoạt 4 - 9s & Khớp lời thoại'}
                          {segmentMode === 'multi_prompt_line' && 'Nhiều prompt 3D cho mỗi câu phụ đề'}
                          {segmentMode === 'line' && '1 câu phụ đề = 1 prompt 3D'}
                          {segmentMode === 'duration' && `Lưới thời gian cố định (${segmentDuration}s / cảnh)`}
                        </span>
                        {(segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') && (
                          allowLongerPacingFromPart3 ? (
                            <span className="text-[9px] font-bold bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded border border-violet-200">
                              {boostShortScenesPart1 ? 'P1: 3.5-6s • P2: 4-8s • P3+: 8-14s' : 'Phần 1-2: 4-9s • Từ Phần 3: 8-14s'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-mono font-extrabold bg-violet-100 text-violet-800 px-1 rounded border border-violet-200">&lt;4&gt;</span>
                              <span className="text-[9px] font-mono font-extrabold bg-cyan-100 text-cyan-800 px-1 rounded border border-cyan-200">&lt;6&gt;</span>
                              <span className="text-[9px] font-mono font-extrabold bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-200">&lt;7.5&gt;</span>
                              <span className="text-[9px] font-mono font-extrabold bg-amber-100 text-amber-900 px-1 rounded border border-amber-200">&lt;9&gt;</span>
                            </div>
                          )
                        )}
                      </div>
                      <span className="text-[10px] text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded font-semibold">
                        Đang chọn
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-snug mt-1 block">
                      {(segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') && (
                        allowLongerPacingFromPart3
                          ? (boostShortScenesPart1
                              ? 'Phần 1 tăng cường nhiều cảnh ngắn (3.5s - 6s) hook giữ chân khán giả; Phần 2 chuyển tiếp 4s - 8s; Từ Phần 3 trở đi: 8s - 14s có độ lắng sâu sắc.'
                              : 'Phần 1 & 2 giữ nhịp 4s - 9s. Từ Phần 3 trở đi: 8s - 14s (thấp nhất 8s, cho phép cảnh 14s). Khớp lời thoại 100%, prompt sạch không kèm thẻ.')
                          : 'Thời lượng linh hoạt 4s - 9s (4.5s, 5.5s, 6.5s, 7s, 7.5s, 8.5s, 9s...) bám sát từng câu phụ đề; hình ảnh mô tả chuẩn xác nội dung lời thoại; prompt sạch không kèm thẻ.'
                      )}
                      {segmentMode === 'multi_prompt_line' && '≤6s: 1 prompt, ≤12s: 2 prompt... Tự động phân đoạn theo độ dài sub.'}
                      {segmentMode === 'line' && 'Mỗi dòng sub tương ứng một góc sa bàn 3D hoàn chỉnh.'}
                      {segmentMode === 'duration' && `Cắt cố định mỗi ${segmentDuration} giây một khung cảnh.`}
                    </span>
                  </div>
                ) : (
                  /* Expanded view: Show all options */
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    {/* Option 1: 4-9s Dynamic Flexible Grid */}
                    <label className={`flex items-start gap-2.5 cursor-pointer rounded-lg border p-2 transition-all ${
                      (segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468')
                        ? 'border-slate-800 bg-slate-50/80 shadow-xs ring-1 ring-slate-800'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}>
                      <input 
                        type="radio" 
                        name="segmentMode" 
                        checked={segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468'}
                        onChange={() => {
                          handleModeChange('dynamic_grid_4_9');
                          setIsModeExpanded(false);
                        }}
                        disabled={isBulkProcessing}
                        className="text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 mt-0.5 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800">Lưới linh hoạt 4 - 9s & Khớp lời thoại</span>
                          </div>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Khuyên dùng</span>
                        </div>
                        <span className="text-[10px] text-slate-500 leading-snug mt-1 pt-1 border-t border-slate-100">
                          Tự động phân đoạn thời gian từ 4s đến 9s (ví dụ 4.5s, 5.5s, 6.5s, 7s, 7.5s, 8.5s, 9s...) bám sát từng câu phụ đề; hình ảnh mô tả chuẩn xác 100% nội dung lời thoại tại thời điểm hiển thị; prompt sạch không chèn thẻ thời lượng.
                        </span>
                      </div>
                    </label>

                    {/* Option 2: Multi prompt per subtitle line */}
                    <label className={`flex items-start gap-2.5 cursor-pointer rounded-lg border p-2 transition-all ${
                      segmentMode === 'multi_prompt_line'
                        ? 'border-slate-800 bg-slate-50/80 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}>
                      <input 
                        type="radio" 
                        name="segmentMode" 
                        checked={segmentMode === 'multi_prompt_line'}
                        onChange={() => {
                          handleModeChange('multi_prompt_line');
                          setIsModeExpanded(false);
                        }}
                        disabled={isBulkProcessing}
                        className="text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 mt-0.5 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Nhiều prompt 3D cho mỗi câu phụ đề</span>
                          <span className="text-[9px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.2 rounded">Theo từng câu</span>
                        </div>
                        <span className="text-[10px] text-slate-500 leading-snug mt-1 pt-1 border-t border-slate-100">
                          ≤6s: 1 prompt, ≤12s: 2 prompt, ≤16s: 3 prompt... Cảnh 3D bổ trợ góc quay & camera motion dẫn nối tiếp nhau.
                        </span>
                      </div>
                    </label>

                    {/* Option 3: 1 line = 1 prompt */}
                    <label className={`flex items-start gap-2.5 cursor-pointer rounded-lg border p-2 transition-all ${
                      segmentMode === 'line'
                        ? 'border-slate-800 bg-slate-50/80 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}>
                      <input 
                        type="radio" 
                        name="segmentMode" 
                        checked={segmentMode === 'line'}
                        onChange={() => {
                          handleModeChange('line');
                          setIsModeExpanded(false);
                        }}
                        disabled={isBulkProcessing}
                        className="text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 mt-0.5 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-xs font-semibold text-slate-800">1 câu phụ đề = 1 prompt 3D</span>
                        <span className="text-[10px] text-slate-500 leading-snug mt-1 pt-1 border-t border-slate-100">
                          Mỗi dòng sub tương ứng một góc sa bàn 3D hoàn chỉnh.
                        </span>
                      </div>
                    </label>

                    {/* Option 4: Fixed duration grid */}
                    <label className={`flex items-start gap-2.5 cursor-pointer rounded-lg border p-2 transition-all ${
                      segmentMode === 'duration'
                        ? 'border-slate-800 bg-slate-50/80 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}>
                      <input 
                        type="radio" 
                        name="segmentMode" 
                        checked={segmentMode === 'duration'}
                        onChange={() => handleModeChange('duration')}
                        disabled={isBulkProcessing}
                        className="text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 mt-0.5 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-xs font-semibold text-slate-800">Lưới thời gian cố định (giây)</span>
                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                          <input 
                            type="number" 
                            min="1" 
                            max="60"
                            value={segmentDuration}
                            onChange={handleDurationChange}
                            disabled={isBulkProcessing}
                            className="w-16 p-1 text-xs text-center border border-slate-300 rounded focus:ring-1 focus:ring-slate-400 outline-none font-bold bg-white"
                          />
                          <span className="text-[11px] text-slate-500 font-medium">giây / mỗi cảnh 3D</span>
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {/* Sub-option for Flexible Grid: 8-14s pacing from Part 3 onwards */}
                {(segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none group bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200 rounded-lg p-2.5 transition-all">
                      <input
                        type="checkbox"
                        checked={allowLongerPacingFromPart3}
                        onChange={(e) => setAllowLongerPacingFromPart3(e.target.checked)}
                        disabled={isBulkProcessing}
                        className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">
                            Thêm cảnh 14s & tối thiểu 8s (Từ Phần 3 trở đi)
                          </span>
                          <span className="text-[9px] font-bold bg-violet-100 text-violet-800 px-1.5 py-0.2 rounded border border-violet-200">
                            Từ Phần 3
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 leading-snug mt-1">
                          Phần 1 & 2 giữ nhịp 4s - 9s. Từ <strong>Phần 3 trở đi</strong>, thời lượng mỗi cảnh mở rộng thành <strong>8s đến 14s</strong> (thấp nhất 8s, cho phép cảnh 14s) giúp khung hình có độ lắng, góc quay điềm đạm và diễn giải bối cảnh sâu sắc hơn.
                        </span>
                      </div>
                    </label>

                    {/* Sub-feature: Boost short scenes in Part 1 */}
                    {allowLongerPacingFromPart3 && (
                      <div className="pl-3 pr-2.5 py-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg transition-all animate-fadeIn">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                          <input
                            type="checkbox"
                            checked={boostShortScenesPart1}
                            onChange={(e) => setBoostShortScenesPart1(e.target.checked)}
                            disabled={isBulkProcessing}
                            className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                          />
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-amber-950 group-hover:text-amber-800 transition-colors flex items-center gap-1">
                                <span>⚡ Tăng tối đa số cảnh ngắn ở Phần 1</span>
                              </span>
                              <span className="text-[9px] font-extrabold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300">
                                3.5s - 6.0s (Hook mở đầu)
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-800 leading-snug mt-1">
                              Tách nhỏ từng câu thoại thành nhiều cảnh ngắn (3.5s - 5.5s, tối đa 6s) với góc quay và chuyển động camera 3D liên tục thay đổi. Giúp nhịp mở đầu Phần 1 dồn dập, tăng tỷ lệ giữ chân khán giả (Audience Retention Hook).
                            </span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Middle Column: 3D Render Themes & Details (4 cols) */}
            <div className="md:col-span-4 flex flex-col gap-4">
              {/* 3D Render Theme */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                    className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <Maximize2 size={14} className="text-cyan-600" />
                    <h3>Chất liệu & Tông màu 3D</h3>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded bg-slate-100/80 hover:bg-slate-200/80 transition-colors cursor-pointer"
                  >
                    <span>{isThemeExpanded ? 'Thu gọn' : 'Đổi'}</span>
                    {isThemeExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                {/* Collapsed view: Show ONLY selected option */}
                {!isThemeExpanded ? (
                  <div 
                    onClick={() => setIsThemeExpanded(true)}
                    className="p-2.5 rounded-lg border border-slate-800 bg-slate-50/90 cursor-pointer hover:bg-slate-100/80 transition-all"
                  >
                    {(() => {
                      const currentTheme = renderThemeOptions.find(t => t.id === renderTheme) || renderThemeOptions[0];
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{currentTheme.label}</span>
                            <span className="text-[10px] text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded font-semibold">
                              Đang chọn
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 leading-tight mt-1 block">
                            {currentTheme.desc}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  /* Expanded view: Show all theme options */
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    {renderThemeOptions.map((thm) => {
                      const isSelected = renderTheme === thm.id;
                      return (
                        <label 
                          key={thm.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-slate-800 bg-slate-50/80 shadow-xs' 
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="renderTheme"
                            value={thm.id}
                            checked={isSelected}
                            onChange={() => {
                              setRenderTheme(thm.id);
                              setIsThemeExpanded(false);
                            }}
                            disabled={isBulkProcessing}
                            className="mt-0.5 text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                          />
                          <div className="flex flex-col flex-1">
                            <span className={`text-xs font-semibold ${isSelected ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                              {thm.label}
                            </span>
                            <span className="text-[10px] text-slate-500 leading-tight mt-1 pt-1 border-t border-slate-100">
                              {thm.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3D Features & Toggles */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                  <Activity size={14} className="text-cyan-600" />
                  <h3>Hiệu ứng & Trường dữ liệu 3D</h3>
                </div>

                <div className="flex flex-col gap-2.5 mt-1">
                  {/* Allow text / data in 3D */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={allowTextInImage}
                      onChange={(e) => setAllowTextInImage(e.target.checked)}
                      disabled={isBulkProcessing}
                      className="mt-0.5 text-slate-900 focus:ring-slate-900 w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                        Cho phép nhãn số liệu & chữ trên mô hình 3D
                      </span>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Hiển thị chính xác tên địa danh, số liệu %, nhãn HUD trích xuất từ phụ đề.
                      </p>
                    </div>
                  </label>

                  {/* Motion in 3D */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeMotion}
                      onChange={(e) => setIncludeMotion(e.target.checked)}
                      disabled={isBulkProcessing}
                      className="mt-0.5 text-slate-900 focus:ring-slate-900 w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                        Chuyển động Camera 3D & Hiệu ứng Kinetic HUD (Motion)
                      </span>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Mô tả chi tiết quỹ đạo quay 3D (xoay orbit, zoom sa bàn, trượt mặt cắt) và chuyển cảnh sang Part tiếp theo.
                      </p>
                    </div>
                  </label>

                  {/* Character fields in JSON */}
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeCharactersPresent}
                        onChange={(e) => setIncludeCharactersPresent(e.target.checked)}
                        disabled={isBulkProcessing}
                        className="text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 rounded border-slate-300 cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-slate-600">characters_present</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeCharactersAbsent}
                        onChange={(e) => setIncludeCharactersAbsent(e.target.checked)}
                        disabled={isBulkProcessing}
                        className="text-slate-900 focus:ring-slate-900 w-3.5 h-3.5 rounded border-slate-300 cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-slate-600">characters_absent</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Cast / Entities List */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <Users size={14} className="text-cyan-600" />
                    <h3>Thực thể & Nhân vật 3D</h3>
                  </div>
                  {rawFileContent && (
                    <button
                      onClick={handleAnalyzeCast}
                      disabled={isAnalyzingCast || isBulkProcessing}
                      className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 disabled:opacity-50 flex items-center gap-1 uppercase tracking-tighter bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded transition-colors"
                    >
                      {isAnalyzingCast ? (
                        <><Loader2 size={10} className="animate-spin" /> Đang phân tích</>
                      ) : (
                        <><Sparkles size={10} /> Phân tích AI</>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full min-h-[70px] p-2 text-[11px] bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-slate-400 outline-none resize-none font-mono text-slate-700"
                  placeholder="Nhập tên tòa nhà, đối tượng hoặc nhân vật 3D (ví dụ: Tháp Landmark, Đội thi công(35 age))..."
                  value={castList}
                  onChange={(e) => setCastList(e.target.value)}
                  disabled={isBulkProcessing}
                />
              </div>
            </div>

            {/* Right Column: Chunk List & Batch Generation (4 cols) */}
            <div className="md:col-span-4 relative min-h-[400px] flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              {fileChunks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-300">
                  <FileText className="w-8 h-8 mb-2 opacity-30 text-slate-400" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Đang chờ file phụ đề (.srt)</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">Kéo thả file SRT vào ô bên trái để tự động phân tích và tạo storyboard tư liệu 3D.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100 max-h-[640px] overflow-y-auto custom-scrollbar h-full">
                  {/* Header Bar */}
                  <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-200 shadow-xs sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <FileText size={13} className="text-cyan-600"/> 
                        <span className="truncate max-w-[180px]">{fileName}</span>
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-medium text-slate-500">
                        <span>{fileChunks.length} Phần</span>
                        <span>•</span>
                        <span>Ước tính: <strong className="text-slate-800">{estimatedTotalPrompts}</strong> prompt</span>
                        <span>•</span>
                        <span>Đã xong: <strong className="text-emerald-700">{generatedCount}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {pendingCount > 0 && (
                        <button 
                          onClick={handleGenerateAll}
                          disabled={isBulkProcessing}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-white transition-all shadow-xs
                            ${isBulkProcessing 
                              ? 'bg-slate-400 cursor-not-allowed' 
                              : 'bg-slate-900 hover:bg-slate-800 active:scale-95'
                            }`}
                        >
                          {isBulkProcessing ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Đang xử lý 3D...
                            </>
                          ) : (
                            <>
                              <Play size={11} fill="currentColor" />
                              Tạo tất cả ({pendingCount})
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chunk items */}
                  {fileChunks.map((chunk) => (
                    <div key={chunk.id} className="p-3 flex flex-col hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800">Phần {chunk.id + 1}</span>
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                              {chunk.startTime} - {chunk.endTime}
                            </span>
                            {(segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468') && allowLongerPacingFromPart3 && (
                              chunk.id === 0 && boostShortScenesPart1 ? (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-200 flex items-center gap-0.5">
                                  ⚡ P1: Nhiều cảnh ngắn (3.5s - 6s)
                                </span>
                              ) : chunk.id === 1 ? (
                                <span className="text-[9px] font-medium bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded border border-cyan-200">
                                  P2: Chuyển tiếp 4s - 8s
                                </span>
                              ) : chunk.id >= 2 ? (
                                <span className="text-[9px] font-bold bg-violet-100 text-violet-800 px-1.5 py-0.2 rounded border border-violet-200">
                                  Lưới 8s - 14s
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                  Lưới 4s - 9s
                                </span>
                              )
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Khung lưới: {chunk.gridStart} - {chunk.gridEnd}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {chunk.status === 'success' && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                              <CheckCircle2 size={12} /> {chunk.results.length} prompt
                            </span>
                          )}
                          
                          <button
                            onClick={() => handleGenerateChunk(chunk.id)}
                            disabled={chunk.status === 'loading' || isBulkProcessing}
                            className={`
                              flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all
                              ${chunk.status === 'success' 
                                ? 'bg-white border border-slate-200 text-slate-600 hover:text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50' 
                                : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-xs'
                              }
                              ${(chunk.status === 'loading' || isBulkProcessing) ? 'bg-slate-300 text-slate-600 cursor-not-allowed opacity-80' : ''}
                            `}
                          >
                            {chunk.status === 'loading' ? (
                              <>
                                <Loader2 size={12} className="animate-spin" /> Đang tạo
                              </>
                            ) : chunk.status === 'success' ? (
                              <>
                                <RotateCcw size={12} /> Tạo lại
                              </>
                            ) : (
                              <>
                                <PlayCircle size={12} /> Tạo 3D
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      {chunk.status === 'error' && chunk.errorMessage && (
                        <div className="mt-2 text-[11px] text-red-600 bg-red-50 p-2 rounded border border-red-200">
                          {chunk.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section: Bối Cảnh & Ảnh Tham Chiếu Chuẩn Tỉ Lệ */}
        <section>
          <ReferenceImagesManager
            referenceImages={referenceImages}
            onUpdateReferenceImages={setReferenceImages}
            onAnalyzeReferenceImages={handleAnalyzeReferenceImages}
            isAnalyzing={isAnalyzingRefImages}
            hasSubtitles={!!rawFileContent}
          />
        </section>

        {/* Results Section - Grouped by Minute with Compact Controls */}
        {allSegments.length > 0 && (
          <section ref={resultRef} className="pt-2 space-y-4">
            {/* Sticky Header & Toolbar */}
            <div className="border-t border-slate-200 pt-4 pb-3 sticky top-12 bg-slate-50/95 backdrop-blur-xs z-20 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Title & Stats */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    02. KẾT QUẢ TƯ LIỆU 3D
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                    {resultSearchQuery ? `${Object.values(groupedSegments).flat().length} / ${allSegments.length}` : allSegments.length} Cảnh 3D
                  </span>

                  {/* View Mode Toggle: Compact vs Detailed */}
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/80 text-xs ml-1">
                    <button
                      onClick={() => setResultViewMode('compact')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                        resultViewMode === 'compact'
                          ? 'bg-white text-cyan-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Chế độ thu gọn danh sách (tiết kiệm không gian)"
                    >
                      <LayoutList size={13} />
                      <span>Thu gọn</span>
                    </button>
                    <button
                      onClick={() => setResultViewMode('detailed')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                        resultViewMode === 'detailed'
                          ? 'bg-white text-cyan-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Chế độ xem đầy đủ chi tiết"
                    >
                      <LayoutGrid size={13} />
                      <span>Chi tiết</span>
                    </button>
                  </div>

                  {/* Collapse / Expand all minutes buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCollapseAllMinutes(Object.keys(groupedSegments))}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md flex items-center gap-1 transition-all shadow-2xs"
                      title="Thu gọn tất cả các phút"
                    >
                      <ChevronsUp size={12} />
                      <span className="hidden sm:inline">Đóng tất cả</span>
                    </button>
                    <button
                      onClick={handleExpandAllMinutes}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md flex items-center gap-1 transition-all shadow-2xs"
                      title="Mở rộng tất cả các phút"
                    >
                      <ChevronsDown size={12} />
                      <span className="hidden sm:inline">Mở tất cả</span>
                    </button>
                  </div>
                </div>

                {/* Right Actions: Export & Save */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none mr-1">
                    <input 
                      type="checkbox" 
                      checked={excludeAbsent} 
                      onChange={(e) => setExcludeAbsent(e.target.checked)}
                      className="w-3.5 h-3.5 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
                    />
                    Bỏ trường vắng mặt
                  </label>

                  <button
                    onClick={() => handleSaveCurrentSession()}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-cyan-50 border border-cyan-300 rounded-md hover:bg-cyan-100 shadow-2xs transition-all active:scale-95"
                    title="Lưu kết quả phân cảnh và ảnh tham chiếu vào lịch sử"
                  >
                    <Save size={13} className="text-cyan-700" />
                    <span>Lưu</span>
                  </button>

                  <button
                    onClick={() => handleExportExcel(false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all active:scale-95"
                    title="Xuất file chỉ chứa các prompt 3D JSON và chuyển động Motion"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" />
                    <span>Xuất Prompt</span>
                  </button>
                  <button
                    onClick={() => handleExportExcel(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 border border-emerald-700 rounded-md hover:bg-emerald-700 shadow-2xs transition-all active:scale-95"
                    title="Xuất file đầy đủ gồm cả Lời thoại, Chuyển động và Prompt 3D"
                  >
                    <FileSpreadsheet size={13} />
                    <span>Xuất Đầy Đủ</span>
                  </button>
                </div>
              </div>

              {/* Search Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={resultSearchQuery}
                    onChange={(e) => setResultSearchQuery(e.target.value)}
                    placeholder="Lọc nhanh kết quả theo lời thoại, bối cảnh, hành động 3D, mã @name..."
                    className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 shadow-2xs"
                  />
                  {resultSearchQuery && (
                    <button
                      onClick={() => setResultSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      title="Xóa bộ lọc tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Minute Groups with Collapsible Sections */}
            {Object.keys(groupedSegments).length === 0 && resultSearchQuery ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-slate-700">Không tìm thấy phân cảnh nào phù hợp với "{resultSearchQuery}"</p>
                <button
                  onClick={() => setResultSearchQuery('')}
                  className="text-cyan-600 font-bold hover:underline"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedSegments).sort().map(([minute, rawSegments]) => {
                  const segments = rawSegments as StoryboardSegment[];
                  const isCollapsed = collapsedMinutes.has(minute);
                  return (
                    <div key={minute} className="bg-white/60 border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                      {/* Minute Accordion Header */}
                      <button
                        onClick={() => toggleMinuteCollapse(minute)}
                        className="w-full px-3.5 py-2 flex items-center justify-between bg-slate-100/80 hover:bg-slate-200/70 transition-colors select-none text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="bg-slate-900 text-cyan-300 px-2.5 py-0.5 rounded shadow-2xs flex items-center gap-1.5 font-mono font-bold text-xs">
                            <Clock size={12} className="text-cyan-400" />
                            <span>Phút {minute}:00 - {minute}:59</span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {segments.length} Cảnh
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                          <span className="hidden sm:inline text-[11px] text-slate-500">
                            {isCollapsed ? 'Nhấn để mở rộng' : 'Nhấn để thu gọn'}
                          </span>
                          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </div>
                      </button>

                      {/* Segments List */}
                      {!isCollapsed && (
                        <div className="p-3">
                          <div className={resultViewMode === 'compact' ? "space-y-1.5" : "grid gap-3"}>
                            {segments.map((segment) => {
                              const globalIndex = allSegments.indexOf(segment);
                              return (
                                <ResultCard 
                                  key={globalIndex >= 0 ? globalIndex : segment.timeRange} 
                                  segment={segment} 
                                  index={globalIndex >= 0 ? globalIndex : 0} 
                                  isCompact={resultViewMode === 'compact'}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        
        {/* Empty State when no results */}
        {allSegments.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-white/50">
            <Box className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">Sẵn sàng tạo Storyboard Tư liệu 3D</p>
            <p className="mt-1 text-slate-400">Tải file phụ đề SRT hoặc nạp lại file Excel (.xlsx) để tiếp tục tạo các khối sa bàn isometric, mặt cắt và đồ họa không gian.</p>
          </div>
        )}
      </main>

      {/* Floating Scroll Controls */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {fileChunks.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="p-2.5 bg-white text-slate-700 rounded-full shadow-md border border-slate-200 hover:bg-slate-100 transition-all hover:scale-105 active:scale-95"
            title="Cuộn xuống kết quả"
          >
            <ArrowDown size={18} />
          </button>
        )}
        
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="p-2.5 bg-slate-900 text-white rounded-full shadow-md hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
            title="Cuộn lên đầu trang"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>

      {/* Session History Modal */}
      <SessionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        sessions={savedSessions}
        onRestoreSession={handleRestoreSession}
        onUpdateSessions={setSavedSessions}
      />

      {/* Style Management Modal */}
      <StyleModal
        isOpen={isStyleModalOpen}
        onClose={() => {
          setIsStyleModalOpen(false);
          setEditingStyle(null);
        }}
        onSave={handleSaveStyle}
        initialData={editingStyle}
      />
    </div>
  );
};

export default App;
