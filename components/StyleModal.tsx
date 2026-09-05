import React, { useState, useEffect } from 'react';
import { X, Sparkles, Wand2, Palette, Check } from 'lucide-react';
import { VisualStyle } from '../services/styleRegistry';

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (style: { label: string; desc: string; systemPromptGuidelines: string }) => void;
  initialData?: VisualStyle | null;
}

const TEMPLATE_SUGGESTIONS = [
  {
    name: "Điện ảnh 8K (Cinematic Realism)",
    label: "Điện ảnh chân thực (Cinematic Realism)",
    desc: "Hình ảnh điện ảnh chân thực, ánh sáng studio sâu, góc quay máy quay phim Arri Alexa 8K",
    guidelines: `•   **Primary Visual Aesthetic:** High-end Cinematic Photorealism, Arri Alexa 65mm anamorphic lens, shallow depth of field.
•   **Atmosphere & Lighting:** Volumetric atmospheric rim lighting, realistic global illumination, natural materials and rich textures.
•   **Visual Angle:** Dynamic cinematic compositions, wide establishing shots alternating with close documentary details matching the voiceover context.`
  },
  {
    name: "Anime 2D Makoto Shinkai",
    label: "Anime 2D Phong cách Makoto Shinkai",
    desc: "Đồ họa anime 2D sắc nét, bầu trời hoàng hôn rực rỡ, ánh sáng lung linh và chi tiết tỉ mỉ",
    guidelines: `•   **Primary Visual Aesthetic:** High-detail 2D Anime aesthetic inspired by Makoto Shinkai and Studio CoMix Wave Films.
•   **Atmosphere & Color:** Vibrant sky gradients, dramatic cloud formations, golden hour lens flares, sparkling light refractions, and deep saturated color palettes.
•   **Visual Angle:** Cinematic anime background framing, sweeping perspectives highlighting architectural landmarks and atmospheric weather phenomena matching the voiceover context.`
  },
  {
    name: "Cyberpunk Neon & HUD",
    label: "Cyberpunk Neon & Tech HUD",
    desc: "Đô thị tương lai viễn tưởng, đèn neon phát sáng, đường nét dữ liệu công nghệ cao",
    guidelines: `•   **Primary Visual Aesthetic:** Futuristic Cyberpunk, dark metallic surfaces, glowing cyan, magenta and amber neon lighting.
•   **Data HUD & Hologram:** Floating holographic interface elements, glowing data vectors, volumetric fog and wet pavement reflections.
•   **Visual Angle:** High-tech aerial cityscapes and dense futuristic infrastructure directly illustrating the spoken concepts.`
  },
  {
    name: "2D Flat Motion Graphic",
    label: "Đồ họa chuyển động 2D (Motion Graphic)",
    desc: "Đồ họa infographic 2D hiện đại, màu sắc tương phản cao, hình khối hình học chuẩn xác",
    guidelines: `•   **Primary Visual Aesthetic:** Clean contemporary 2D Motion Graphics & Editorial Infographic aesthetic.
•   **Color & Geometry:** Bold corporate color blocking, sterile geometry, vector clarity, elegant negative space, minimal shadows.
•   **Visual Angle:** Flat orthogonal layouts, isometric infographic diagrams, clean typography labels illustrating statistics and concepts directly from the subtitles.`
  }
];

export const StyleModal: React.FC<StyleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '');
      setDesc(initialData.desc || '');
      setGuidelines(initialData.systemPromptGuidelines || '');
    } else {
      setLabel('');
      setDesc('');
      setGuidelines('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Vui lòng nhập tên phong cách.');
      return;
    }
    if (!desc.trim()) {
      setError('Vui lòng nhập mô tả ngắn cho phong cách.');
      return;
    }

    onSave({
      label: label.trim(),
      desc: desc.trim(),
      systemPromptGuidelines: guidelines.trim()
    });
    onClose();
  };

  const applyTemplate = (tpl: typeof TEMPLATE_SUGGESTIONS[0]) => {
    setLabel(tpl.label);
    setDesc(tpl.desc);
    setGuidelines(tpl.guidelines);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shadow-xs">
              <Palette size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {initialData ? 'Chỉnh sửa phong cách hình ảnh' : 'Thêm phong cách mới'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Tạo phong cách hình ảnh tùy chỉnh để định hướng AI tạo storyboard theo ý bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Quick Preset Templates */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Gợi ý mẫu phong cách nhanh (Click để điền mẫu):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_SUGGESTIONS.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 border border-slate-200 text-slate-700 rounded-full transition-all cursor-pointer font-medium"
                >
                  <Wand2 size={11} className="text-cyan-600" />
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên phong cách <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ví dụ: Anime 2D Điện ảnh, Chân thực 8K, Tranh vẽ Concept Art..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              required
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mô tả ngắn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Ví dụ: Đồ họa anime 2D sắc nét với bầu trời hoàng hôn lung linh..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Mô tả hiển thị trên thẻ chọn phong cách ở màn hình chính
            </span>
          </div>

          {/* Prompt Guidelines */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Chỉ dẫn phong cách cho AI (System Prompt Guidelines)
              </label>
              <span className="text-[10px] text-cyan-600 font-semibold">Tùy chọn nâng cao</span>
            </div>
            <textarea
              rows={6}
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder={`•   **Primary Visual Aesthetic:** Quy chuẩn phong cách đồ họa, góc máy, ánh sáng...
•   **Atmosphere & Color:** Màu sắc chủ đạo, chất liệu bề mặt, độ tương phản...
•   **Composition:** Quy tắc bố cục khung hình theo từng câu thoại...`}
              className="w-full p-3 font-mono text-[11px] leading-relaxed border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none bg-slate-50/50"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Đoạn văn này sẽ được nạp trực tiếp vào câu lệnh Gemini để yêu cầu AI tạo prompt ảnh theo chuẩn phong cách này.
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Check size={14} />
              <span>{initialData ? 'Lưu cập nhật' : 'Tạo phong cách'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
