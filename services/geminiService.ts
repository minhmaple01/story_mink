import { GoogleGenAI } from "@google/genai";

export type Doc3DSubStyle = '' | 'auto_dynamic' | string;
export type Doc3DRenderTheme = 'auto_dynamic' | 'clay_white' | 'realistic_materials' | 'dark_cyber_hud';
export type SegmentMode = 'dynamic_grid_4_9' | 'dynamic_grid_468' | 'multi_prompt_line' | 'line' | 'duration';

export interface ReferenceImageItem {
  id: string;
  name: string; // Identifier for @name linking (e.g., "cau_nhat_tan")
  subject: string; // e.g., "Cầu Nhật Tân, Hà Nội"
  context1: string; // e.g., "Sông Hồng"
  imageType: string; // e.g., "Ảnh chụp trên cao, góc rộng, độ phân giải cao"
  structureDetails: string; // e.g., "toàn bộ chiều dài cầu với 5 tháp dây văng hình chữ A đặc trưng"
  perspective: string; // e.g., "góc nghiêng từ trên cao, phối cảnh động"
  context2: string; // e.g., "đường chân trời Hà Nội mở rộng, Hồ Tây"
  lighting: string; // e.g., "ánh sáng ban ngày tự nhiên, rõ nét / ánh hoàng hôn làm nổi bật cấu trúc"
  fullPrompt: string; // formatted according to the exact template
  category?: string; // e.g. "Cầu đường / Giao thông", "Kiến trúc / Landmark", "Cảng biển / KCN", "Năng lượng / Hạ tầng", "Đô thị / Địa lý", "Địa hình / Thủy văn", "Thiết bị / Phương tiện"
}

export const formatReferenceImagePrompt = (item: {
  imageType?: string;
  subject: string;
  context1?: string;
  structureDetails?: string;
  perspective?: string;
  context2?: string;
  lighting?: string;
}): string => {
  const type = item.imageType || 'Ảnh chụp trên cao từ drone/flycam, góc rộng toàn cảnh (wide-angle aerial drone photography), độ phân giải cao';
  const sub = item.subject || 'Chủ thể chính';
  const c1 = item.context1 || 'Khu vực bối cảnh địa lý thực tế';
  const struct = item.structureDetails || 'toàn bộ quy mô kiến trúc tổng thể, tỷ lệ thực tế, đầy đủ các nhịp và phân khu';
  const pers = item.perspective || 'high-angle wide aerial view, panoramic overview of full structure and surrounding terrain';
  const c2 = item.context2 || 'khung cảnh xung quanh mở rộng, kết nối giao thông và địa hình';
  const light = item.lighting || 'natural, clear daylight to accurately define all authentic structures';

  return `[Loại ảnh: ${type}] về [Chủ thể chính: ${sub}] spanning [Bối cảnh 1: ${c1}]. The image showcases [Chi tiết cấu trúc: ${struct}]. The perspective is [Góc máy: ${pers}]. In the background, [Bối cảnh 2: ${c2}]. Lighting is [Ánh sáng: ${light}] to define all structures. The image is clean and free of text.`;
};

export const getPromptCountForDuration = (seconds: number): number => {
  if (seconds <= 6) return 1;
  if (seconds <= 12) return 2;
  if (seconds <= 16) return 3;
  if (seconds <= 20) return 4;
  return Math.max(1, Math.ceil(seconds / 4));
};

export async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errorMessage = err?.message || String(err);
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Quota') || errorMessage.includes('rate limit');
      const isTransient = errorMessage.includes('503') || errorMessage.includes('500') || errorMessage.includes('overloaded') || errorMessage.includes('fetch failed');
      
      if (attempt <= maxRetries && (isRateLimit || isTransient)) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 800;
        console.warn(`[Gemini API] Request throttled/failed (${errorMessage}). Thử lại lần ${attempt}/${maxRetries} sau ${Math.round(delay)}ms...`);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
}

const get3DStyleDescription = (
  subStyle: Doc3DSubStyle = 'mink_psychology', 
  theme: Doc3DRenderTheme = 'clay_white',
  customStylePrompt?: string
): string => {
  let themeDetail = "";
  if (theme === 'auto_dynamic') {
    themeDetail = "Dynamic material & lighting adaptation based on narrative context: For general architectural & city planning scenes, use matte off-white clay render with soft studio global illumination; for nature, agriculture, parks or water infrastructure, use realistic miniature materials (lush foliage, crystal glass, concrete); for high-tech, financial stats, night investigations or deep underground networks, use dark slate tech styling with glowing neon HUD accents.";
  } else if (theme === 'clay_white') {
    themeDetail = "Matte off-white buildings and terrain, architectural clay render, minimalistic low poly geometry, clean sterile aesthetic, soft studio global illumination, subtle ambient occlusion, minimal textures with selective vibrant accent colors.";
  } else if (theme === 'realistic_materials') {
    themeDetail = "Realistic miniature architectural model materials (translucent architectural glass, textured smooth concrete, realistic water bodies, lush miniature foliage, wood elements), tilt-shift photography, realistic studio spotlighting and soft shadows.";
  } else {
    themeDetail = "Dark tech blueprint aesthetic, charcoal dark slate background, glowing neon holographic wireframes, glowing cyan/amber data coordinates, sleek futuristic infographic visuals, volumetric rim lighting.";
  }

  // If a custom style prompt is provided from custom user-added styles, use it directly
  if (customStylePrompt && customStylePrompt.trim().length > 0) {
    return `${customStylePrompt}\n•   **Render Theme / Color Atmosphere:** ${themeDetail}`;
  }

  // Unified "Tự động linh hoạt" (Auto Dynamic): combines all 3D diorama, cross-section, 3D map, and holographic HUD perspectives seamlessly
  return `•   **Dynamic Visual Alternation (Tự động luân chuyển góc nhìn 3D phù hợp nhất theo từng câu thoại):**
    1. **3D Isometric Diorama (Sa bàn 3D góc 45°):** Khối kiến trúc thu nhỏ trên bệ nổi, ống kính tilt-shift, hình khối low-poly sạch sẽ, ánh sáng studio. Phù hợp nhất cho các công trình, địa điểm, dự án hoặc hành động cụ thể.
    2. **3D Architectural/Geological Cross-Section (Mặt cắt phân tầng cutaway):** Bóc tách đa tầng kiến trúc và địa chất ngầm (móng cọc, địa tầng đất, hầm ngầm, đường ống kỹ thuật, tuyến metro). Phù hợp giải thích nguyên lý, cơ chế ngầm hoặc phân tích nội bộ.
    3. **Top-Down 3D Map Visualization (Bản đồ 3D nhìn từ trên cao):** Bản đồ quy hoạch đô thị/vùng lãnh thổ trực quan, khối 3D tối giản, highlight các tuyến hành lang kinh tế và vùng trọng điểm. Phù hợp cho số liệu tổng quan, xu hướng vĩ mô và dòng dịch chuyển.
    4. **3D Holographic Data HUD (Biểu đồ không gian & Hologram):** Biểu đồ cột 3D nổi, biểu đồ phân bổ thể tích, các chỉ số số liệu tương tác trực tiếp trên mô hình 3D. Phù hợp cho thống kê tài chính, tỷ lệ phần trăm và so sánh số liệu.
•   **Render Theme:** ${themeDetail}`;
};

const getSystemPrompt = (
  duration: number,
  subStyle: Doc3DSubStyle = 'mink_psychology',
  theme: Doc3DRenderTheme = 'clay_white',
  includeCharactersPresent: boolean = false,
  includeCharactersAbsent: boolean = false,
  includeMotion: boolean = false,
  allowTextInImage: boolean = true,
  segmentMode: SegmentMode = 'dynamic_grid_4_9',
  hasReferenceImages: boolean = false,
  customStylePrompt?: string,
  chunkIndex?: number,
  allowLongerPacingFromPart3?: boolean,
  boostShortScenesPart1?: boolean
) => {
  const style3DDescription = get3DStyleDescription(subStyle, theme, customStylePrompt);
  const isFlexibleGrid = segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468';
  const isMink = subStyle === 'mink_psychology' || (customStylePrompt && customStylePrompt.includes('@mink'));
  const isPart1 = (chunkIndex === 0);
  const isPart3OrLater = (chunkIndex !== undefined && chunkIndex >= 2);
  const use8to14 = isFlexibleGrid && allowLongerPacingFromPart3 && isPart3OrLater;
  const usePart1ShortScenes = isFlexibleGrid && allowLongerPacingFromPart3 && boostShortScenesPart1 && isPart1;

  let parsedFormat: any = isMink ? {
    voiceover_context: "Use the EXACT original subtitle text spoken during this scene's time window. DO NOT TRANSLATE or summarize.",
    image_prompt: "@mink, [Camera angle & slice-of-life action reflecting the psychology], straight unsmiling neutral deadpan mouth, indifferent blank gaze, [Setting & props], [Lighting & warm color], Korean slice-of-life 2D webtoon art style, clean crisp black outlines, minimal flat cel-shading, warm muted pastel tones, cinematic composition, textless --ar 16:9",
    story_action: "Slice-of-life visual action of Mink with deadpan expression that metaphorically reflects the psychological reflection in this subtitle line",
    background: "Cozy minimalist interior, sunlit window, quiet suburban sidewalk at sunset, late night wooden desk, or rain-streaked subway car",
    composition: "Wide cinematic shot OR Medium shot OR Side profile, eye-level, balanced negative space",
    color: "Warm muted earth tones, soft golden hour sunbeams, cozy interior lamp glow, minimal flat cel-shading palette",
    constraints: "Korean slice-of-life 2D webtoon art style, clean crisp black outlines, straight unsmiling deadpan mouth, unbothered calm gaze, oversized charcoal dark grey crewneck sweatshirt with small red heart logo on left chest, loose dark trousers, textless, strictly NO text, NO words, NO letters, NO numbers, pure illustration"
  } : {
    voiceover_context: "Use the EXACT original subtitle text spoken during this scene's time window. DO NOT TRANSLATE or summarize.",
    image_prompt: "Complete prompt ready to copy directly into image generation tools (Midjourney / Flux / Imagen), describing subject, action, environment, lighting, artistic style, textless --ar 16:9",
    style: "3D Isometric Diorama clay render OR 3D Architectural Cross-section cutaway OR Top-down 3D Data Map visualization",
    reference_image: hasReferenceImages ? "@name (e.g. '@cau_nhat_tan') ONLY if this specific scene depicts that landmark/location; otherwise null" : undefined,
    background: "[HYPER-DETAILED REPEATING DESCRIPTION] Clean geometric forms, studio lighting, ambient occlusion, miniature architectural setting strictly matching the voiceover context.",
    characters_present: "Format: 'Name(Age age)' ONLY if humans are featured as stylized miniature figurines. Otherwise omit.",
    characters_absent: "List names only.",
    story_action: "Action description or focal spatial event in the 3D diorama/cutaway that DIRECTLY illustrates what is being spoken in this exact voiceover_context.",
    composition: "Camera angle (45° isometric / top-down 90° / cutaway cross-section), tilt-shift focus, studio key light and ambient occlusion",
    elements: "Key 3D architectural elements, miniature props, highlighted zones, data overlays specifically mentioned in this voiceover segment",
    color: theme === 'auto_dynamic' 
      ? "Contextually adapted: Matte off-white with selective vibrant accents for standard scenes, natural foliage/materials for environment scenes, or dark slate with glowing neon HUD for technical/data scenes"
      : theme === 'clay_white' 
      ? "Matte off-white base with accent cyan/coral data highlights" 
      : theme === 'dark_cyber_hud' 
      ? "Dark slate with glowing cyan and amber HUD markers" 
      : "Natural miniature materials with emerald green foliage and crystal glass",
    constraints: "clean geometry, sterile documentary vibe, infographic aesthetic, Unreal Engine 5 render style"
  };

  if (!hasReferenceImages) delete parsedFormat.reference_image;
  if (!includeCharactersPresent) delete parsedFormat.characters_present;
  if (!includeCharactersAbsent) delete parsedFormat.characters_absent;
  if (segmentMode === 'multi_prompt_line' || isFlexibleGrid) {
    parsedFormat.part = 1;
  }

  let motionInstructions = '';
  if (includeMotion) {
    parsedFormat.motion = isMink
      ? "Describe subtle, poetic 2D slice-of-life cinematic animation (e.g., gentle slow zoom-in, steam rising from coffee, golden sunbeams slowly shifting across floor, character taking a calm breath or looking out the window with unbothered expression). In the final moments of the shot, smoothly lead toward the physical setting or object of the next scene (CRITICAL: NEVER write 'for Part 8', 'Part 2', or 'next Part')."
      : isFlexibleGrid
      ? "Describe dynamic in-shot 3D camera trajectory (e.g., orbital rotation, push-in, crane elevation) and kinetic diorama actions (extruding layers, moving vehicles, sliding indicators) illustrating the spoken topic. At the end of the shot, describe a fluid visual transition naturally leading toward the visual subject or setting of the subsequent scene (CRITICAL: NEVER write meta-labels like 'for Part 8', 'Part 2', or 'next Part')."
      : segmentMode === 'multi_prompt_line'
      ? "Describe the full in-shot movement and dynamics occurring throughout the 3D scene (camera trajectory like slow orbital rotation/push-in, 3D element extrusion/unfolding, kinetic data labels sliding in). ONLY at the end of the shot, describe the seamless camera/visual transition leading toward the visual subject or setting of the next scene (CRITICAL: NEVER write 'for Part 8', 'Part 2', or 'next Part')."
      : "Describe detailed in-shot 3D actions, camera dynamics (isometric pan, smooth zoom-in, 360 orbit around diorama, tilt-shift focus shift), and kinetic infographic animations occurring throughout the shot, settling smoothly before ending.";

    motionInstructions = `
==================================================
STEP 2.8: CAMERA MOTION & VISUAL TRANSITION RULES (CRITICAL)
In the "motion" field, describe the visual dynamics in clear chronological progression:
1.  **Primary In-Shot Motion (Main Focus):**
    *   ${isMink 
          ? "Cinematic 2D camera drifting, gentle slow push-in, subtle environment dynamics (steam rising, sunlight slowly shifting across floor, dust motes dancing in sunbeams, calm head turn)." 
          : "3D Camera Dynamics: Specify cinematic 3D camera trajectory (e.g., 'Slow 45-degree orbital rotation around the diorama', 'Cinematic downward crane push into the cross-section layer', 'Smooth orthogonal tracking shot following the route on the 3D map')."}
    *   ${isMink 
          ? "Character dynamics: Character performs subtle, tranquil everyday action with unhurried composure (e.g. slowly pouring drip coffee, turning a book page, staring unbothered out the window)." 
          : "3D Scene Dynamics: Describe elements rising, building up (procedural extrusion), doors opening, cutaways sliding apart, vehicles or miniature figures moving along paths."}
2.  **Ending Scene Transition (ONLY at the very end of the shot) - STRICT RULES:**
    *   **ABSOLUTE BAN ON "Part X" (e.g. "for Part 8", "leading into Part 2", "for the next Part", "into Part 3"):** 
        AI video generation engines (Kling, Luma Dream Machine, Runway, Hailuo, Sora) execute prompts literally and will hallucinate garbled text or corrupted animation if given meta-labels like "Part 8". NEVER write "...for Part X" in the motion field.
    *   **DESCRIBE THE ACTUAL PHYSICAL SUBJECT / SCENE OF THE NEXT SHOT:** 
        Always describe the physical camera movement pivoting, panning, or tracking toward the actual visual subject, landmark, or room/setting that appears next in the narrative.
        *   *CORRECT EXAMPLE:* "Camera gently glides across the wooden tabletop, panning toward the rain-streaked window where city neon lights blur in bokeh."
        *   *INCORRECT (STRICTLY FORBIDDEN):* "Camera glides across the tabletop for Part 8." ❌
    *   **For the Final Scene of the entire script:** The motion smoothly decelerates, centers, and stabilizes without transitioning anywhere.
`;
  }

  let textRules = '';
  if (isMink) {
    textRules = `•   **NO TEXT (ABSOLUTE RULE FOR @MINK):** Strictly NO text, NO words, NO letters, NO numbers, textless pure illustration only.`;
  } else if (allowTextInImage) {
    parsedFormat.constraints += ", on-screen text is allowed ONLY when specific, directly relevant to the subtitle content, and explicitly quoted with exact words/numbers; absolutely NO generic or placeholder text";
    textRules = `•   **STRICT TEXT & DATA RULES:** Text in the 3D image is allowed ONLY when it represents concrete data, names, or metrics directly mentioned in the subtitle (e.g., specific labels, percentages, dates, explicitly quoted in ""). NEVER write generic labels like 'sample text' or 'data point'.`;
  } else {
    parsedFormat.constraints += ", NO text, NO letters, NO numbers, clean unlabelled 3D models only";
    textRules = `•   **NO TEXT (STRICT):** Absolutely NO text, words, letters, labels, or typography on the 3D rendering.`;
  }

  const formatInstructions = JSON.stringify(parsedFormat, null, 2);

  const step1Instructions = use8to14 ? `
==================================================
STEP 1: DYNAMIC 8s TO 14s FLEXIBLE TIME GRID (ÁP DỤNG CHO TỪ PHẦN 3 TRỞ ĐI - TỐI THIỂU 8s, TỐI ĐA 14s) & STRICT SUBTITLE SYNCHRONIZATION (CRITICAL)

1.  **STRICT SUBTITLE SYNCHRONIZATION (CHỐNG LỆCH HÌNH VỚI LỜI THOẠI):**
    *   **Direct Visual Depiction:** The generated visual storyboard for every segment MUST depict exactly what is being spoken in the subtitle lines during that time span.
    *   **"voiceover_context":** MUST contain the exact original subtitle sentences corresponding to this specific segment's time range.
    *   **"story_action" & "elements":** MUST directly illustrate the specific subject, location, structure, action, or metrics spoken in that "voiceover_context". DO NOT show unrelated generic objects or scenes from future/past dialogue.

2.  **Flexible 8.0s - 14.0s Duration (TỐI THIỂU 8 GIÂY, CHO PHÉP ĐẾN 14 GIÂY CHO TỪ PHẦN 3 TRỞ ĐI):**
    *   **THẤP NHẤT LÀ 8 GIÂY (MINIMUM 8.0 SECONDS):** TUYỆT ĐỐI KHÔNG tạo bất kỳ cảnh nào dưới 8.0 giây trong phần này. Nếu câu phụ đề ngắn (< 8s), bạn BẮT BUỘC phải gộp các câu phụ đề kế tiếp lại để đạt thời lượng từ 8.0s đến 14.0s.
    *   **CHO PHÉP CẢNH DÀI ĐẾN 14 GIÂY (MAXIMUM 14.0 SECONDS):** Thời lượng mỗi cảnh nằm trong khoảng **8.0 đến 14.0 giây** (ví dụ: 8s, 8.5s, 9s, 9.5s, 10s, 11s, 12s, 13s, 14s) giúp khung hình có độ lắng sâu, camera di chuyển trầm tĩnh và mô tả trọn vẹn bối cảnh không gian/tâm lý.
    *   Căn chỉnh mốc thời gian:
        *   Nếu một câu hoặc cụm câu phụ đề gộp lại dài 8s - 14s (ví dụ: 8s, 9s, 10s, 12s, 14s): tạo 1 cảnh trọn vẹn duy nhất cho khoảng thời gian đó.
        *   Nếu một đoạn thoại dài vượt quá 14s: chia thành các Part liên tiếp từ 8s đến 14s (ví dụ: Part 1 dài 8s, Part 2 dài 8s).

3.  **CLEAN TIME HEADER & NO DURATION TAGS IN PROMPT (STRICT):**
    *   Sử dụng Time Header chuẩn: ví dụ \`**[02:15 - 02:23]**\` hoặc \`**[02:23 - 02:37]**\`.
    *   **DO NOT ADD ANY DURATION TAGS** (như <8>, <14>, <10>) vào header, prompt text, hay trường JSON.
    *   Include \`"part": 1, 2, 3...\` in the JSON object.

4.  **Contiguous Timeline:** Ensure each scene advances the timeline contiguously (no time gaps, no overlaps).
` : usePart1ShortScenes ? `
==================================================
STEP 1: PHẦN 1 HOOK MỞ ĐẦU - TĂNG CƯỜNG TỐI ĐA SỐ CẢNH NGẮN (3.5s - 5.5s / TỐI ĐA 6.0s) & CHỐNG LỆCH HÌNH VỚI LỜI THOẠI (CRITICAL)

1.  **MỤC TIÊU PHẦN 1 (AUDIENCE RETENTION HOOK - TĂNG CƯỜNG MẬT ĐỘ CẢNH NGẮN):**
    *   Phần 1 là phần mở đầu tối quan trọng nhằm giữ chân khán giả ngay trong 1-2 phút đầu tiên. BẮT BUỘC phải chia kịch bản thành **NHIỀU CẢNH NGẮN** liên tục, nhịp độ nhanh dồn dập, thay đổi liên tục góc máy và bố cục để tạo sự lôi cuốn mạnh mẽ.
    *   **THỜI LƯỢNG MỖI CẢNH (3.5s - 5.5s, TỐI ĐA 6.0s):** Mỗi cảnh ngắn gọn từ 3.5 giây đến 5.5 giây (tối đa không vượt quá 6.0s). Ví dụ: 3.5s, 4s, 4.5s, 5s, 5.5s, 6s.
    *   **TUYỆT ĐỐI KHÔNG GỘP THÀNH CẢNH DÀI:** Trong Phần 1 này, TUYỆT ĐỐI KHÔNG gộp các câu phụ đề lại thành cảnh dài 7s - 9s. Hãy tách nhỏ từng câu thoại hoặc từng ý nội dung thành từng cảnh riêng biệt với góc máy 3D và chuyển động mới.
    *   **ESTABLISHING SHOT 00:00:** Cảnh đầu tiên tại 00:00 là đại cảnh toàn cảnh 3D (master isometric diorama, 4s-5s). Sau đó lập tức cắt sang các góc cận cảnh, góc cắt lớp (cross-section cutaway) hoặc chuyển động bám sát để tạo nhịp phim sống động, cuốn hút.

2.  **STRICT SUBTITLE SYNCHRONIZATION (CHỐNG LỆCH HÌNH VỚI LỜI THOẠI):**
    *   **Direct Visual Depiction:** Hình ảnh 3D mô tả chuẩn xác câu thoại tương ứng trong khung thời gian đó.
    *   **"voiceover_context":** Chứa nguyên văn câu phụ đề gốc trong khoảng thời gian này.
    *   **"story_action" & "elements":** Minh họa trực tiếp đối tượng, số liệu hoặc hành động được nói đến trong phụ đề.

3.  **CLEAN TIME HEADER & NO DURATION TAGS IN PROMPT (STRICT):**
    *   Sử dụng Time Header chuẩn: ví dụ \`**[00:00 - 00:04.5]**\` hoặc \`**[00:04.5 - 00:09]**\`.
    *   **DO NOT ADD ANY DURATION TAGS** (như <4>, <6>, <5.5>) vào header, prompt text, hay trường JSON.
    *   Include \`"part": 1, 2, 3...\` in the JSON object.

4.  **Contiguous Timeline:** Ensure each scene advances the timeline contiguously (no time gaps, no overlaps).
` : isFlexibleGrid ? `
==================================================
STEP 1: DYNAMIC 4s TO 9s FLEXIBLE TIME GRID & STRICT SUBTITLE-TO-VISUAL SYNCHRONIZATION (CRITICAL)

1.  **STRICT SUBTITLE SYNCHRONIZATION (CHỐNG LỆCH HÌNH VỚI LỜI THOẠI):**
    *   **Direct Visual Depiction:** The generated 3D visual storyboard for every segment MUST depict exactly what is being spoken in the subtitle lines during that time span.
    *   **"voiceover_context":** MUST contain the exact original subtitle sentences corresponding to this specific segment's time range.
    *   **"story_action" & "elements":** MUST directly illustrate the specific subject, location, structure, action, or metrics spoken in that "voiceover_context". DO NOT show unrelated generic objects or scenes from future/past dialogue.

2.  **Flexible 4.0s - 9.0s Duration Tailored to Subtitle Sentences${allowLongerPacingFromPart3 ? (chunkIndex === 1 ? ' (PHẦN 2: CHUYỂN TIẾP 4s - 8s CHUẨN BỊ CHO LƯỚI 8s - 14s TỪ PHẦN 3)' : ' (PHẦN 1 & 2: NHỊP ĐỘ MỞ ĐẦU 4s - 9s)') : ''}:**
    *   Each scene's duration MUST be in the range of **4.0 to 9.0 seconds** (e.g., 4s, 4.5s, 5s, 5.5s, 6s, 6.5s, 7s, 7.5s, 8s, 8.5s, 9s).${allowLongerPacingFromPart3 ? '\n    *   (Ghi chú: Lưới mở rộng 8s - 14s sẽ tự động áp dụng từ Phần 3 trở đi).' : ''}
    *   Align scene timestamps with natural subtitle boundaries, sentences, or natural speech pauses:
        *   If a subtitle sentence is 4.5s long: create a scene of exactly 4.5s (e.g. \`**[00:00 - 00:04.5]**\`).
        *   If a subtitle sentence is 5.5s or 6s: create a scene with duration 5.5s or 6s (e.g. \`**[00:00 - 00:05.5]**\` or \`**[00:00 - 00:06]**\`).
        *   If multiple short subtitle lines total between 4s and 9s (e.g. 7.5s): merge them into a single cohesive scene.
        *   If a complex or lengthy sentence exceeds 9s (e.g. 14s): break it into progressive consecutive Parts (e.g. Part 1 of 7s and Part 2 of 7s).

3.  **CLEAN TIME HEADER & NO DURATION TAGS IN PROMPT (STRICT):**
    *   Use clean standard time headers: e.g. \`**[00:00 - 00:05.5]**\` or \`**[00:00 - 00:06]**\`.
    *   **DO NOT ADD ANY DURATION TAGS** (like <4>, <6>, <5.5>) to the header, prompt text, or JSON fields.
    *   Include \`"part": 1, 2, 3...\` in the JSON object.

4.  **Contiguous Timeline:** Ensure each scene advances the timeline contiguously (no time gaps, no overlaps).
` : segmentMode === 'multi_prompt_line' ? `
==================================================
STEP 1: DYNAMIC MULTI-PROMPT PER SUBTITLE LINE SEGMENTATION (CRITICAL)
1.  **Calculate prompt count per subtitle line based on duration:**
    *   **Under 6 seconds (<= 6.0s):** Generate **1 prompt** (Part 1).
    *   **Under 12 seconds (6.1s - 12.0s):** Generate **2 prompts** (Part 1, Part 2).
    *   **Under 16 seconds (12.1s - 16.0s):** Generate **3 prompts** (Part 1, Part 2, Part 3).
    *   **Under 20 seconds (16.1s - 20.0s):** Generate **4 prompts** (Part 1, Part 2, Part 3, Part 4).
    *   **Longer lines:** Proportional (1 prompt per ~4-5 seconds).
2.  **Sequential Time Header & Part field:** Divide each subtitle's timespan into sequential sub-intervals and include \`"part": 1\`, \`"part": 2\`, etc. in each JSON object.
3.  **Narrative & Visual Complementarity in 3D:** All scenes for the SAME subtitle line MUST complement each other, build sequentially, and relate closely (e.g., Establishing 3D isometric overview -> Zoom into architectural cutaway -> Highlight key data hotspot).
4.  **Exact Voiceover Context:** Every Part scene for that subtitle line MUST keep the exact original subtitle text in \`"voiceover_context"\`.
` : segmentMode === 'line' ? `
==================================================
STEP 1: ONE PROMPT PER SUBTITLE LINE SEGMENTATION
1.  Generate exactly ONE 3D scene (JSON object) for EACH individual subtitle block provided.
2.  The Time Range for each scene should match the exact start and end time of that subtitle block.
` : `
==================================================
STEP 1: FIXED TIME GRID SEGMENTATION
1.  **Divide timeline** into rigid ${duration}-second chunks.
2.  **CRITICAL:** Generate a 3D visual storyboard block for EVERY ${duration}-second interval within the provided TARGET GRID RANGE.
`;

  const characterInstructions = isMink ? `
**CHARACTER @MINK SPECIFICATIONS (BẮT BUỘC KHÓA CHẶT MỌI PHÂN CẢNH):**
•   **Tag tham chiếu bắt buộc:** Luôn đặt "@mink" ở vị trí đầu tiên trong "image_prompt" để AI trích xuất đặc điểm từ file mink.jpg.
•   **Biểu cảm nhân vật (KHÓA CHẶT):**
    "straight unsmiling neutral deadpan mouth, flat blank expression, unbothered calm gaze, zero smile"
    *TUYỆT ĐỐI CẤM:* Không bao giờ dùng smiling, happy, cheerful, grinning, laughing, crying, frowning, screaming hay biểu cảm kịch tính. Nhân vật Mink luôn giữ thái độ điềm tĩnh, thản nhiên, vô ưu (nonchalant, indifferent, unbothered, calm) trước mọi hoàn cảnh và biến cố.
•   **Nhận diện trang phục:**
    "oversized charcoal dark grey crewneck sweatshirt with a small red heart logo on left chest, loose dark trousers".
•   **Phong cách đồ họa:**
    "Korean slice-of-life 2D webtoon art style, clean crisp black line art, minimal flat cel-shading, warm muted earth tones, cinematic 16:9 framing".
•   **Khử chữ triệt để:**
    "textless, strictly NO text, NO words, NO letters, NO numbers, pure illustration".
•   **Cấu trúc Master Template cho "image_prompt":**
    @mink, [Góc máy & Hành động đời thường], straight unsmiling neutral deadpan mouth, indifferent blank gaze, [Chi tiết bối cảnh & Đạo cụ sinh hoạt], [Ánh sáng & Màu sắc ấm pastel], Korean slice-of-life 2D webtoon art style, clean crisp black outlines, minimal flat cel-shading, warm muted pastel tones, cinematic composition, textless --ar 16:9

**INTELLIGENT PSYCHOLOGICAL CONTEXT MAPPING (TRÍ TUỆ CHUYỂN HÓA LỜI THOẠI TÂM LÝ):**
Mink là nhân vật dành riêng cho chủ đề tâm lý, triết lý sống, sự cô đơn tích cực (solitude), buông bỏ áp lực và tự chữa lành:
1. Khi lời thoại bàn về áp lực xã hội, so sánh, tiêu dùng phô trương -> Mink đứng thản nhiên giữa cửa hàng xa xỉ phẩm xa hoa hoặc giơ chiếc điện thoại nứt màn hình 5 năm với vẻ mặt unbothered.
2. Khi lời thoại bàn về giải tỏa áp lực, hủy hẹn, tự do một mình -> Mink nằm dài trên sofa thảnh thơi, gác chân, ngắm trần nhà trong nắng chiều vàng.
3. Khi lời thoại bàn về sống chậm, hiện tại, chiêm nghiệm -> Mink pha cà phê drip sáng bên cửa sổ, đi dạo một mình lúc hoàng hôn, đọc sách đêm khuya bên đèn vintage, ăn mì một mình tại quầy gỗ ấm cúng, đứng trên tàu điện ngầm lúc tan tầm nhìn ánh đèn bokeh...
4. Luôn tôn vinh sự tương phản giữa thế giới ồn ào bên ngoài và sự bình an, tĩnh tại bên trong của Mink.` : `
**CHARACTER / HUMAN REPRESENTATION IN 3D:**
•   In 3D documentary style, humans appear primarily as **stylized 3D miniature architectural figurines** or silhouette scale-figures.
•   Do NOT describe facial features (eyes, face details). Focus strictly on scale, pose, placement in the 3D space, and physical action.
•   If 'characters_present' is requested, use format: "Name(Age age)".`;

  return `
You are an expert Visual Director specializing in ${isMink ? '**Psychological Slice-of-Life Visual Storyboards & Master Prompts featuring the fixed character @mink**' : '**3D Documentary, Architectural Dioramas, Investigative Cutaways, and Spatial Data Infographics (Tư liệu 3D)**'} based on SRT subtitle files.

**OBJECTIVE:** Transform subtitle content into a cohesive visual storyboard ${isMink ? 'starring @mink with deadpan calm expression capturing psychological reflections' : 'with high-end 3D documentary visual styles'} ${isFlexibleGrid ? 'using DYNAMIC 4s–9s FLEXIBLE TIME GRID (<4> to <9>) with STRICT SUBTITLE-TO-VISUAL SYNCHRONIZATION' : segmentMode === 'multi_prompt_line' ? 'using DYNAMIC MULTI-PROMPT PER SUBTITLE LINE' : segmentMode === 'line' ? 'using ONE PROMPT PER SUBTITLE LINE' : `using a FIXED ${duration}-SECOND TIME GRID`}.

${step1Instructions}

==================================================
STEP 2: VISUAL STYLE GUIDELINES

**CORE AESTHETIC:**
${style3DDescription}
${textRules}

**ENVIRONMENT & BACKGROUND CONTINUITY:**
•   ${isMink ? 'Describe the setting with rich atmospheric lighting, warm slice-of-life textures, and cinematic composition.' : 'Hyper-Detail in 3D: Describe the miniature scale, lighting atmosphere (soft studio key lights, global illumination, rim highlights), geometry textures, and spatial composition.'}
•   **Continuity:** If consecutive scenes depict the same location, maintain visual continuity in the core setting while varying camera angles.
${hasReferenceImages ? `•   **SELECTIVE REFERENCE IMAGE LINKING (@name) & REAL-WORLD FIDELITY RULE:**
    *   **NOT EVERY SCENE USES A REFERENCE IMAGE:** Only assign "reference_image": "@name" (e.g. "@cau_nhat_tan") to scenes that SPECIFICALLY depict, locate at, or feature that particular landmark/structure.
    *   For scenes depicting general concepts, abstract data charts, economic metrics, generic offices, unrelated locations, or macro diagrams, you MUST set "reference_image": null (or omit).
    *   **NO DISTORTED CLOSE-UP CROPS (HẠN CHẾ CẬN CẢNH):** When referencing a landmark/structure, maintain full structural scale, authentic proportions, and geographical context. Avoid hyper-close crops that lose architectural authenticity.
    *   When a reference image IS linked, strictly adhere to its architectural proportions, scale, tower counts, and geographic environment in the "background" and "elements" fields.` : ''}

${characterInstructions}

${motionInstructions}

==================================================
STEP 3: OUTPUT FORMAT (STRICT FORMAT)

For each block, output **ONLY** the clean Time Header and the JSON Code block.
DO NOT wrap the entire output in a single outer markdown block. Output each segment sequentially.

**[00:00 - 00:05.5]** or **[00:00 - 00:06]**
${formatInstructions}
`;
};

export interface StoryboardSegment {
  timeRange: string;
  jsonContent: any;
  rawJson: string;
  part?: number;
  durationTag?: '<4>' | '<6>' | '<8>' | string;
}

export interface SRTChunk {
  id: number;
  startTime: string;
  endTime: string;
  gridStart: string;
  gridEnd: string;
  realEndTime?: string;
  content: string;
  originalIndexStart: number;
  originalIndexEnd: number;
}

export interface ChunkContext {
  lastBackground: string;
  lastOutfitContext?: string;
  lastEndTime?: string;
  lastVoiceover?: string;
}

export const timestampToSeconds = (timeStr: string): number => {
  if (!timeStr) return 0;
  const normalized = timeStr.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  
  const seconds = parseFloat(parts[2]);
  return (
    parseInt(parts[0]) * 3600 +
    parseInt(parts[1]) * 60 +
    seconds
  );
};

export const secondsToMMSS = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const isDecimal = Math.round(remainingSeconds * 10) % 10 !== 0;
  
  if (isDecimal) {
    const fixed = (Math.round(remainingSeconds * 10) / 10).toFixed(1);
    const parts = fixed.split('.');
    const secStr = parts[0].padStart(2, '0');
    return `${minutes.toString().padStart(2, '0')}:${secStr}.${parts[1]}`;
  }
  const seconds = Math.floor(remainingSeconds);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const splitSRTByTime = (
  srt: string, 
  segmentDuration: number = 10,
  segmentMode: SegmentMode = 'dynamic_grid_4_9'
): SRTChunk[] => {
  const isFlexibleGrid = segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468';
  const durationSeconds = segmentMode === 'line' || segmentMode === 'multi_prompt_line' || isFlexibleGrid
    ? 150
    : segmentDuration * 20; 
  
  const normalizedSrt = srt.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const blocks = normalizedSrt.split(/\n\n+/).filter(b => b.trim().length > 0);
  
  const chunks: SRTChunk[] = [];
  let currentChunkBlocks: string[] = [];
  let currentChunkIndex = 0;
  let chunkStartIndex = 1;
  let lastBlockOfPrevChunk: string | null = null;
  
  const timeRegex = /(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/;

  const getBlockRange = (blocks: string[]) => {
    if (blocks.length === 0) return { start: "00:00", end: "00:00", endSeconds: 0 };
    
    const firstMatch = timeRegex.exec(blocks[0]);
    const lastBlockLines = blocks[blocks.length - 1].split('\n');
    const timeLine = lastBlockLines.find(l => l.includes('-->'));
    
    let start = "00:00";
    let end = "00:00";
    let endSeconds = 0;

    if (firstMatch) {
      const sec = timestampToSeconds(firstMatch[1]);
      start = secondsToMMSS(sec);
    }

    if (timeLine) {
      const parts = timeLine.split('-->');
      if (parts.length > 1) {
        const endMatch = timeRegex.exec(parts[1]);
        if (endMatch) {
          endSeconds = timestampToSeconds(endMatch[1]);
          end = secondsToMMSS(endSeconds);
        }
      }
    }
    return { start, end, endSeconds };
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const match = timeRegex.exec(block);
    
    if (match) {
      const startTimeSeconds = timestampToSeconds(match[1]);
      const calculatedChunkIndex = Math.floor(startTimeSeconds / durationSeconds);

      if (calculatedChunkIndex > currentChunkIndex) {
        if (currentChunkBlocks.length > 0) {
          const { start, end } = getBlockRange(currentChunkBlocks);
          const gridStart = chunks.length === 0 ? "00:00" : chunks[chunks.length - 1].endTime;
          
          chunks.push({
            id: chunks.length,
            startTime: start,
            endTime: end,
            gridStart: gridStart,
            gridEnd: end,
            realEndTime: end,
            content: currentChunkBlocks.join('\n\n'),
            originalIndexStart: chunkStartIndex,
            originalIndexEnd: i 
          });

          lastBlockOfPrevChunk = currentChunkBlocks[currentChunkBlocks.length - 1];
        }
        
        currentChunkIndex = calculatedChunkIndex;
        // Bắt đầu phần tiếp theo bằng câu cuối của phần trước để làm khít dòng thời gian
        currentChunkBlocks = lastBlockOfPrevChunk ? [lastBlockOfPrevChunk] : [];
        chunkStartIndex = i;
      }
    }
    currentChunkBlocks.push(block);
  }

  if (currentChunkBlocks.length > 0) {
    const { start, end, endSeconds } = getBlockRange(currentChunkBlocks);
    const gridStart = chunks.length === 0 ? "00:00" : chunks[chunks.length - 1].endTime;
    
    const roundedEndSeconds = Math.max(
      (chunks.length + 1) * durationSeconds,
      Math.ceil(endSeconds / segmentDuration) * segmentDuration
    );
    
    chunks.push({
      id: chunks.length,
      startTime: start,
      endTime: end,
      gridStart: gridStart,
      gridEnd: end || secondsToMMSS(roundedEndSeconds),
      realEndTime: end,
      content: currentChunkBlocks.join('\n\n'),
      originalIndexStart: chunkStartIndex,
      originalIndexEnd: blocks.length
    });
  }

  return chunks;
};

export const generateStoryboardChunk = async (
  srtChunkContent: string,
  timeLabel: string,
  castList: string,
  segmentDuration: number,
  characterImage?: { data: string, mimeType: string } | null,
  previousContext?: ChunkContext | null,
  realEndTime?: string,
  subStyle: Doc3DSubStyle = 'mink_psychology',
  theme: Doc3DRenderTheme = 'clay_white',
  isFirstChunk: boolean = false,
  segmentMode: SegmentMode = 'dynamic_grid_4_9',
  includeCharactersPresent: boolean = false,
  includeCharactersAbsent: boolean = false,
  includeMotion: boolean = true,
  allowTextInImage: boolean = true,
  referenceImages?: ReferenceImageItem[],
  customStylePrompt?: string,
  chunkIndex?: number,
  allowLongerPacingFromPart3?: boolean,
  boostShortScenesPart1?: boolean
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("Mã API Gemini chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isFlexibleGrid = segmentMode === 'dynamic_grid_4_9' || segmentMode === 'dynamic_grid_468';
  const isPart1 = (chunkIndex === 0);
  const isPart3OrLater = (chunkIndex !== undefined && chunkIndex >= 2);
  const use8to14 = isFlexibleGrid && allowLongerPacingFromPart3 && isPart3OrLater;
  const usePart1ShortScenes = isFlexibleGrid && allowLongerPacingFromPart3 && boostShortScenesPart1 && isPart1;
  
  let prompt = `TARGET GRID RANGE: ${timeLabel}\n\nINPUT SUBTITLES:\n${srtChunkContent}\n\n`;

  if (isFirstChunk) {
    prompt += `*** FIRST SCENE ESTABLISHING RULE ***\n`;
    prompt += `The very first scene at 00:00 MUST establish the overall 3D spatial world (grand 3D isometric diorama or master spatial overview) to set the documentary stage.\n\n`;
  }

  if (referenceImages && referenceImages.length > 0) {
    prompt += `*** AVAILABLE REFERENCE IMAGES & PROPORTION ANCHORS ***\n`;
    prompt += `The following Reference Images have been created to anchor real-world scale, proportions, and visual fidelity.\n`;
    prompt += `RULES FOR REFERENCE IMAGE USAGE:\n`;
    prompt += `1. SELECTIVE LINKING ONLY: ONLY link a scene to a reference image if that specific scene actually depicts or takes place at that landmark/location. Set "reference_image": "@name" (e.g., "@cau_nhat_tan").\n`;
    prompt += `2. NO REFERENCE FOR OTHER SCENES: For scenes depicting abstract data, general charts, conceptual infographics, unrelated narrative moments, or generic backgrounds, you MUST set "reference_image": null (or omit). NOT every scene needs or uses a reference image.\n`;
    prompt += `3. WHEN LINKED: Incorporate its structural details, tower numbers, roadway scale, and geographic environment into "background" and "elements".\n\n`;
    prompt += `REFERENCE LIST:\n`;
    referenceImages.forEach(ref => {
      prompt += `- @${ref.name}: [${ref.subject}] (Bối cảnh: ${ref.context1 || ref.context2 || 'N/A'})\n  Prompt chuẩn: "${ref.fullPrompt}"\n`;
    });
    prompt += `\n`;
  }

  if (castList && castList.trim().length > 0) {
    prompt += `*** KEY ENTITIES / CAST IN 3D SCENE ***\n`;
    prompt += `ENTITIES / CAST:\n${castList}\n(Render as stylized miniature 3D figures or designated focal elements in the spatial diorama)\n\n`;
  }

  if (previousContext) {
    prompt += `\n*** CONTINUITY CONTEXT FROM PREVIOUS SCENE (LIÊN KẾT PHẦN TRƯỚC) ***\n`;
    prompt += `The narrative continues from the previous segment. Maintain spatial continuity in the 3D environment:\n`;
    if (previousContext.lastBackground) {
      prompt += `PREVIOUS 3D SETTING: "${previousContext.lastBackground}"\n`;
    }
    if (previousContext.lastVoiceover) {
      prompt += `PREVIOUS LAST VOICEOVER (CÂU CUỐI PHẦN TRƯỚC): "${previousContext.lastVoiceover}"\n`;
    }
    if (previousContext.lastEndTime) {
      prompt += `CRITICAL TIMELINE CONTINUITY (LÀM KHÍT DÒNG THỜI GIAN): The previous part ended at [${previousContext.lastEndTime}]. The FIRST scene of this part MUST start at [${previousContext.lastEndTime}] (or at the timestamp of the connecting last sentence) so that the timeline is 100% continuous with ZERO gap or silence.\n`;
    }
  }

  if (realEndTime) {
    prompt += `\n*** STRICT END TIME ***\n`;
    prompt += `The content ends strictly at: [${realEndTime}]. Do not generate scenes beyond this time.\n`;
  }

  if (isFlexibleGrid) {
    if (use8to14) {
      prompt += `INSTRUCTION: DYNAMIC 8s TO 14s FLEXIBLE TIME GRID (ÁP DỤNG CHO PHẦN ${(chunkIndex || 0) + 1} - TỪ PHẦN 3 TRỞ ĐI) & STRICT SUBTITLE SYNCHRONIZATION IS ACTIVE.\n`;
      prompt += `*** YÊU CẦU THỜI LƯỢNG: TỐI THIỂU 8s, CHO PHÉP ĐẾN 14s ***\n`;
      prompt += `1. THẤP NHẤT LÀ 8 GIÂY: Tuyệt đối không tạo cảnh ngắn dưới 8.0 giây trong phần này. Gộp các câu phụ đề ngắn liền kề để đạt thời lượng từ 8.0s đến 14.0s.\n`;
      prompt += `2. CẢNH KÉO DÀI ĐẾN 14 GIÂY: Cho phép các cảnh kéo dài 8.0s - 14.0s (ví dụ: 8s, 8.5s, 9s, 9.5s, 10s, 11s, 12s, 13s, 14s) giúp diễn đạt chiều sâu bối cảnh và camera di chuyển trầm tĩnh.\n`;
      prompt += `3. Visual content MUST faithfully and directly illustrate what is being spoken in the subtitle lines for that specific segment.\n`;
      prompt += `4. Fill "voiceover_context" with the EXACT subtitle text spoken in this time window. Do NOT hallucinate content from other parts of the script.\n`;
      prompt += `5. Time Header format: **[02:15 - 02:23]** (clean time header, strictly DO NOT add duration tags in the header or prompt). In JSON include "part": 1, 2...\n`;
      prompt += `6. Contiguous timeline without gaps` + (realEndTime ? `, stopping strictly at ${realEndTime}.` : ".\n");
    } else if (usePart1ShortScenes) {
      prompt += `INSTRUCTION: PHẦN 1 HOOK MỞ ĐẦU - TĂNG CƯỜNG SỐ CẢNH NGẮN NHỊP NHANH (3.5s - 5.5s / MAX 6.0s) & STRICT SUBTITLE-TO-VISUAL SYNCHRONIZATION IS ACTIVE.\n`;
      prompt += `*** YÊU CẦU ĐẶC BIỆT CHO PHẦN 1 (AUDIENCE RETENTION HOOK - TĂNG CẢNH NGẮN) ***\n`;
      prompt += `1. TĂNG TỐI ĐA SỐ CẢNH NGẮN: Chia nội dung thành NHIỀU CẢNH NGẮN có thời lượng từ 3.5s đến 5.5s (tối đa không quá 6.0s). Tuyệt đối KHÔNG gộp các câu thoại thành cảnh dài 7s-9s trong Phần 1 này.\n`;
      prompt += `2. Mỗi câu phụ đề hoặc một cụm ý thoại ngắn hãy cắt thành 1 phân cảnh 3D riêng biệt với góc máy và chuyển động mới (orbital rotation, push-in, cutaway, diorama cross-section) để tạo nhịp dựng nhanh, cuốn hút ngay phút đầu tiên.\n`;
      prompt += `3. Cảnh đầu tiên tại 00:00 là đại cảnh tổng quan sa bàn 3D (master establishing shot 4s-5s). Các cảnh ngay sau đó lập tức chuyển góc máy cận và chuyển động năng động.\n`;
      prompt += `4. Visual content MUST faithfully and directly illustrate what is being spoken in the subtitle lines for that specific segment.\n`;
      prompt += `5. Fill "voiceover_context" with the EXACT subtitle text spoken in this time window. Do NOT hallucinate content from other parts of the script.\n`;
      prompt += `6. The 3D scene MUST depict the specific objects, locations, and actions mentioned in that voiceover.\n`;
      prompt += `7. Time Header format: **[00:00 - 00:04.5]** or **[00:04.5 - 00:09]** (clean time header, strictly DO NOT add duration tags like <4>, <6>, <5.5> in the header or prompt). In JSON include "part": 1, 2...\n`;
      prompt += `8. Contiguous timeline without gaps` + (realEndTime ? `, stopping strictly at ${realEndTime}.` : ".\n");
    } else {
      prompt += `INSTRUCTION: DYNAMIC 4s TO 9s FLEXIBLE TIME GRID & STRICT SUBTITLE-TO-VISUAL SYNCHRONIZATION IS ACTIVE.\n`;
      if (allowLongerPacingFromPart3) {
        if (chunkIndex === 1) {
          prompt += `*** PACING CHO PHẦN 2: GIAI ĐOẠN CHUYỂN TIẾP NHỊP ĐỘ (4s - 8s) CHUẨN BỊ BƯỚC VÀO LƯỚI SÂU LẮNG 8s - 14s TỪ PHẦN 3 ***\n`;
        } else if (chunkIndex !== undefined && chunkIndex < 2) {
          prompt += `*** PACING CHO PHẦN ${chunkIndex + 1}: GIỮ NHỊP MỞ ĐẦU 4s - 9s ĐỂ CUỐN HÚT NGƯỜI XEM (LƯỚI MỞ RỘNG 8s - 14s SẼ ÁP DỤNG TỪ PHẦN 3) ***\n`;
        }
      }
      prompt += `*** CHỐNG LỆCH HÌNH ẢNH SO VỚI LỜI THOẠI (CRITICAL REQUIREMENT) ***\n`;
      prompt += `1. Visual content MUST faithfully and directly illustrate what is being spoken in the subtitle lines for that specific segment.\n`;
      prompt += `2. Fill "voiceover_context" with the EXACT subtitle text spoken in this time window. Do NOT hallucinate content from other parts of the script.\n`;
      prompt += `3. The 3D scene ("story_action", "elements", "background", "motion") MUST depict the specific objects, locations, and actions mentioned in that voiceover.\n`;
      prompt += `4. DURATION FLEXIBILITY (4.0s - 9.0s): Tailor each segment length between 4.0s and 9.0s (e.g., 4s, 4.5s, 5s, 5.5s, 6s, 6.5s, 7s, 7.5s, 8s, 8.5s, 9s) based on natural subtitle pauses and sentences.\n`;
      prompt += `5. Time Header format: **[00:00 - 00:05.5]** or **[00:00 - 00:06]** (clean time header, strictly DO NOT add duration tags like <4>, <6>, <5.5> in the header or prompt). In JSON include "part": 1, 2...\n`;
      prompt += `6. Contiguous timeline without gaps` + (realEndTime ? `, stopping strictly at ${realEndTime}.` : ".\n");
    }
  } else if (segmentMode === 'multi_prompt_line') {
    prompt += `INSTRUCTION: DYNAMIC MULTI-PROMPT PER SUBTITLE LINE MODE IS ACTIVE.\n`;
    prompt += `For EACH subtitle block in INPUT SUBTITLES above, generate the exact number of 3D prompts based on its duration (<= 6s -> 1 prompt, <= 12s -> 2 prompts, <= 16s -> 3 prompts, <= 20s -> 4 prompts):\n`;
    
    const blocks = srtChunkContent.split(/\n\n+/).filter(b => b.trim().length > 0);
    blocks.forEach((block, idx) => {
      const lines = block.split('\n');
      const timeLine = lines.find(l => l.includes('-->'));
      if (timeLine) {
        const parts = timeLine.split('-->');
        if (parts.length === 2) {
          const s = timestampToSeconds(parts[0].trim());
          const e = timestampToSeconds(parts[1].trim());
          const dur = Math.max(1, e - s);
          const count = getPromptCountForDuration(dur);
          const text = lines.slice(2).join(' ').trim();
          prompt += `\n- Subtitle #${idx + 1} [${parts[0].trim()} --> ${parts[1].trim()}] (${dur.toFixed(1)}s -> Generate EXACTLY ${count} prompt(s)): "${text}"\n`;
          const step = dur / count;
          for (let k = 0; k < count; k++) {
            const subStart = secondsToMMSS(s + k * step);
            const subEnd = secondsToMMSS(s + (k + 1) * step);
            prompt += `  * Part ${k + 1}/${count} Time Header: [${subStart} - ${subEnd}] (Include "part": ${k + 1} in JSON)\n`;
          }
        }
      }
    });
    prompt += `\nCRITICAL MULTI-PROMPT CONTINUITY IN 3D:\n`;
    prompt += `1. All 3D scenes for the same subtitle line must complement each other (e.g. Master isometric view -> Cutaway detail -> Focused highlight).\n`;
    prompt += `2. In 'motion': Focus on realistic in-shot 3D camera trajectory & kinetic spatial animation. In the final sentence of motion, seamlessly lead toward the physical visual subject/location of the next scene (STRICTLY PROHIBITED: NEVER write 'for Part 8', 'Part 2', or 'next Part' in the prompt text).\n`;
    prompt += `3. Keep the exact full sentence text in 'voiceover_context' for all Parts.\n`;
    if (referenceImages && referenceImages.length > 0) {
      prompt += `4. If any Part features an established location/bridge/building, explicitly link its "@name" in "reference_image".\n`;
    }
  } else if (segmentMode === 'line') {
    prompt += `INSTRUCTION: Generate exactly ONE 3D scene (JSON object) for EACH subtitle block in INPUT SUBTITLES.` + (realEndTime ? ` Stop strictly at ${realEndTime}.` : "");
  } else {
    prompt += `INSTRUCTION: Fill the grid range ${timeLabel} with ${segmentDuration}-second 3D segments` + (realEndTime ? `, stopping strictly at ${realEndTime}.` : ".");
  }
  
  const hasRefImages = !!(referenceImages && referenceImages.length > 0);
  const parts: any[] = [
    { text: getSystemPrompt(segmentDuration, subStyle, theme, includeCharactersPresent, includeCharactersAbsent, includeMotion, allowTextInImage, segmentMode, hasRefImages, customStylePrompt, chunkIndex, allowLongerPacingFromPart3, boostShortScenesPart1) },
    { text: prompt }
  ];

  if (characterImage) {
    parts.push({
      inlineData: {
        data: characterImage.data,
        mimeType: characterImage.mimeType
      }
    });
    parts.push({ text: "Reference visual styling for 3D miniature assets." });
  }

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3.7-flash', 
      contents: [
        { role: 'user', parts: parts }
      ],
      config: {
        thinkingConfig: { thinkingBudget: 4096 },
      }
    }));

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const analyzeReferenceImagesFromSubtitles = async (srt: string): Promise<ReferenceImageItem[]> => {
  if (!process.env.API_KEY) {
    throw new Error("Mã API Gemini chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
You are an expert Architectural & Geographical Visual Director specializing in scale-accurate reference image generation for 3D Documentary Storyboards & Dioramas.

OBJECTIVE:
Thoroughly analyze the provided SRT subtitles transcript and identify ALL key physical environments, landmarks, bridges, buildings, industrial zones, water bodies, urban districts, transport routes, energy projects, and critical infrastructure that should have Reference Images (Ảnh tham chiếu) to guarantee accurate architectural proportions, dimensions, and visual scale.

RICH DIVERSITY & EXTRACTION GUIDELINES:
1. COMPREHENSIVE CATEGORY COVERAGE (ĐA DẠNG HÓA DANH MỤC CÔNG TRÌNH & BỐI CẢNH):
   * Cầu & Hạ tầng Giao thông (Bridges & Transport): Cầu dây văng, cầu vượt biển, cầu thép vòm, nút giao lập thể đa tầng, hầm ngầm, đường cao tốc xuyên rừng/núi, tuyến metro trên cao.
   * Công trình Kiến trúc & Biểu tượng (Architecture & Landmarks): Tòa nhà chọc trời, trung tâm tài chính, bảo tàng hiện đại, nhà ga sân bay T2/T3, cung thể thao, tháp truyền hình.
   * Cảng biển, Khu công nghiệp & Logistics (Ports & Industrial): Cảng container nước sâu với cẩu bờ STS khổng lồ, luồng hàng hải, khu chế xuất công nghệ cao, cụm kho bãi logistics liên vùng.
   * Năng lượng & Công trình Trọng điểm (Energy & Power): Trang trại điện gió ngoài khơi (offshore wind turbines), nhà máy nhiệt điện/khí LNG, cánh đồng điện mặt trời, đập thủy điện bậc thang, giàn khoan dầu khí.
   * Đại đô thị, Bán đảo & Quy hoạch (Urban Districts & Planning): Khu đô thị sinh thái ven sông, bán đảo đô thị, trục tài chính trung tâm, vịnh biển du lịch phức hợp.
   * Địa hình Tự nhiên & Thủy văn (Topography & Waterways): Cửa sông lớn, vùng ngập mặn ven biển, vịnh đảo đá vôi, đèo dốc hiểm trở, thung lũng liên tỉnh.
   * Thiết bị Thi công & Phương tiện Đặc chủng (Specialized Equipment & Vessels): Tàu nạo vét luồng hàng hải, sà lan kéo dầm cầu tải trọng lớn, đoàn tàu metro tốc độ cao, máy đào hầm TBM.

2. DIVERSE PERSPECTIVES & SHOT ANGLES (ĐA DẠNG GÓC CHỤP MÁY TOÀN CẢNH):
   * NO CLOSE-UP / MACRO CROPS: Strictly avoid tight ground-level close-ups or cropped detail shots that lose structural context.
   * Utilize varied wide aerial angles tailored to the subject:
     - "high-angle 45-degree diagonal drone view, panoramic architectural overview" (cho tòa nhà, nút giao, diorama)
     - "direct top-down orthographic satellite/aerial planning view" (cho mặt bằng quy hoạch cảng biển, KCN, mạng lưới sông ngòi)
     - "sweeping wide-angle horizon panoramic view" (cho cầu dài vượt biển, cánh đồng điện gió, vịnh biển)
     - "symmetrical axial high-angle aerial perspective" (cho nhà ga sân bay, đập thủy điện, tháp đôi)

3. DIVERSE REAL-WORLD LIGHTING & ATMOSPHERE (ĐA DẠNG ÁNH SÁNG & KHÔNG GIAN):
   * "crisp, clear midday daylight with high architectural contrast and sharp geometry definition"
   * "dramatic golden hour sunset with warm orange and amber reflections across water surfaces and glass facades"
   * "early morning dawn with atmospheric low mist and soft warm sunlight"
   * "twilight blue hour with illuminated architectural accent lights, highway headlights, and city glow"

4. MULTIPLE DISTINCT VARIANTS: If a major landmark is central to the entire narrative, generate diverse angles/phases for it (e.g. general overview, construction phase, or different connecting approaches).

FOR EACH IDENTIFIED LOCATION/SUBJECT:
1. "name": A concise, clean identifier code in lowercase with underscores, suitable for @ tagging (e.g. "cau_nhat_tan", "song_hong", "thap_keangnam", "san_bay_long_thanh", "khu_do_thi_thu_thiem", "cang_cai_mep", "nha_may_dien_gio_bac_lieu").
2. "subject": The primary subject name in Vietnamese (e.g. "Cầu Nhật Tân, Hà Nội", "Cảng Quốc tế Cái Mép - Thị Vải", "Cánh đồng Điện gió Bạc Liêu").
3. "category": One of: "Cầu đường / Giao thông", "Kiến trúc / Landmark", "Cảng biển / KCN", "Năng lượng / Hạ tầng", "Đô thị / Địa lý", "Địa hình / Thủy văn", "Thiết bị / Phương tiện".
4. "context1": Primary immediate geographic/environmental context (e.g. "Sông Hồng", "luồng hàng hải Thị Vải", "vùng biển ven bờ Bạc Liêu").
5. "imageType": Image type/shot specification (e.g. "Ảnh chụp trên cao từ drone/flycam, góc rộng toàn cảnh (wide-angle aerial drone photography), độ phân giải cao").
6. "structureDetails": Architectural/engineering structural details capturing the entire scale and layout (e.g. "entire length, all five distinctive A-shaped cable-stayed towers, multi-lane roadway structure, full approach ramps").
7. "perspective": Wide-angle aerial camera perspective tailored to the subject.
8. "context2": Distant background context/surroundings (e.g. "expansive Hanoi city skyline, West Lake, connected highway network").
9. "lighting": Specific atmospheric lighting condition matching the scene's emotional tone.
10. "fullPrompt": Formatted EXACTLY according to this mandatory template:
"[Loại ảnh: {imageType}] về [Chủ thể chính: {subject}] spanning [Bối cảnh 1: {context1}]. The image showcases [Chi tiết cấu trúc: {structureDetails}]. The perspective is [Góc máy: {perspective}]. In the background, [Bối cảnh 2: {context2}]. Lighting is [Ánh sáng: {lighting}] to define all structures. The image is clean and free of text."

CRITICAL JSON OUTPUT FORMAT:
Return a valid JSON array of objects with keys: "id", "name", "subject", "category", "context1", "imageType", "structureDetails", "perspective", "context2", "lighting", "fullPrompt".

SUBTITLES TRANSCRIPT TO ANALYZE:
${srt}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const raw = response.text?.trim() || "[]";
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data.map((item: any, idx: number) => {
        const cleanName = (item.name || `ref_${idx + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/^_+|_+$/g, '');
        
        const formattedPrompt = item.fullPrompt || formatReferenceImagePrompt({
          imageType: item.imageType,
          subject: item.subject,
          context1: item.context1,
          structureDetails: item.structureDetails,
          perspective: item.perspective,
          context2: item.context2,
          lighting: item.lighting
        });

        // Determine category fallback if missing
        let cat = item.category;
        if (!cat) {
          const s = (item.subject + " " + item.name + " " + (item.structureDetails || "")).toLowerCase();
          if (s.includes("cầu") || s.includes("đường") || s.includes("hầm") || s.includes("cao tốc") || s.includes("metro") || s.includes("giao thông")) {
            cat = "Cầu đường / Giao thông";
          } else if (s.includes("cảng") || s.includes("khu công nghiệp") || s.includes("kcn") || s.includes("kho bãi") || s.includes("logistics")) {
            cat = "Cảng biển / KCN";
          } else if (s.includes("điện") || s.includes("gió") || s.includes("mặt trời") || s.includes("thủy điện") || s.includes("năng lượng") || s.includes("dầu khí")) {
            cat = "Năng lượng / Hạ tầng";
          } else if (s.includes("tòa nhà") || s.includes("tháp") || s.includes("sân bay") || s.includes("nhà ga") || s.includes("landmark") || s.includes("bảo tàng")) {
            cat = "Kiến trúc / Landmark";
          } else if (s.includes("đô thị") || s.includes("thành phố") || s.includes("quận") || s.includes("bán đảo") || s.includes("quy hoạch")) {
            cat = "Đô thị / Địa lý";
          } else if (s.includes("sông") || s.includes("biển") || s.includes("vịnh") || s.includes("đèo") || s.includes("núi") || s.includes("thung lũng")) {
            cat = "Địa hình / Thủy văn";
          } else {
            cat = "Cầu đường / Giao thông";
          }
        }

        return {
          id: item.id || `ref_${Date.now()}_${idx}`,
          name: cleanName || `ref_${idx + 1}`,
          subject: item.subject || 'Bối cảnh tham chiếu',
          category: cat,
          context1: item.context1 || '',
          imageType: item.imageType || 'Ảnh chụp trên cao từ drone/flycam, góc rộng toàn cảnh (wide-angle aerial drone photography), độ phân giải cao',
          structureDetails: item.structureDetails || 'chi tiết cấu trúc kiến trúc và tỉ lệ thực tế',
          perspective: item.perspective || 'high-angle wide aerial view, panoramic overview of full structure and surrounding terrain',
          context2: item.context2 || 'khung cảnh xung quanh mở rộng',
          lighting: item.lighting || 'natural, clear daylight to accurately define all authentic structures',
          fullPrompt: formattedPrompt
        };
      });
    }
    return [];
  } catch (error) {
    console.error("Reference Image Analysis Error:", error);
    throw error;
  }
};

export const analyzeCastFromSubtitles = async (srt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("Mã API Gemini chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
You are an expert 3D Storyboard Analyst. 
Analyze the provided subtitles (SRT format) and identify all key entities, subjects, locations, or characters mentioned.
For people, estimate their age or role: "Name(Age age)". For key buildings/facilities/vehicles, list their name.

OUTPUT FORMAT:
Return ONLY a concise list separated by commas.
Example: Tháp trung tâm(Tòa nhà 68 tầng), Đội cứu hộ(30 age), Xe tuần tra chuyên dụng

SUBTITLES:
${srt}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Cast Analysis Error:", error);
    throw error;
  }
};

export const sanitizeMotionPrompt = (motionText?: string): string => {
  if (!motionText || typeof motionText !== 'string') return '';
  // Remove patterns like "for Part 8.", "for Part 2", "leading into Part 3", "transitioning to Part 4", "for next Part", "into Part X"
  let cleaned = motionText
    .replace(/\s+(?:for|leading into|transitioning to|into|towards)\s+Part\s+\d+([.,;]?)/gi, '$1')
    .replace(/\s+(?:for|leading into|transitioning to|into|towards)\s+(?:the\s+)?next\s+Part([.,;]?)/gi, '$1')
    .replace(/\s+for\s+Part\s*([.,;]?)/gi, '$1');
  
  // Clean up any double spaces or dangling punctuation
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
  return cleaned;
};

export const parseStoryboardOutput = (rawText: string): StoryboardSegment[] => {
  const segments: StoryboardSegment[] = [];
  
  // Matches header format like:
  // **<6> [00:00 - 00:06]** or **<5.5> [00:00 - 00:05.5]** or **[00:00 - 00:06] <6>** or [00:00 - 00:06]
  const headerRegex = /(?:^|\n)\s*(?:[\[\*\*\s\(]|Time:|<(?:\d+(?:[.,]\d+)?)>)*\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*[-–]\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*(?:[\]\*\*\s\)]|:|<(?:\d+(?:[.,]\d+)?)>)*(?:\n|$)/g;
  
  let match;
  const matches = [];
  
  while ((match = headerRegex.exec(rawText)) !== null) {
    // Check for duration tag in the full matched header string or immediately before/after
    const matchedFull = match[0];
    const tagMatch = /<([0-9]+(?:[.,][0-9]+)?)>/.exec(matchedFull);
    const durationTag = tagMatch ? `<${tagMatch[1].replace(',', '.')}>` : undefined;

    matches.push({
      timeRange: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      headerTag: durationTag
    });
  }

  const helperDetermineDurationTag = (timeRange: string, json: any, headerTag?: string): string | undefined => {
    if (headerTag) return headerTag;
    if (json) {
      if (json.duration_tag) {
        const match = /<([0-9]+(?:[.,][0-9]+)?)>|([0-9]+(?:[.,][0-9]+)?)/.exec(String(json.duration_tag));
        if (match) {
          const val = (match[1] || match[2]).replace(',', '.');
          return `<${val}>`;
        }
      }
      if (typeof json.duration === 'number' || typeof json.duration === 'string') {
        const match = /<([0-9]+(?:[.,][0-9]+)?)>|([0-9]+(?:[.,][0-9]+)?)/.exec(String(json.duration));
        if (match) {
          const val = (match[1] || match[2]).replace(',', '.');
          return `<${val}>`;
        }
      }
    }
    // Calculate from timeRange difference
    if (timeRange && timeRange.includes('-')) {
      const parts = timeRange.split(/[-–]/).map(p => p.trim());
      if (parts.length === 2) {
        const s = timestampToSeconds(parts[0]);
        const e = timestampToSeconds(parts[1]);
        const diff = Math.round((e - s) * 10) / 10;
        if (diff > 0) {
          return `<${diff}>`;
        }
      }
    }
    return undefined;
  };

  if (matches.length === 0) {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          return arr.map((item, idx) => {
            if (item && item.motion) {
              item.motion = sanitizeMotionPrompt(item.motion);
            }
            const timeRange = item.timeRange || item.time || `Scene ${idx + 1}`;
            const durationTag = helperDetermineDurationTag(timeRange, item);
            return {
              timeRange,
              jsonContent: item,
              rawJson: JSON.stringify(item, null, 2),
              part: typeof item.part === 'number' ? item.part : undefined,
              durationTag
            };
          });
        }
      } catch (err) {}
    } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj && obj.motion) {
          obj.motion = sanitizeMotionPrompt(obj.motion);
        }
        const timeRange = obj.timeRange || obj.time || "00:00 - 00:06";
        const durationTag = helperDetermineDurationTag(timeRange, obj);
        return [{
          timeRange,
          jsonContent: obj,
          rawJson: JSON.stringify(obj, null, 2),
          part: typeof obj.part === 'number' ? obj.part : undefined,
          durationTag
        }];
      } catch (err) {}
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i+1];
    
    const contentStart = current.endIndex;
    const contentEnd = next ? next.startIndex : rawText.length;
    const contentBlock = rawText.slice(contentStart, contentEnd).trim();

    const firstBrace = contentBlock.indexOf('{');
    const lastBrace = contentBlock.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const rawJson = contentBlock.slice(firstBrace, lastBrace + 1);
      try {
        const sanitizedJson = rawJson.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        const jsonContent = JSON.parse(sanitizedJson);
        if (jsonContent && jsonContent.motion) {
          jsonContent.motion = sanitizeMotionPrompt(jsonContent.motion);
        }
        const part = typeof jsonContent.part === 'number' ? jsonContent.part : undefined;
        const durationTag = helperDetermineDurationTag(current.timeRange, jsonContent, current.headerTag);
        segments.push({
          timeRange: current.timeRange,
          jsonContent,
          rawJson: JSON.stringify(jsonContent, null, 2),
          part,
          durationTag
        });
      } catch (e) {
        try {
          const cleanJson = rawJson.replace(/,\s*}/g, '}');
          const jsonContent = JSON.parse(cleanJson);
          if (jsonContent && jsonContent.motion) {
            jsonContent.motion = sanitizeMotionPrompt(jsonContent.motion);
          }
          const part = typeof jsonContent.part === 'number' ? jsonContent.part : undefined;
          const durationTag = helperDetermineDurationTag(current.timeRange, jsonContent, current.headerTag);
          segments.push({
            timeRange: current.timeRange,
            jsonContent,
            rawJson: JSON.stringify(jsonContent, null, 2),
            part,
            durationTag
          });
        } catch (e2) {
          const durationTag = helperDetermineDurationTag(current.timeRange, null, current.headerTag);
          segments.push({
            timeRange: current.timeRange,
            jsonContent: null,
            rawJson: rawJson,
            durationTag
          });
        }
      }
    } else {
      if (contentBlock.length > 0) {
        const durationTag = helperDetermineDurationTag(current.timeRange, null, current.headerTag);
        segments.push({
          timeRange: current.timeRange,
          jsonContent: null,
          rawJson: contentBlock,
          durationTag
        });
      }
    }
  }

  return segments;
};
