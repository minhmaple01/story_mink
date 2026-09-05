import React, { useState } from 'react';
import { Copy, Check, Video, Image as ImageIcon, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { StoryboardSegment } from '../services/geminiService';

interface ResultCardProps {
  segment: StoryboardSegment;
  index: number;
  isCompact?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ segment, index, isCompact = false }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!isCompact);

  // Sync expanded state when isCompact mode changes
  React.useEffect(() => {
    setIsExpanded(!isCompact);
  }, [isCompact]);

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (segment.jsonContent) {
      const filteredJson = { ...segment.jsonContent };
      delete filteredJson.voiceover_context;
      delete filteredJson.duration_tag;
      delete filteredJson.duration;
      
      if (filteredJson.characters_present === "" || filteredJson.characters_present === null) {
        delete filteredJson.characters_present;
      }
      if (filteredJson.characters_absent === "" || filteredJson.characters_absent === null) {
        delete filteredJson.characters_absent;
      }

      navigator.clipboard.writeText(JSON.stringify(filteredJson, null, 2));
    } else {
      navigator.clipboard.writeText(segment.rawJson);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasError = !segment.jsonContent;
  const referenceImage = segment.jsonContent?.reference_image || segment.jsonContent?.reference;
  const rawDurationTag = segment.durationTag || segment.jsonContent?.duration_tag || (segment.jsonContent?.duration ? `<${segment.jsonContent.duration}>` : undefined);
  const durationTag = rawDurationTag ? (rawDurationTag.startsWith('<') ? rawDurationTag : `<${rawDurationTag}>`) : undefined;

  const getDurationTagStyle = (tag?: string) => {
    if (!tag) return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    const cleanNum = parseFloat(tag.replace(/[<>]/g, ''));
    if (isNaN(cleanNum)) return 'bg-cyan-100 text-cyan-800 border-cyan-300';

    if (cleanNum <= 4.5) {
      return 'bg-violet-100 text-violet-800 border-violet-300'; // 4s - 4.5s: Nhịp nhanh / Dẫn chứng
    }
    if (cleanNum <= 6.5) {
      return 'bg-cyan-100 text-cyan-800 border-cyan-300'; // 5s - 6.5s: Tiêu chuẩn sa bàn
    }
    if (cleanNum <= 8.0) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300'; // 7s - 8s: Chi tiết kiến trúc / Infographic
    }
    return 'bg-amber-100 text-amber-900 border-amber-300'; // 8.5s - 9s: Bóc tách sâu / Mặt cắt đa tầng
  };

  if (isCompact && !isExpanded) {
    // Ultra-Compact Row View
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        className="group bg-white hover:bg-slate-50/80 rounded-lg border border-slate-200 hover:border-cyan-300 p-2.5 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Index & Time & Tag */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              #{index + 1}
            </span>
            {durationTag && (
              <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded border shadow-2xs ${getDurationTagStyle(durationTag)}`}>
                {durationTag}
              </span>
            )}
            <span className="text-xs font-mono font-bold text-slate-800 shrink-0">
              {segment.timeRange}
            </span>
            {(segment.jsonContent?.part || segment.part) && (
              <span className="text-[9px] bg-cyan-50 text-cyan-800 px-1.5 py-0.2 rounded font-bold border border-cyan-200">
                P{segment.jsonContent?.part || segment.part}
              </span>
            )}
          </div>

          {/* Reference Image Tag */}
          {referenceImage && referenceImage !== 'null' && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold border border-indigo-200 shrink-0 flex items-center gap-1">
              <ImageIcon size={10} />
              <span>{referenceImage.startsWith('@') ? referenceImage : `@${referenceImage}`}</span>
            </span>
          )}

          {/* Action / Context Summary */}
          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {segment.jsonContent?.story_action || segment.jsonContent?.background || "Phân cảnh 3D"}
            </span>
            {segment.jsonContent?.voiceover_context && (
              <span className="hidden md:inline text-[11px] text-slate-400 italic truncate">
                — "{segment.jsonContent.voiceover_context}"
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {segment.jsonContent?.motion && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 max-w-[200px] truncate">
              <Video size={10} className="shrink-0" />
              <span className="truncate">{segment.jsonContent.motion}</span>
            </span>
          )}

          <button
            onClick={handleCopy}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0"
            title="Chép JSON prompt"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-600" />
                <span className="text-emerald-600">Đã chép</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Chép</span>
              </>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            title="Mở rộng chi tiết"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Standard Detailed View (with collapse button)
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden transition-all hover:border-slate-300 hover:shadow-xs">
      <div 
        onClick={() => isCompact && setIsExpanded(false)}
        className="border-b border-slate-100 px-3.5 py-1.5 flex justify-between items-center bg-slate-50/90 select-none cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            #{index + 1}
          </span>
          {durationTag && (
            <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border shadow-2xs ${getDurationTagStyle(durationTag)}`}>
              {durationTag}
            </span>
          )}
          <span className="text-xs font-mono font-bold text-slate-800">
            {segment.timeRange}
          </span>
          {(segment.jsonContent?.part || segment.part) && (
            <span className="text-[9px] bg-cyan-50 text-cyan-800 px-1.5 py-0.2 rounded font-bold border border-cyan-200">
              Part {segment.jsonContent?.part || segment.part}
            </span>
          )}
          {referenceImage && referenceImage !== 'null' && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-bold border border-indigo-200 flex items-center gap-1">
              <ImageIcon size={10} />
              <span>{referenceImage.startsWith('@') ? referenceImage : `@${referenceImage}`}</span>
            </span>
          )}
          {segment.jsonContent?.style && (
            <span className="hidden sm:inline-block text-[10px] text-slate-500 font-medium truncate max-w-[260px]">
              • {segment.jsonContent.style}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-600" />
                <span className="text-emerald-600 font-bold">Đã chép</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Chép JSON</span>
              </>
            )}
          </button>

          {isCompact && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
              title="Thu gọn phân cảnh này"
            >
              <ChevronUp size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        {hasError ? (
          <div className="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">
            Định dạng JSON 3D không hợp lệ:
            <pre className="mt-1 text-[10px] whitespace-pre-wrap font-mono">{segment.rawJson}</pre>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* Story Action / 3D Focal Event */}
            <div>
              <p className="text-xs sm:text-sm text-slate-900 leading-snug font-semibold">
                {segment.jsonContent.story_action}
              </p>
            </div>

            {/* Subtitle Voiceover Context */}
            {segment.jsonContent.voiceover_context && (
              <div className="text-[11px] text-slate-500 italic leading-relaxed border-l-2 border-cyan-400 pl-2 bg-slate-50/50 py-0.5 rounded-r">
                "{segment.jsonContent.voiceover_context}"
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-slate-400 mr-1.5 uppercase tracking-tight font-bold text-[10px]">Bối cảnh 3D:</span>
                <span className="text-slate-700 leading-relaxed">{segment.jsonContent.background}</span>
              </div>
              
              {segment.jsonContent.composition && (
                <div>
                  <span className="text-slate-400 mr-1.5 uppercase tracking-tight font-bold text-[10px]">Góc máy:</span>
                  <span className="text-slate-700 leading-relaxed">{segment.jsonContent.composition}</span>
                </div>
              )}

              {(segment.jsonContent.characters_present || segment.jsonContent.character) && (
                <div>
                  <span className="text-slate-400 mr-1.5 uppercase tracking-tight font-bold text-[10px]">Thực thể:</span>
                  <span className="text-slate-700 leading-relaxed">{segment.jsonContent.characters_present || segment.jsonContent.character}</span>
                </div>
              )}

              {segment.jsonContent.elements && (
                <div>
                  <span className="text-slate-400 mr-1.5 uppercase tracking-tight font-bold text-[10px]">Chi tiết & Mô hình:</span>
                  <span className="text-slate-700 leading-relaxed">{segment.jsonContent.elements}</span>
                </div>
              )}

              {/* 3D Motion */}
              {segment.jsonContent.motion && (
                <div className="sm:col-span-2 bg-cyan-50/40 p-2 rounded border border-cyan-100 text-xs">
                  <div className="flex items-center gap-1.5 text-cyan-800 font-bold text-[10px] uppercase tracking-wider mb-0.5">
                    <Video size={11} />
                    <span>Chuyển động Camera 3D & HUD (Motion):</span>
                  </div>
                  <p className="text-slate-800 font-medium leading-relaxed">{segment.jsonContent.motion}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultCard;
