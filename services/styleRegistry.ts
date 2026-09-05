export interface VisualStyle {
  id: string;
  label: string;
  desc: string;
  isDefault?: boolean;
  isCustom?: boolean;
  systemPromptGuidelines?: string;
  createdAt?: number;
}

export const INITIAL_STYLES: VisualStyle[] = [
  {
    id: 'auto_dynamic',
    label: 'Tự động linh hoạt',
    desc: 'Tự động luân chuyển Sa bàn 3D, Mặt cắt kiến trúc, Bản đồ không gian & Hologram HUD theo bối cảnh câu thoại',
    isDefault: true,
    systemPromptGuidelines: `•   **Dynamic Visual Alternation (Tự động luân chuyển góc nhìn 3D phù hợp nhất theo từng câu thoại):**
    1. **3D Isometric Diorama (Sa bàn 3D góc 45°):** Khối kiến trúc thu nhỏ trên bệ nổi, ống kính tilt-shift, hình khối low-poly sạch sẽ, ánh sáng studio. Phù hợp nhất cho các công trình, địa điểm, dự án hoặc hành động cụ thể.
    2. **3D Architectural/Geological Cross-Section (Mặt cắt phân tầng cutaway):** Bóc tách đa tầng kiến trúc và địa chất ngầm (móng cọc, địa tầng đất, hầm ngầm, đường ống kỹ thuật, tuyến metro). Phù hợp giải thích nguyên lý, cơ chế ngầm hoặc phân tích nội bộ.
    3. **Top-Down 3D Map Visualization (Bản đồ 3D nhìn từ trên cao):** Bản đồ quy hoạch đô thị/vùng lãnh thổ trực quan, khối 3D tối giản, highlight các tuyến hành lang kinh tế và vùng trọng điểm. Phù hợp cho số liệu tổng quan, xu hướng vĩ mô và dòng dịch chuyển.
    4. **3D Holographic Data HUD (Biểu đồ không gian & Hologram):** Biểu đồ cột 3D nổi, biểu đồ phân bổ thể tích, các chỉ số số liệu tương tác trực tiếp trên mô hình 3D. Phù hợp cho thống kê tài chính, tỷ lệ phần trăm và so sánh số liệu.`
  },
  {
    id: 'mink_psychology',
    label: 'Nhân vật Mink (@mink) - Tâm lý & Sống chậm',
    desc: 'Nhân vật cố định @mink, biểu cảm thản nhiên deadpan, nét vẽ 2D webtoon Hàn Quốc, chuyên sâu chuyển hóa lời thoại tâm lý & chiêm nghiệm',
    isDefault: false,
    systemPromptGuidelines: `================================================================================
CẨM NANG & MASTER PROMPT ĐỒNG BỘ NHÂN VẬT THAM CHIẾU (@mink / mink.jpg)
================================================================================

[1. NGUYÊN TẮC BẤT BIẾN KHI RENDER]
•   **Tag tham chiếu bắt buộc:** Luôn đặt "@mink" ở vị trí đầu tiên trong prompt ("image_prompt") để AI trích xuất chuẩn xác đặc điểm từ file mink.jpg.
•   **Biểu cảm nhân vật (BẮT BUỘC KHÓA CHẶT):**
    "straight unsmiling neutral deadpan mouth, flat blank expression, unbothered calm gaze, zero smile"
    *TUYỆT ĐỐI KHÔNG DÙNG:* smiling, happy, cheerful, grinning, laughing, crying, dramatic face, angry. Nhân vật Mink luôn giữ thái độ điềm tĩnh, thản nhiên, vô ưu (nonchalant, indifferent, unbothered) trước mọi hoàn cảnh và biến cố.
•   **Nhận diện trang phục cố định:**
    "oversized charcoal dark grey crewneck sweatshirt with a small red heart logo on left chest, loose dark trousers".
•   **Phong cách đồ họa chủ đạo:**
    "Korean slice-of-life 2D webtoon art style, clean crisp black line art, minimal flat cel-shading, warm muted earth tones, cinematic 16:9 framing".
•   **Khử chữ triệt để (Anti-Text Rule):**
    "textless, strictly NO text, NO words, NO letters, NO numbers, pure illustration".
•   **Đuôi thông số kích thước:** Kết thúc prompt bằng "--ar 16:9".

[2. CẤU TRÚC MASTER TEMPLATE TẠO PROMPT ẢNH ("image_prompt")]
@mink, [Góc máy & Hành động đời thường], straight unsmiling neutral deadpan mouth, indifferent blank gaze, [Chi tiết bối cảnh & Đạo cụ sinh hoạt], [Ánh sáng & Màu sắc ấm pastel], Korean slice-of-life 2D webtoon art style, clean crisp black outlines, minimal flat cel-shading, warm muted pastel tones, cinematic composition, textless --ar 16:9

[3. CHIẾN LƯỢC CHUYỂN HÓA LỜI THOẠI TÂM LÝ SANG HÌNH ẢNH (INTELLIGENT PSYCHOLOGICAL MAPPING)]
Tập trung chuyển hóa những câu nói triết lý, suy tư tâm lý, cảm xúc và áp lực xã hội thành các phân cảnh đời thường (slice-of-life) giàu tính ẩn dụ thị giác:
•   **Khi nói về áp lực vật chất / tiêu dùng / so sánh xã hội:**
    - Mink đứng thản nhiên giữa cửa hàng xa xỉ phẩm lộng lẫy (luxury boutique), hai tay đút túi áo sweatshirt, thờ ơ trước tủ kính trưng bày túi xách và đồng hồ đắt tiền (tương phản sắc nét giữa nhân vật giản dị và bối cảnh xa hoa).
    - Mink cầm chiếc điện thoại đen cũ nứt màn hình 5 năm giơ về phía camera với ánh mắt thản nhiên không bận tâm.
•   **Khi nói về buông bỏ / hủy hẹn / giải tỏa áp lực xã hội:**
    - Mink nằm dài toàn thân trên ghế sofa vải phòng khách êm ái, hai tay đan sau gáy, một chân gác lên chân kia, mắt nhìn trần nhà thảnh thơi khi ánh hoàng hôn vàng muộn chiếu xiên qua cửa sổ.
•   **Khi nói về cô đơn tích cực (solitude) / sống chậm / tĩnh lặng nội tâm:**
    - Mink đứng bên cửa sổ bếp ngập nắng sớm, cầm ấm cổ ngỗng rót nước pha cà phê drip, làn hơi nước bốc lên nhẹ nhàng, tâm trạng lắng đọng.
    - Mink đi dạo một mình trên vỉa hè ngoại ô tĩnh lặng lúc hoàng hôn, hai tay đút túi áo, bóng cây và cột điện nhuốm sắc vàng hổ phách an yên.
    - Mink ngồi đọc sách giấy lúc đêm muộn bên bàn gỗ mộc, dưới quầng sáng ấm của đèn bàn vintage và tách trà bốc khói, trăng khuyết ngoài cửa sổ.
    - Mink ngồi ăn mì một mình tại quầy gỗ nhỏ của một quán ăn ấm cúng, cầm đũa gắp mì, nhai chậm rãi, không bận tâm thế giới xung quanh.
    - Mink đứng trên toa tàu điện ngầm lúc tan tầm, một tay nắm quai vịn, thản nhiên nhìn ra cửa kính phản chiếu ánh đèn bokeh thành phố.
•   **Tương phản thị giác sâu sắc:** Luôn tôn vinh sự đối lập giữa nhịp sống ồn ào, vội vã của thế giới bên ngoài với sự tĩnh tại, an nhiên của Mink.`
  }
];

const STORAGE_KEY = 'custom_visual_styles_v1';

export const getStoredStyles = (): VisualStyle[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STYLES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_STYLES;
    
    // Ensure all built-in styles in INITIAL_STYLES are present
    const existingIds = new Set(parsed.map(s => s.id));
    const missingBuiltIns = INITIAL_STYLES.filter(s => !existingIds.has(s.id));
    if (missingBuiltIns.length > 0) {
      const merged = [
        ...INITIAL_STYLES,
        ...parsed.filter(s => !INITIAL_STYLES.some(init => init.id === s.id))
      ];
      saveStoredStyles(merged);
      return merged;
    }

    // Keep built-ins up to date with latest systemPromptGuidelines
    return parsed.map(item => {
      const builtIn = INITIAL_STYLES.find(b => b.id === item.id);
      if (builtIn) {
        return {
          ...item,
          label: builtIn.label,
          desc: builtIn.desc,
          systemPromptGuidelines: builtIn.systemPromptGuidelines,
          isDefault: builtIn.isDefault
        };
      }
      return item;
    });
  } catch (err) {
    console.error("Lỗi khi đọc danh sách phong cách:", err);
    return INITIAL_STYLES;
  }
};

export const saveStoredStyles = (styles: VisualStyle[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
  } catch (err) {
    console.error("Lỗi khi lưu danh sách phong cách:", err);
  }
};

export const addCustomStyle = (
  styleData: Omit<VisualStyle, 'id' | 'isDefault' | 'isCustom' | 'createdAt'>
): VisualStyle => {
  const current = getStoredStyles();
  const newId = `style_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newStyle: VisualStyle = {
    ...styleData,
    id: newId,
    isDefault: false,
    isCustom: true,
    createdAt: Date.now()
  };
  const updated = [...current, newStyle];
  saveStoredStyles(updated);
  return newStyle;
};

export const updateCustomStyle = (
  id: string, 
  updates: Partial<Omit<VisualStyle, 'id' | 'isDefault' | 'isCustom'>>
): VisualStyle[] => {
  const current = getStoredStyles();
  const updated = current.map(item => {
    if (item.id === id && item.isCustom) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveStoredStyles(updated);
  return updated;
};

export const deleteCustomStyle = (id: string): VisualStyle[] => {
  const current = getStoredStyles();
  const updated = current.filter(item => item.id !== id || item.isDefault);
  saveStoredStyles(updated);
  return updated;
};
