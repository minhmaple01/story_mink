import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Sparkles, 
  Loader2, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  Info,
  X,
  Search,
  LayoutList,
  LayoutGrid,
  Compass,
  Sun
} from 'lucide-react';
import { ReferenceImageItem, formatReferenceImagePrompt } from '../services/geminiService';

interface ReferenceImagesManagerProps {
  referenceImages: ReferenceImageItem[];
  onUpdateReferenceImages: (items: ReferenceImageItem[]) => void;
  onAnalyzeReferenceImages: () => Promise<void>;
  isAnalyzing: boolean;
  hasSubtitles: boolean;
}

const CATEGORIES = [
  'Tất cả',
  'Cầu đường / Giao thông',
  'Kiến trúc / Landmark',
  'Cảng biển / KCN',
  'Năng lượng / Hạ tầng',
  'Đô thị / Địa lý',
  'Địa hình / Thủy văn',
  'Thiết bị / Phương tiện'
];

const PERSPECTIVE_PRESETS = [
  { label: '🚁 Flycam 45° bao quát', value: 'high-angle 45-degree diagonal drone view, panoramic architectural overview' },
  { label: '🛰️ Toàn cảnh từ đỉnh (Top-down)', value: 'direct top-down orthographic satellite/aerial planning view' },
  { label: '🌅 Quét chéo chân trời (Panoramic)', value: 'sweeping wide-angle horizon panoramic view, expansive scale' },
  { label: '📐 Trục đối xứng (Axial)', value: 'symmetrical axial high-angle aerial perspective' }
];

const LIGHTING_PRESETS = [
  { label: '☀️ Ban ngày trong trẻo', value: 'crisp, clear midday daylight with high architectural contrast and sharp geometry definition' },
  { label: '🌇 Hoàng hôn vàng rực', value: 'dramatic golden hour sunset with warm orange and amber reflections across water surfaces' },
  { label: '🏙️ Chạng vạng lên đèn', value: 'twilight blue hour with illuminated architectural accent lights, highway headlights, and city glow' },
  { label: '🌫️ Bình minh sương nhẹ', value: 'early morning dawn with atmospheric low mist and soft warm sunlight' }
];

const getCategoryBadgeStyle = (cat?: string) => {
  switch (cat) {
    case 'Cầu đường / Giao thông':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Kiến trúc / Landmark':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Cảng biển / KCN':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Năng lượng / Hạ tầng':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Đô thị / Địa lý':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Địa hình / Thủy văn':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Thiết bị / Phương tiện':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const ReferenceImagesManager: React.FC<ReferenceImagesManagerProps> = ({
  referenceImages,
  onUpdateReferenceImages,
  onAnalyzeReferenceImages,
  isAnalyzing,
  hasSubtitles
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'compact' | 'cards'>('compact');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [showInfoTip, setShowInfoTip] = useState<boolean>(false);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ReferenceImageItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Form State for Add / Edit
  const [formState, setFormState] = useState<{
    name: string;
    subject: string;
    category: string;
    context1: string;
    imageType: string;
    structureDetails: string;
    perspective: string;
    context2: string;
    lighting: string;
  }>({
    name: '',
    subject: '',
    category: 'Cầu đường / Giao thông',
    context1: '',
    imageType: 'Ảnh chụp trên cao từ drone/flycam, góc rộng toàn cảnh (wide-angle aerial drone photography), độ phân giải cao',
    structureDetails: '',
    perspective: 'high-angle wide aerial view, panoramic overview of full structure and surrounding terrain',
    context2: '',
    lighting: 'natural, clear daylight to accurately define all authentic structures'
  });

  const toggleItemExpanded = (id: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyPrompt = (id: string, promptText: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(promptText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyTag = (id: string, tagName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(`@${tagName}`);
    setCopiedId(`tag_${id}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = () => {
    if (referenceImages.length === 0) return;
    const allText = referenceImages
      .map((item, idx) => `[#${idx + 1} - @${item.name} (${item.subject}) | ${item.category || 'Địa danh'}]\n${item.fullPrompt}`)
      .join('\n\n');
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdateReferenceImages(referenceImages.filter(item => item.id !== id));
  };

  const handleOpenEdit = (item: ReferenceImageItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingItem(item);
    setFormState({
      name: item.name,
      subject: item.subject,
      category: item.category || 'Cầu đường / Giao thông',
      context1: item.context1 || '',
      imageType: item.imageType || 'Ảnh chụp trên cao từ drone/flycam, góc rộng toàn cảnh (wide-angle aerial drone photography), độ phân giải cao',
      structureDetails: item.structureDetails || '',
      perspective: item.perspective || 'high-angle wide aerial view, panoramic overview of full structure and surrounding terrain',
      context2: item.context2 || '',
      lighting: item.lighting || 'natural, clear daylight to accurately define all authentic structures'
    });
  };

  const handleOpenAdd = () => {
    setIsAddingNew(true);
    setFormState({
      name: '',
      subject: '',
      category: 'Cầu đường / Giao thông',
      context1: '',
      imageType: 'Ảnh chụp trên cao từ drone/flycam, góc rộng toàn cảnh (wide-angle aerial drone photography), độ phân giải cao',
      structureDetails: '',
      perspective: 'high-angle wide aerial view, panoramic overview of full structure and surrounding terrain',
      context2: '',
      lighting: 'natural, clear daylight to accurately define all authentic structures'
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formState.name.trim().replace(/^@+/, '').replace(/\s+/g, '_').toLowerCase();
    if (!cleanName || !formState.subject.trim()) {
      alert("Vui lòng điền tên định danh (@name) và chủ thể chính.");
      return;
    }

    const generatedPrompt = formatReferenceImagePrompt({
      imageType: formState.imageType,
      subject: formState.subject,
      context1: formState.context1,
      structureDetails: formState.structureDetails,
      perspective: formState.perspective,
      context2: formState.context2,
      lighting: formState.lighting
    });

    if (isAddingNew) {
      const newItem: ReferenceImageItem = {
        id: `ref_${Date.now()}`,
        name: cleanName,
        subject: formState.subject,
        category: formState.category,
        context1: formState.context1,
        imageType: formState.imageType,
        structureDetails: formState.structureDetails,
        perspective: formState.perspective,
        context2: formState.context2,
        lighting: formState.lighting,
        fullPrompt: generatedPrompt
      };
      onUpdateReferenceImages([...referenceImages, newItem]);
      setIsAddingNew(false);
    } else if (editingItem) {
      const updated = referenceImages.map(item => 
        item.id === editingItem.id ? {
          ...item,
          name: cleanName,
          subject: formState.subject,
          category: formState.category,
          context1: formState.context1,
          imageType: formState.imageType,
          structureDetails: formState.structureDetails,
          perspective: formState.perspective,
          context2: formState.context2,
          lighting: formState.lighting,
          fullPrompt: generatedPrompt
        } : item
      );
      onUpdateReferenceImages(updated);
      setEditingItem(null);
    }
  };

  const handleExportExcel = () => {
    if (referenceImages.length === 0) return;

    const wb = XLSX.utils.book_new();
    const data = referenceImages.map((item, idx) => ({
      "STT": idx + 1,
      "Tên định danh (@name)": `@${item.name}`,
      "Chủ thể chính": item.subject,
      "Danh mục": item.category || "Địa danh",
      "Bối cảnh 1 (Vị trí)": item.context1,
      "Bối cảnh 2 (Không gian mở rộng)": item.context2,
      "Loại ảnh": item.imageType,
      "Chi tiết cấu trúc": item.structureDetails,
      "Góc máy": item.perspective,
      "Ánh sáng": item.lighting,
      "Prompt Ảnh Tham Chiếu Chuẩn": item.fullPrompt
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 30 },
      { wch: 24 },
      { wch: 25 },
      { wch: 35 },
      { wch: 35 },
      { wch: 45 },
      { wch: 30 },
      { wch: 40 },
      { wch: 110 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Anh_Tham_Chieu");
    XLSX.writeFile(wb, `Danh_Sach_Anh_Tham_Chieu_3D.xlsx`);
  };

  // Filtered list based on search query and category
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return referenceImages.filter(item => {
      const matchCat = selectedCategory === 'Tất cả' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.context1 && item.context1.toLowerCase().includes(query)) ||
        (item.context2 && item.context2.toLowerCase().includes(query)) ||
        item.fullPrompt.toLowerCase().includes(query)
      );
    });
  }, [referenceImages, searchQuery, selectedCategory]);

  // Unique categories existing in data
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Tất cả': referenceImages.length };
    referenceImages.forEach(item => {
      const cat = item.category || 'Cầu đường / Giao thông';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [referenceImages]);

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-2xs overflow-hidden mb-5 transition-all">
      {/* Header Bar - Compact & Clear */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white border-b border-indigo-100/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
            <ImageIcon size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Prompt Ảnh Tham Chiếu Đa Dạng
              </h2>
              {referenceImages.length > 0 && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-full border border-indigo-200">
                  {referenceImages.length} prompt
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Đa dạng hóa danh mục hạ tầng, góc máy flycam toàn cảnh & ánh sáng chân thực, liên kết bằng <code className="text-indigo-600 font-mono font-bold bg-indigo-50 px-1 py-0.2 rounded">@name</code>.
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={onAnalyzeReferenceImages}
            disabled={!hasSubtitles || isAnalyzing}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors active:scale-95"
            title="Tự động quét toàn bộ phụ đề để sinh danh sách câu lệnh prompt ảnh tham chiếu đa dạng"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Đang phân tích...</span>
              </>
            ) : (
              <>
                <Sparkles size={12} />
                <span>Tạo Prompt Tham Chiếu</span>
              </>
            )}
          </button>

          {referenceImages.length > 0 && (
            <>
              {/* View Mode Toggle: Compact vs Cards */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-md border border-slate-300/80 text-[11px]">
                <button
                  onClick={() => setViewMode('compact')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all ${
                    viewMode === 'compact'
                      ? 'bg-white text-indigo-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Chế độ danh sách thu gọn"
                >
                  <LayoutList size={11} />
                  <span className="hidden md:inline">Thu gọn</span>
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all ${
                    viewMode === 'cards'
                      ? 'bg-white text-indigo-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Chế độ xem dạng thẻ chi tiết"
                >
                  <LayoutGrid size={11} />
                  <span className="hidden md:inline">Dạng thẻ</span>
                </button>
              </div>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 shadow-2xs transition-colors"
                title="Thêm prompt ảnh tham chiếu thủ công"
              >
                <Plus size={12} />
                <span className="hidden sm:inline">Thêm</span>
              </button>

              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 shadow-2xs transition-colors"
                title="Chép toàn bộ danh sách prompt ảnh tham chiếu"
              >
                {copiedAll ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Đã chép tất cả</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Chép tất cả</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-md border border-emerald-200 shadow-2xs transition-colors"
                title="Xuất bảng Excel danh sách prompt ảnh tham chiếu"
              >
                <FileSpreadsheet size={12} />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title={isExpanded ? "Thu gọn danh sách" : "Mở rộng danh sách"}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-3">
          {referenceImages.length === 0 ? (
            <div className="text-center py-5 px-4 bg-slate-50/70 rounded-lg border border-dashed border-slate-200">
              <ImageIcon className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">Chưa có Prompt ảnh tham chiếu nào</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
                Bấm nút <strong className="text-indigo-600">"Tạo Prompt Tham Chiếu"</strong> để AI tự động trích xuất các địa danh, công trình, cảng biển, năng lượng... với đa dạng góc máy toàn cảnh và ánh sáng chân thực.
              </p>
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <button
                  onClick={onAnalyzeReferenceImages}
                  disabled={!hasSubtitles || isAnalyzing}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
                >
                  <Sparkles size={12} />
                  <span>Phân tích tự động</span>
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 shadow-2xs transition-colors"
                >
                  <Plus size={12} />
                  <span>Thêm thủ công</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Category Filter Tabs & Search Bar */}
              <div className="space-y-2">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                  {CATEGORIES.map(cat => {
                    const count = categoryCounts[cat] || 0;
                    if (cat !== 'Tất cả' && count === 0) return null;
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all flex items-center gap-1 shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[9px] px-1 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search input */}
                {referenceImages.length > 2 && (
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Lọc nhanh danh sách theo @name, địa danh hoặc chủ thể..."
                      className="w-full pl-7 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* View Mode: Compact Table Rows (Default) */}
              {viewMode === 'compact' ? (
                <div className="space-y-1.5">
                  {filteredItems.map((item, index) => {
                    const isCopied = copiedId === item.id;
                    const isTagCopied = copiedId === `tag_${item.id}`;
                    const isRowExpanded = expandedItemIds.has(item.id);

                    return (
                      <div 
                        key={item.id}
                        className="bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition-all overflow-hidden shadow-2xs"
                      >
                        {/* Compact Row Header */}
                        <div 
                          onClick={() => toggleItemExpanded(item.id)}
                          className="p-2 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 select-none"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                            {/* STT */}
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                              #{index + 1}
                            </span>

                            {/* Tag @name */}
                            <button
                              onClick={(e) => handleCopyTag(item.id, item.name, e)}
                              className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0"
                              title="Bấm để sao chép mã @name"
                            >
                              <span>@{item.name}</span>
                              {isTagCopied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                            </button>

                            {/* Category Badge */}
                            {item.category && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${getCategoryBadgeStyle(item.category)}`}>
                                {item.category}
                              </span>
                            )}

                            {/* Subject Title */}
                            <span className="text-xs font-bold text-slate-800 shrink-0">
                              {item.subject}
                            </span>

                            {/* Context / Prompt Snippet */}
                            <span className="text-[11px] text-slate-400 truncate hidden sm:inline flex-1">
                              — {item.context1 ? `${item.context1} • ` : ''}{item.fullPrompt}
                            </span>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => handleCopyPrompt(item.id, item.fullPrompt, e)}
                              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0"
                              title="Chép toàn bộ prompt tham chiếu này"
                            >
                              {isCopied ? (
                                <>
                                  <Check size={11} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Chép Prompt</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={(e) => handleOpenEdit(item, e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(item.id, e)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Xóa"
                            >
                              <Trash2 size={12} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemExpanded(item.id);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              title={isRowExpanded ? "Thu gọn" : "Xem chi tiết"}
                            >
                              {isRowExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details when toggled */}
                        {isRowExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                              {(item.context1 || item.context2) && (
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-slate-400">Bối cảnh:</span>
                                  <span>{[item.context1, item.context2].filter(Boolean).join(' • ')}</span>
                                </div>
                              )}
                              {item.perspective && (
                                <div className="flex items-center gap-1 text-indigo-700">
                                  <Compass size={11} />
                                  <span className="truncate">{item.perspective}</span>
                                </div>
                              )}
                              {item.lighting && (
                                <div className="flex items-center gap-1 text-amber-700">
                                  <Sun size={11} />
                                  <span className="truncate">{item.lighting}</span>
                                </div>
                              )}
                            </div>

                            {/* Full Prompt Box */}
                            <div className="bg-white border border-slate-200 rounded-md p-2 text-[11px] text-slate-800 font-mono leading-relaxed select-all">
                              {item.fullPrompt}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* View Mode: Cards Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredItems.map((item, index) => {
                    const isCopied = copiedId === item.id;
                    const isTagCopied = copiedId === `tag_${item.id}`;

                    return (
                      <div 
                        key={item.id}
                        className="bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition-all p-2.5 shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          {/* Top Meta */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                #{index + 1}
                              </span>
                              <button
                                onClick={() => handleCopyTag(item.id, item.name)}
                                className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                title="Bấm để chép mã @name"
                              >
                                <span>@{item.name}</span>
                                {isTagCopied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                              </button>
                              {item.category && (
                                <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${getCategoryBadgeStyle(item.category)}`}>
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Subject Title */}
                          <h4 className="text-xs font-bold text-slate-900 mb-1">
                            {item.subject}
                          </h4>

                          {/* Prompt Box */}
                          <div className="bg-slate-50 border border-slate-200/80 rounded p-1.5 text-[10px] text-slate-700 font-mono leading-relaxed mb-2 select-all max-h-24 overflow-y-auto">
                            {item.fullPrompt}
                          </div>
                        </div>

                        {/* Bottom Button */}
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-end">
                          <button
                            onClick={() => handleCopyPrompt(item.id, item.fullPrompt)}
                            className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                          >
                            {isCopied ? (
                              <>
                                <Check size={11} className="text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Đã chép Prompt</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Chép Prompt</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Minimal Collapsible Guide / Rule Tip */}
              <div className="pt-1">
                <button
                  onClick={() => setShowInfoTip(!showInfoTip)}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                >
                  <Info size={11} />
                  <span>{showInfoTip ? "Ẩn quy tắc prompt ảnh tham chiếu" : "Xem quy tắc đa dạng hóa & liên kết prompt ảnh tham chiếu"}</span>
                  {showInfoTip ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>

                {showInfoTip && (
                  <div className="mt-1.5 p-2 bg-indigo-50/60 rounded border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                    <p className="font-semibold text-[11px]">Quy tắc câu lệnh (Prompt Text) chuẩn:</p>
                    <ul className="text-[10px] text-indigo-700/90 list-disc list-inside space-y-0.5 leading-relaxed">
                      <li>Hệ thống sinh văn bản prompt chuẩn cấu trúc để bạn copy sang Midjourney/Flux/SD, không render ảnh bitmap trực tiếp.</li>
                      <li><strong>Hạn chế ảnh cận cảnh:</strong> Luôn ưu tiên góc chụp flycam/drone trên cao, toàn cảnh bao quát để giữ trọn vẹn quy mô và bối cảnh chân thực, tránh sai lệch kiến trúc.</li>
                      <li><strong>Đa dạng danh mục:</strong> Hỗ trợ đa dạng từ cầu đường, tòa nhà chọc trời, cảng biển nước sâu, cụm KCN, trang trại điện gió/mặt trời, đại đô thị đến địa hình sông ngòi.</li>
                      <li>AI tự động trích xuất toàn bộ địa danh/công trình trong kịch bản và gắn mã <code className="bg-white px-1 py-0.2 rounded font-mono font-bold">@name</code> vào phân cảnh tương ứng.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit / Add Modal */}
      {(isAddingNew || editingItem) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  {isAddingNew ? "Thêm Prompt ảnh tham chiếu mới" : `Chỉnh sửa: @${formState.name}`}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setEditingItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Tên định danh (@name): <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 font-mono text-slate-400 font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={e => setFormState(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="cau_nhat_tan"
                      className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 font-mono font-semibold text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Viết liền không dấu</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Chủ thể chính: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.subject}
                    onChange={e => setFormState(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Cầu Nhật Tân, Hà Nội"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 font-medium text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Danh mục:
                  </label>
                  <select
                    value={formState.category}
                    onChange={e => setFormState(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 text-xs bg-white"
                  >
                    {CATEGORIES.filter(c => c !== 'Tất cả').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Bối cảnh 1 (vị trí trực tiếp):
                  </label>
                  <input
                    type="text"
                    value={formState.context1}
                    onChange={e => setFormState(prev => ({ ...prev, context1: e.target.value }))}
                    placeholder="Sông Hồng"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Bối cảnh 2 (không gian xung quanh):
                  </label>
                  <input
                    type="text"
                    value={formState.context2}
                    onChange={e => setFormState(prev => ({ ...prev, context2: e.target.value }))}
                    placeholder="expansive Hanoi city skyline, West Lake"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Chi tiết cấu trúc & Tỉ lệ kích thước:
                </label>
                <textarea
                  rows={2}
                  value={formState.structureDetails}
                  onChange={e => setFormState(prev => ({ ...prev, structureDetails: e.target.value }))}
                  placeholder="entire length, five distinctive A-shaped cable-stayed towers, multi-lane roadway structure"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Perspective with Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                    <Compass size={12} className="text-indigo-600" />
                    <span>Góc máy (Perspective):</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Chọn nhanh mẫu bên dưới</span>
                </div>
                <input
                  type="text"
                  value={formState.perspective}
                  onChange={e => setFormState(prev => ({ ...prev, perspective: e.target.value }))}
                  placeholder="high-angle wide aerial view, panoramic overview of full structure"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 text-xs mb-1.5"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PERSPECTIVE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, perspective: preset.value }))}
                      className="text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded px-2 py-0.5 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lighting with Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                    <Sun size={12} className="text-amber-500" />
                    <span>Ánh sáng (Lighting):</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Chọn nhanh mẫu ánh sáng</span>
                </div>
                <input
                  type="text"
                  value={formState.lighting}
                  onChange={e => setFormState(prev => ({ ...prev, lighting: e.target.value }))}
                  placeholder="natural, clear daylight/golden hour"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 text-xs mb-1.5"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {LIGHTING_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, lighting: preset.value }))}
                      className="text-[10px] bg-slate-100 hover:bg-amber-50 hover:text-amber-700 border border-slate-200 rounded px-2 py-0.5 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="block font-bold text-[10px] text-slate-500 uppercase tracking-tight mb-1">
                  Xem trước Prompt chuẩn:
                </span>
                <p className="font-mono text-[10px] text-slate-800 leading-relaxed">
                  {formatReferenceImagePrompt({
                    imageType: formState.imageType,
                    subject: formState.subject || '...',
                    context1: formState.context1 || '...',
                    structureDetails: formState.structureDetails || '...',
                    perspective: formState.perspective || '...',
                    context2: formState.context2 || '...',
                    lighting: formState.lighting || '...'
                  })}
                </p>
              </div>

              {/* Modal Footer */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingItem(null);
                  }}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors"
                >
                  {isAddingNew ? "Thêm Prompt" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceImagesManager;
