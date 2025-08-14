/**
 * AI Chat Service using Gemini API directly with OpenRouter fallback
 * Hỗ trợ chat với AI để tham khảo về dự án và xử lý file đính kèm
 */

// API keys
const GEMINI_API_KEY = 'AIzaSyAaCTmvZ4uHzQCrrAnatsaTrEzSRsESZVE';
const OPENROUTER_API_KEY =
  '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';

// API endpoints
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model configuration
const DEFAULT_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODEL = 'google/gemini-2.5-pro';

// Data sources for contextual enrichment
import { getQuotationsByProject } from './quotationService';

// Helper: extract plain text from Gemini response parts
const extractTextFromGemini = (data) => {
  try {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
  } catch (e) {
    return '';
  }
};

/**
 * Xử lý file đính kèm để gửi đến AI
 * @param {Array} attachments - Mảng file đính kèm
 * @returns {Object} Thông tin file đã xử lý
 */
const processAttachments = (attachments) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const processedAttachments = {
    images: [],
    documents: [],
    summary: '',
  };

  attachments.forEach((attachment) => {
    if (attachment.type === 'image') {
      processedAttachments.images.push({
        name: attachment.name,
        size: attachment.size,
        uri: attachment.uri,
        type: 'image',
      });
    } else {
      processedAttachments.documents.push({
        name: attachment.name,
        size: attachment.size,
        type: 'document',
        extension: attachment.name.split('.').pop()?.toLowerCase(),
      });
    }
  });

  // Tạo mô tả tổng hợp về file đính kèm
  if (processedAttachments.images.length > 0) {
    processedAttachments.summary += `[Đính kèm ${processedAttachments.images.length} ảnh] `;
  }
  if (processedAttachments.documents.length > 0) {
    processedAttachments.summary += `[Đính kèm ${
      processedAttachments.documents.length
    } tài liệu: ${processedAttachments.documents
      .map((doc) => doc.name)
      .join(', ')}] `;
  }

  return processedAttachments;
};

/**
 * Tạo prompt mô tả file đính kèm
 * @param {Object} attachments - Thông tin file đính kèm
 * @returns {string} Mô tả file đính kèm
 */
const createAttachmentPrompt = (attachments) => {
  if (!attachments) return '';

  let prompt = '\n\n**File đính kèm:**\n';

  if (attachments.images.length > 0) {
    prompt += `- Ảnh (${attachments.images.length} file): `;
    attachments.images.forEach((img, index) => {
      prompt += `${img.name} (${(img.size / 1024).toFixed(1)} KB)`;
      if (index < attachments.images.length - 1) prompt += ', ';
    });
    prompt += '\n';
  }

  if (attachments.documents.length > 0) {
    prompt += `- Tài liệu (${attachments.documents.length} file): `;
    attachments.documents.forEach((doc, index) => {
      prompt += `${doc.name} (${(doc.size / 1024).toFixed(1)} KB, ${
        doc.extension?.toUpperCase() || 'Unknown'
      })`;
      if (index < attachments.documents.length - 1) prompt += ', ';
    });
    prompt += '\n';
  }

  prompt += '\n**Hướng dẫn xử lý file đính kèm:**\n';
  prompt += '- Nếu có ảnh, hãy mô tả nội dung ảnh và đưa ra nhận xét phù hợp\n';
  prompt +=
    '- Nếu có tài liệu, hãy đưa ra lời khuyên về cách xử lý hoặc phân tích tài liệu\n';
  prompt +=
    '- Kết hợp thông tin từ file đính kèm với câu hỏi của người dùng để đưa ra câu trả lời toàn diện\n';

  return prompt;
};

/**
 * Gửi tin nhắn đến AI sử dụng Gemini API trực tiếp
 * @param {Array} messages - Mảng tin nhắn (role: 'user' | 'assistant', content: string)
 * @param {string} model - Model AI (mặc định: gemini-2.0-flash)
 * @param {Object} options - Tùy chọn bổ sung
 * @returns {Promise<Object>} Phản hồi từ AI
 */
export const sendMessageToGemini = async (
  messages,
  model = DEFAULT_MODEL,
  options = {}
) => {
  try {
    // Chuyển đổi format từ OpenRouter sang Gemini
    const contents = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const doRequest = async () => {
      const requestBody = {
        contents: contents,
        generationConfig: {
          // Increase default cap; allow override via options
          maxOutputTokens: options.maxTokens || 10000,
          temperature: options.temperature || 0.7,
          topP: 0.8,
          topK: 40,
        },
      };

      console.log('Sending request to Gemini API:', {
        url: GEMINI_API_URL,
        model,
        maxTokens: requestBody.generationConfig.maxOutputTokens,
        messageCount: messages.length,
      });

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gemini API response:', data);
      return data;
    };
    // First request
    let data = await doRequest();

    if (!data?.candidates?.[0]?.content) {
      throw new Error('Invalid response format from Gemini API');
    }

    let resultText = extractTextFromGemini(data);
    let finishReason = data?.candidates?.[0]?.finishReason;

    // Aggregate usage across continuations
    const usageAgg = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.completionTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
    };

    // Auto-continue if truncated by token limit
    const allowAutoContinue = options.autoContinue !== false; // default true
    let continues = 0;
    const maxContinues = options.maxContinues || 3;

    while (
      allowAutoContinue &&
      finishReason === 'MAX_TOKENS' &&
      continues < maxContinues
    ) {
      continues += 1;

      // Build follow-up conversation: include previous assistant output and ask to continue
      const followupMessages = [
        ...messages,
        { role: 'assistant', content: resultText },
        {
          role: 'user',
          content:
            'Hãy tiếp tục phần trả lời đang dang dở ở trên. Đừng lặp lại nội dung đã trả lời, chỉ viết phần còn lại.',
        },
      ];

      // Convert to Gemini format for the next call
      const followupContents = followupMessages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Rebind contents for the next request
      contents.splice(0, contents.length, ...followupContents);

      const moreData = await doRequest();

      const moreText = extractTextFromGemini(moreData);
      resultText += moreText ? `\n${moreText}` : '';
      finishReason = moreData?.candidates?.[0]?.finishReason;

      usageAgg.promptTokens += moreData.usageMetadata?.promptTokenCount || 0;
      usageAgg.completionTokens +=
        moreData.usageMetadata?.completionTokenCount || 0;
      usageAgg.totalTokens += moreData.usageMetadata?.totalTokenCount || 0;
    }

    return {
      success: true,
      data,
      message: resultText,
      model,
      usage: usageAgg,
      finishReason,
      continued: continues > 0,
      continues,
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
};

/**
 * Gửi tin nhắn đến AI sử dụng OpenRouter API (fallback)
 * @param {Array} messages - Mảng tin nhắn (role: 'user' | 'assistant', content: string)
 * @param {string} model - Model AI (mặc định: google/gemini-2.5-pro)
 * @param {Object} options - Tùy chọn bổ sung
 * @returns {Promise<Object>} Phản hồi từ AI
 */
export const sendMessageToOpenRouter = async (
  messages,
  model = FALLBACK_MODEL,
  options = {}
) => {
  try {
    const doRequest = async (payloadMessages) => {
      const requestBody = {
        model: model,
        messages: payloadMessages,
        max_tokens: options.maxTokens || 10000,
        temperature: options.temperature || 0.7,
        stream: false,
        tools: options.tools || undefined,
        tool_choice: options.toolChoice || undefined,
      };

      console.log('Sending request to OpenRouter API (fallback):', {
        model,
        messageCount: payloadMessages.length,
        maxTokens: requestBody.max_tokens,
      });

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://thpapp.com',
          'X-Title': 'THP App - AI Assistant',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log('OpenRouter API response:', data);
      return data;
    };

    // First request
    let data = await doRequest(messages);

    if (!data?.choices?.[0]?.message) {
      throw new Error('Invalid response format from OpenRouter API');
    }

    let resultText = data.choices[0].message.content || '';
    let finishReason = data.choices[0].finish_reason;
    const usageAgg = {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    };

    const allowAutoContinue = options.autoContinue !== false;
    let continues = 0;
    const maxContinues = options.maxContinues || 3;

    while (
      allowAutoContinue &&
      finishReason === 'length' &&
      continues < maxContinues
    ) {
      continues += 1;
      const followup = [
        ...messages,
        { role: 'assistant', content: resultText },
        {
          role: 'user',
          content: 'Hãy tiếp tục phần trả lời ở trên, không lặp lại.',
        },
      ];
      const more = await doRequest(followup);
      const moreText = more?.choices?.[0]?.message?.content || '';
      resultText += moreText ? `\n${moreText}` : '';
      finishReason = more?.choices?.[0]?.finish_reason;
      usageAgg.promptTokens += more.usage?.prompt_tokens || 0;
      usageAgg.completionTokens += more.usage?.completion_tokens || 0;
      usageAgg.totalTokens += more.usage?.total_tokens || 0;
    }

    return {
      success: true,
      data,
      message: resultText,
      model: data.model,
      usage: usageAgg,
      finishReason,
      continued: continues > 0,
      continues,
    };
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    throw error;
  }
};

/**
 * Gửi tin nhắn đến AI với fallback tự động
 * @param {Array} messages - Mảng tin nhắn (role: 'user' | 'assistant', content: string)
 * @param {string} model - Model AI
 * @param {Object} options - Tùy chọn bổ sung
 * @returns {Promise<Object>} Phản hồi từ AI
 */
export const sendMessageToAI = async (
  messages,
  model = DEFAULT_MODEL,
  options = {}
) => {
  try {
    // Thử Gemini API trước
    console.log('Trying Gemini API first...');
    return await sendMessageToGemini(messages, model, options);
  } catch (error) {
    console.log('Gemini API failed, trying OpenRouter as fallback...');
    try {
      // Nếu Gemini thất bại, sử dụng OpenRouter
      return await sendMessageToOpenRouter(messages, FALLBACK_MODEL, options);
    } catch (fallbackError) {
      console.error('Both APIs failed:', {
        gemini: error.message,
        openrouter: fallbackError.message,
      });
      throw new Error(
        `Cả hai API đều thất bại. Gemini: ${error.message}, OpenRouter: ${fallbackError.message}`
      );
    }
  }
};

/**
 * Tạo prompt context cho dự án
 * @param {Object} project - Thông tin dự án
 * @returns {string} Prompt context
 */
export const createProjectContextPrompt = (project) => {
  if (!project) return '';

  let contextPrompt = `Bạn là trợ lý AI chuyên nghiệp của Công ty Cơ Khí Tân Hòa Phát - một công ty chuyên sản xuất bồn công nghiệp tại Thành phố Hồ Chí Minh. Bạn có kiến thức sâu rộng về ngành cơ khí, sản xuất bồn công nghiệp và quản lý dự án sản xuất.

**Thông tin công ty:**
- Tên công ty: Cơ Khí Tân Hòa Phát
- Lĩnh vực: Sản xuất bồn công nghiệp
- Địa điểm: Thành phố Hồ Chí Minh
- Chuyên môn: Cơ khí, hàn, gia công kim loại, sản xuất thiết bị công nghiệp

**Thông tin dự án:**
- Tên dự án: ${project.name || 'Không có tên'}
- Mô tả: ${project.description || 'Không có mô tả'}
- Trạng thái: ${project.status || 'Không xác định'}
- Khách hàng: ${project.customerName || 'Không có thông tin'}
- Ngày bắt đầu: ${project.startDate || 'Không xác định'}
- Ngày kết thúc dự kiến: ${project.endDate || 'Không xác định'}`;

  // Thêm thông tin về các công đoạn sản xuất
  if (project.workflowStages && project.workflowStages.length > 0) {
    contextPrompt += `\n\n**Các công đoạn sản xuất:**
${project.workflowStages
  .map(
    (stage) =>
      `- ${stage.name || stage.processKey}: ${stage.status || 'Chưa xác định'}`
  )
  .join('\n')}`;
  }

  // Thêm thông tin về ngân sách nếu có
  if (project.budget) {
    contextPrompt += `\n\n**Ngân sách dự án:** ${project.budget}`;
  }

  // Thêm thông tin về nhân viên nếu có
  if (project.workers && project.workers.length > 0) {
    contextPrompt += `\n\n**Nhân viên tham gia:** ${project.workers.length} người`;
  }

  contextPrompt += `

**Hướng dẫn trả lời:**
- Trả lời bằng tiếng Việt với phong cách chuyên nghiệp của một trợ lý công ty cơ khí
- Sử dụng thuật ngữ kỹ thuật phù hợp với ngành cơ khí và sản xuất bồn công nghiệp
- Đưa ra lời khuyên cụ thể, thực tế dựa trên kinh nghiệm sản xuất công nghiệp
- Thể hiện sự am hiểu về quy trình sản xuất, tiêu chuẩn chất lượng và an toàn lao động
- Nếu cần thêm thông tin, hãy yêu cầu người dùng cung cấp một cách lịch sự
- Luôn giữ giọng điệu chuyên nghiệp, đáng tin cậy như một chuyên gia trong lĩnh vực cơ khí
- Khi đề cập đến các vấn đề kỹ thuật, hãy giải thích rõ ràng và dễ hiểu

Hãy trả lời các câu hỏi của người dùng về dự án này một cách hữu ích, chính xác và thể hiện sự chuyên nghiệp của Công ty Cơ Khí Tân Hòa Phát.`;

  return contextPrompt;
};

/**
 * Gửi câu hỏi về dự án đến AI
 * @param {string} question - Câu hỏi của người dùng
 * @param {Object} project - Thông tin dự án
 * @param {Array} chatHistory - Lịch sử chat
 * @param {Array} attachments - File đính kèm (tùy chọn)
 * @returns {Promise<Object>} Phản hồi từ AI
 */
export const askAboutProject = async (
  question,
  project,
  chatHistory = [],
  attachments = []
) => {
  try {
    // Xử lý file đính kèm
    const processedAttachments = processAttachments(attachments);

    // Tạo context prompt
    let contextPrompt = createProjectContextPrompt(project);

    // Thêm lịch sử báo giá mới nhất (chỉ khi lần đầu mở chat của dự án)
    const recentHistory = chatHistory.slice(-15);
    if (project?.id && recentHistory.length === 0) {
      try {
        const quotations = await getQuotationsByProject(project.id);
        const latestQuotations = (quotations || []).slice(0, 1).map((q) => ({
          id: q.id,
          title: q.title || q.name || undefined,
          customerName: q.customerName || q.customer?.name || undefined,
          totalAmount: q.totalAmount || q.total || undefined,
          currency: q.currency || 'VND',
          itemsCount: Array.isArray(q.items) ? q.items.length : undefined,
          pdfUrl: q.pdfUrl || undefined,
          createdAt:
            (q.createdAt?.toDate?.() && q.createdAt.toDate().toISOString()) ||
            q.createdAt ||
            undefined,
        }));

        if (latestQuotations.length > 0) {
          const quotationContext = `\n\n**Báo giá gần nhất (JSON):**\n${JSON.stringify(
            latestQuotations[0],
            null,
            2
          )}`;
          contextPrompt += quotationContext;
        }
      } catch (e) {
        console.warn('Không thể lấy lịch sử báo giá để thêm context:', e);
      }
    }

    // Xây dựng messages array
    const messages = [];

    // Thêm system message với context
    if (contextPrompt) {
      messages.push({
        role: 'system',
        content: contextPrompt,
      });
    }

    // Thêm lịch sử chat (giới hạn 15 tin nhắn gần nhất để tránh quá dài)
    messages.push(...recentHistory);

    // Tạo nội dung tin nhắn với file đính kèm
    let userContent = question;
    if (processedAttachments) {
      userContent += createAttachmentPrompt(processedAttachments);
    }

    // Thêm câu hỏi hiện tại
    messages.push({
      role: 'user',
      content: userContent,
    });

    console.log('Sending project question to AI:', {
      projectName: project?.name,
      questionLength: question.length,
      historyLength: recentHistory.length,
      hasAttachments: !!processedAttachments,
      attachmentCount: attachments.length,
    });

    // Gửi đến AI
    const response = await sendMessageToAI(messages, DEFAULT_MODEL, {
      maxTokens: 10000,
      temperature: 0.7,
    });
    return response;
  } catch (error) {
    console.error('Error asking about project:', error);
    return {
      success: false,
      error: error.message,
      message: 'Có lỗi xảy ra khi gửi câu hỏi về dự án',
    };
  }
};

/**
 * Gửi câu hỏi chung đến AI (không liên quan đến dự án cụ thể)
 * @param {string} question - Câu hỏi của người dùng
 * @param {Array} chatHistory - Lịch sử chat
 * @param {Array} attachments - File đính kèm (tùy chọn)
 * @returns {Promise<Object>} Phản hồi từ AI
 */
export const askGeneralQuestion = async (
  question,
  chatHistory = [],
  attachments = []
) => {
  try {
    // Xử lý file đính kèm
    const processedAttachments = processAttachments(attachments);

    const systemMessage = {
      role: 'system',
      content:
        'Bạn là trợ lý AI chuyên nghiệp của Công ty Cơ Khí Tân Hòa Phát - chuyên sản xuất bồn công nghiệp tại TP.HCM. Bạn có kiến thức sâu rộng về ngành cơ khí, sản xuất công nghiệp và quản lý dự án. Trả lời bằng tiếng Việt với phong cách chuyên nghiệp, sử dụng thuật ngữ kỹ thuật phù hợp và đưa ra lời khuyên thực tế dựa trên kinh nghiệm sản xuất công nghiệp.',
    };

    const messages = [systemMessage];

    // Thêm lịch sử chat gần nhất
    const recentHistory = chatHistory.slice(-10);
    messages.push(...recentHistory);

    // Tạo nội dung tin nhắn với file đính kèm
    let userContent = question;
    if (processedAttachments) {
      userContent += createAttachmentPrompt(processedAttachments);
    }

    // Thêm câu hỏi hiện tại
    messages.push({
      role: 'user',
      content: userContent,
    });

    console.log('Sending general question to AI:', {
      questionLength: question.length,
      historyLength: recentHistory.length,
      hasAttachments: !!processedAttachments,
      attachmentCount: attachments.length,
    });

    const response = await sendMessageToAI(messages, DEFAULT_MODEL, {
      maxTokens: 10000,
      temperature: 0.7,
    });
    return response;
  } catch (error) {
    console.error('Error asking general question:', error);
    return {
      success: false,
      error: error.message,
      message: 'Có lỗi xảy ra khi gửi câu hỏi',
    };
  }
};

/**
 * Tạo câu hỏi gợi ý cho người dùng
 * @param {Object} project - Thông tin dự án
 * @returns {Array} Danh sách câu hỏi gợi ý
 */
export const getSuggestedQuestions = (project = null) => {
  if (project) {
    return [
      `Dự án "${project.name}" đang ở giai đoạn nào?`,
      'Cần làm gì để đẩy nhanh tiến độ dự án?',
      'Có vấn đề gì cần lưu ý trong dự án này?',
      'Làm thế nào để tối ưu hóa quy trình sản xuất?',
      'Cần chuẩn bị gì cho giai đoạn tiếp theo?',
    ];
  }

  return [
    'Làm thế nào để quản lý dự án sản xuất bồn công nghiệp hiệu quả?',
    'Các tiêu chuẩn chất lượng trong sản xuất bồn công nghiệp?',
    'Quy trình hàn và gia công kim loại cho bồn công nghiệp?',
    'Cách xử lý rủi ro an toàn lao động trong sản xuất cơ khí?',
    'Làm thế nào để tối ưu hóa chi phí sản xuất cơ khí?',
  ];
};
