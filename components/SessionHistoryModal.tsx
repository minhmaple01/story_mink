import React, { useState } from 'react';
import { 
  History, 
  X, 
  Trash2, 
  RotateCcw, 
  FileSpreadsheet, 
  Clock, 
  CheckCircle2, 
  Layers, 
  Image as ImageIcon, 
  Search, 
  Calendar,
  Sparkles,
  ArrowRight,
  Download
} from 'lucide-react';
import { SavedSession, deleteSavedSession, clearAllSavedSessions } from '../services/sessionService';
import * as XLSX from 'xlsx';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SavedSession[];
  onRestoreSession: (session: SavedSession) => void;
  onUpdateSessions: (sessions: SavedSession[]) => void;
}

const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onRestoreSession,
  onUpdateSessions
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Bạn có chắc chắn muốn xóa phiên chạy này khỏi lịch sử?")) {
      const updated = deleteSavedSession(id);
      onUpdateSessions(updated);
      if (selectedId === id) setSelectedId(null);
    }
  };

  const handleClearAll = () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên chạy?")) {
      clearAllSavedSessions();
      onUpdateSessions([]);
      setSelectedId(null);
    }
  };

  const handleExportSessionExcel = (session: SavedSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const allSegs = session.fileChunks.flatMap(c => c.results || []);
    if (allSegs.length === 0) {
      alert("Phiên này chưa có phân cảnh nào được tạo.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const sorted = [...allSegs].sort((a, b) => a.timeRange.localeCompare(b.timeRange));

    const data = sorted.map((s, index) => {
      const exportContent = { ...s.jsonContent };
      const voContext = exportContent.voiceover_context || "";
      const refImgTag = exportContent.reference_image || exportContent.reference || "";
      const motionText = exportContent.motion || "";
      
      delete exportContent.voiceover_context;
      delete exportContent.motion;
      delete exportContent.part;

      const row: Record<string, any> = {
        "STT": index + 1,
        "Thời gian": s.timeRange,
        "Part": s.part || 1,
      };

      if (refImgTag) {
        row["Ảnh tham chiếu (@name)"] = refImgTag.startsWith('@') ? refImgTag : `@${refImgTag}`;
      }

      row["Lời thoại (Voiceover)"] = voContext;
      row["Chuyển động 3D (Motion)"] = motionText;
      row["Nội dung Prompt 3D"] = JSON.stringify(exportContent);

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 8 },
      { wch: 22 },
      { wch: 45 },
      { wch: 55 },
      { wch: 110 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Tu_Lieu_3D_Storyboard");

    if (session.referenceImages && session.referenceImages.length > 0) {
      const refData = session.referenceImages.map((item, idx) => ({
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

    XLSX.writeFile(wb, `${session.name.replace(/\s+/g, '_')}_Saved.xlsx`);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Lịch Sử Các Phiên Chạy</span>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                  {sessions.length} phiên
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Tự động lưu trữ tiến trình làm việc, khôi phục hoặc nạp lại để tiếp tục chạy bất cứ lúc nào.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors flex items-center gap-1 font-medium"
                title="Xóa toàn bộ lịch sử"
              >
                <Trash2 size={13} />
                <span>Xóa tất cả</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phiên theo tên tệp hoặc kịch bản..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Chưa có phiên chạy nào được lưu</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Khi bạn chạy Storyboard hoặc xuất Excel, phiên làm việc sẽ được tự động lưu vào đây để bạn dễ dàng mở lại.
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedId === session.id;
              const hasRefImages = session.referenceImages && session.referenceImages.length > 0;
              const completionPercent = session.totalChunks > 0 
                ? Math.round((session.completedChunks / session.totalChunks) * 100) 
                : 0;

              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedId(session.id)}
                  className={`bg-white rounded-xl border p-4 transition-all hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${
                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {session.name}
                      </h3>
                      {completionPercent === 100 ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          <span>Hoàn thành 100%</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          Đã chạy {session.completedChunks}/{session.totalChunks} đoạn ({completionPercent}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        <span>{formatDate(session.updatedAt)}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Sparkles size={12} className="text-indigo-500" />
                        <strong className="text-slate-700">{session.totalPrompts}</strong> phân cảnh prompt
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <ImageIcon size={12} className="text-cyan-600" />
                        <strong className="text-slate-700">{session.referenceImagesCount}</strong> ảnh tham chiếu
                      </span>
                    </div>

                    {session.fileName && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        Tệp gốc: {session.fileName}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                    <button
                      onClick={(e) => handleExportSessionExcel(session, e)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
                      title="Xuất trực tiếp tệp Excel của phiên này"
                    >
                      <Download size={13} />
                      <span>Xuất Excel</span>
                    </button>

                    <button
                      onClick={() => {
                        onRestoreSession(session);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <RotateCcw size={13} />
                      <span>Nạp lại & Tiếp tục</span>
                    </button>

                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa phiên"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Lưu tối đa 30 phiên gần nhất trên trình duyệt.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionHistoryModal;
