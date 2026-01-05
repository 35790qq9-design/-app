
import { OCRText } from "../types";

/**
 * 本地模拟图片分析功能
 * 无需 API 密钥，完全在本地处理
 */
export const analyzeImage = async (base64: string, fileName: string = ""): Promise<{ category: string, description: string, texts: OCRText[] }> => {
  // 模拟识别处理的延迟感
  await new Promise(resolve => setTimeout(resolve, 1000));

  const name = fileName.toLowerCase();
  let category = "常规文档";
  let description = "系统已自动扫描并识别该本地文件。";

  // 根据文件名简单模拟识别逻辑
  if (name.includes("screen") || name.includes("截图")) {
    category = "屏幕截图";
    description = "检测到这是一张屏幕截图，已自动归类。";
  } else if (name.includes("receipt") || name.includes("发票") || name.includes("收据")) {
    category = "财务票据";
    description = "检测到票据特征，建议保存至财务文件夹。";
  } else if (name.includes("note") || name.includes("笔记")) {
    category = "手写笔记";
    description = "已识别文字内容并转换为可编辑模式。";
  }

  return {
    category,
    description,
    texts: [
      { id: `ocr-1-${Date.now()}`, text: category, x: 20, y: 20 },
      { id: `ocr-2-${Date.now()}`, text: "点击此处编辑文字", x: 50, y: 50 },
      { id: `ocr-3-${Date.now()}`, text: "本地模式运行中", x: 80, y: 80 }
    ]
  };
};

export const startLiveSession = async () => {
  console.warn("语音助手在本地模式下已禁用。");
  return null;
};

export const decodeBase64Audio = (base64: string) => new Uint8Array();
export const encodeAudioPCM = (data: Float32Array) => "";
