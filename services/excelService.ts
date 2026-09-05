import * as XLSX from 'xlsx';
import { ChunkState } from '../App';
import { 
  StoryboardSegment, 
  ReferenceImageItem, 
  formatReferenceImagePrompt, 
  timestampToSeconds, 
  secondsToMMSS,
  sanitizeMotionPrompt
} from './geminiService';

export interface ExcelImportResult {
  fileName: string;
  segments: StoryboardSegment[];
  referenceImages: ReferenceImageItem[];
  reconstructedChunks: ChunkState[];
  synthesizedSrt: string;
}

export const parseExcelStoryboard = async (file: File): Promise<ExcelImportResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // 1. Find Storyboard Sheet
  let storyboardSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('storyboard') || 
    name.toLowerCase().includes('tu_lieu') ||
    name.toLowerCase().includes('prompt') ||
    name.toLowerCase().includes('sheet1')
  ) || workbook.SheetNames[0];

  const storyboardSheet = workbook.Sheets[storyboardSheetName];
  if (!storyboardSheet) {
    throw new Error("Không tìm thấy trang tính Storyboard hợp lệ trong tệp Excel.");
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(storyboardSheet);
  if (rawRows.length === 0) {
    throw new Error("Tệp Excel không chứa dòng dữ liệu nào.");
  }

  // 2. Parse Reference Images Sheet if present
  const refImagesSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('tham_chieu') || 
    name.toLowerCase().includes('reference') ||
    name.toLowerCase().includes('anh_tham_chieu')
  );

  const referenceImages: ReferenceImageItem[] = [];
  if (refImagesSheetName && workbook.Sheets[refImagesSheetName]) {
    const refRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[refImagesSheetName]);
    refRows.forEach((row, idx) => {
      const rawName = row["Tên định danh (@name)"] || row["Tên định danh"] || row["name"] || row["Name"] || `ref_${idx + 1}`;
      const cleanName = String(rawName).replace(/^@+/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      const subject = row["Chủ thể chính"] || row["Chủ thể"] || row["subject"] || row["Subject"] || 'Bối cảnh tham chiếu';
      const context1 = row["Bối cảnh 1 (Vị trí)"] || row["Bối cảnh 1"] || row["context1"] || '';
      const context2 = row["Bối cảnh 2 (Không gian mở rộng)"] || row["Bối cảnh 2"] || row["context2"] || '';
      const imageType = row["Loại ảnh"] || row["imageType"] || 'Ảnh chụp trên cao, góc rộng, độ phân giải cao';
      const structureDetails = row["Chi tiết cấu trúc"] || row["structureDetails"] || 'chi tiết cấu trúc kiến trúc và tỉ lệ thực tế';
      const perspective = row["Góc máy"] || row["perspective"] || 'high-angle diagonal view, dynamic';
      const lighting = row["Ánh sáng"] || row["lighting"] || 'natural, clear daylight/golden hour to define all structures';
      
      const fullPrompt = row["Prompt Ảnh Tham Chiếu Chuẩn"] || row["Prompt"] || row["fullPrompt"] || formatReferenceImagePrompt({
        imageType,
        subject,
        context1,
        structureDetails,
        perspective,
        context2,
        lighting
      });

      referenceImages.push({
        id: `ref_imported_${idx}_${Date.now()}`,
        name: cleanName || `ref_${idx + 1}`,
        subject,
        context1,
        imageType,
        structureDetails,
        perspective,
        context2,
        lighting,
        fullPrompt
      });
    });
  }

  // 3. Parse Segments from Storyboard sheet
  const segments: StoryboardSegment[] = [];
  const srtSubtitleBlocks: string[] = [];

  rawRows.forEach((row, idx) => {
    // Determine timeRange & durationTag
    let rawTimeRange = row["Thời gian"] || row["Thời Gian"] || row["Time"] || row["timeRange"] || `${secondsToMMSS(idx * 10)} - ${secondsToMMSS((idx + 1) * 10)}`;
    const tagMatch = /<([0-9]+(?:[.,][0-9]+)?)>/.exec(String(rawTimeRange));
    let durationTag = row["Thẻ thời lượng"] || row["Độ dài thẻ"] || (tagMatch ? `<${tagMatch[1].replace(',', '.')}>` : undefined);
    
    // Clean timeRange if it had the tag embedded
    const timeRange = String(rawTimeRange).replace(/<[^>]+>/g, '').trim();
    
    const partVal = row["Part"] || row["part"] || 1;
    const partNumber = typeof partVal === 'number' ? partVal : parseInt(String(partVal)) || 1;
    
    // Reference image tag
    const refTag = row["Ảnh tham chiếu (@name)"] || row["Ảnh tham chiếu"] || row["reference_image"] || row["reference"] || "";
    const cleanRefTag = refTag ? (String(refTag).startsWith('@') ? String(refTag) : `@${refTag}`) : undefined;

    // Voiceover Context
    const voiceover = row["Lời thoại (Voiceover)"] || row["Lời thoại"] || row["Voiceover"] || row["voiceover_context"] || "";

    // Motion
    const motion = row["Chuyển động 3D (Motion)"] || row["Chuyển động 3D"] || row["Motion"] || row["motion"] || "";

    // Parse JSON Prompt content
    const promptRaw = row["Nội dung Prompt 3D"] || row["Prompt 3D"] || row["Prompt"] || row["JSON"] || "";
    let jsonContent: any = {};

    if (typeof promptRaw === 'string' && promptRaw.trim().startsWith('{')) {
      try {
        jsonContent = JSON.parse(promptRaw);
      } catch {
        jsonContent = { description: promptRaw };
      }
    } else if (typeof promptRaw === 'object' && promptRaw !== null) {
      jsonContent = { ...promptRaw };
    } else {
      jsonContent = {
        style: "3D Isometric Diorama",
        background: String(promptRaw || "3D Architectural scene"),
        elements: "Key 3D model components and spatial structures"
      };
    }

    // Reattach fields into jsonContent
    if (voiceover && !jsonContent.voiceover_context) {
      jsonContent.voiceover_context = voiceover;
    }
    if (motion && !jsonContent.motion) {
      jsonContent.motion = sanitizeMotionPrompt(motion);
    } else if (jsonContent.motion) {
      jsonContent.motion = sanitizeMotionPrompt(jsonContent.motion);
    }
    if (cleanRefTag && !jsonContent.reference_image) {
      jsonContent.reference_image = cleanRefTag;
    }
    jsonContent.part = partNumber;

    if (!durationTag) {
      durationTag = jsonContent.duration_tag || (jsonContent.duration ? `<${jsonContent.duration}>` : undefined);
    }

    segments.push({
      timeRange: String(timeRange).trim(),
      jsonContent,
      rawJson: JSON.stringify(jsonContent, null, 2),
      part: partNumber,
      durationTag
    });

    // Synthesize subtitle block for SRT representation
    if (voiceover && voiceover.trim().length > 0) {
      // Check if time range format is "MM:SS - MM:SS" or "HH:MM:SS,ms --> HH:MM:SS,ms"
      const tr = String(timeRange).trim();
      let srtTime = "";
      if (tr.includes('-->')) {
        srtTime = tr;
      } else if (tr.includes('-')) {
        const parts = tr.split('-').map(p => p.trim());
        const sSec = timestampToSeconds(parts[0]);
        const eSec = timestampToSeconds(parts[1] || parts[0]);
        srtTime = `00:${secondsToMMSS(sSec)},000 --> 00:${secondsToMMSS(eSec)},000`;
      } else {
        srtTime = `00:${secondsToMMSS(idx * 10)},000 --> 00:${secondsToMMSS((idx + 1) * 10)},000`;
      }

      srtSubtitleBlocks.push(`${idx + 1}\n${srtTime}\n${voiceover}`);
    }
  });

  const synthesizedSrt = srtSubtitleBlocks.join('\n\n');

  // 4. Group segments into 150-second (2.5 min) or 60-second chunks for continuing runs
  const CHUNK_DURATION = 150; // seconds per chunk
  const chunksMap = new Map<number, {
    segments: StoryboardSegment[];
    srtBlocks: string[];
    minSec: number;
    maxSec: number;
  }>();

  segments.forEach((seg, idx) => {
    // calculate start time in seconds
    const timeParts = seg.timeRange.split(/[-–]/).map(p => p.trim());
    const startSec = timestampToSeconds(timeParts[0] || "00:00");
    const endSec = timestampToSeconds(timeParts[1] || timeParts[0] || "00:10");

    const chunkIdx = Math.floor(startSec / CHUNK_DURATION);
    if (!chunksMap.has(chunkIdx)) {
      chunksMap.set(chunkIdx, {
        segments: [],
        srtBlocks: [],
        minSec: startSec,
        maxSec: endSec
      });
    }

    const c = chunksMap.get(chunkIdx)!;
    c.segments.push(seg);
    c.minSec = Math.min(c.minSec, startSec);
    c.maxSec = Math.max(c.maxSec, endSec);

    const vo = seg.jsonContent?.voiceover_context;
    if (vo) {
      c.srtBlocks.push(`${idx + 1}\n00:${secondsToMMSS(startSec)},000 --> 00:${secondsToMMSS(endSec)},000\n${vo}`);
    }
  });

  const sortedChunkIndices = Array.from(chunksMap.keys()).sort((a, b) => a - b);
  const reconstructedChunks: ChunkState[] = sortedChunkIndices.map(cIdx => {
    const chunkData = chunksMap.get(cIdx)!;
    const gridStart = secondsToMMSS(cIdx * CHUNK_DURATION);
    const gridEnd = secondsToMMSS((cIdx + 1) * CHUNK_DURATION);

    return {
      id: cIdx,
      startTime: secondsToMMSS(chunkData.minSec),
      endTime: secondsToMMSS(chunkData.maxSec),
      gridStart,
      gridEnd,
      realEndTime: secondsToMMSS(chunkData.maxSec),
      content: chunkData.srtBlocks.join('\n\n') || `Phân đoạn ${gridStart} - ${gridEnd}`,
      originalIndexStart: 1,
      originalIndexEnd: chunkData.segments.length,
      status: 'success',
      results: chunkData.segments
    };
  });

  return {
    fileName: file.name,
    segments,
    referenceImages,
    reconstructedChunks,
    synthesizedSrt
  };
};
