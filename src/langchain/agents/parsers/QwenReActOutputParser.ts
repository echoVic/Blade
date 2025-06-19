/**
 * 通义千问 ReAct 输出解析器
 *
 * 专门适配通义千问模型的中文 ReAct 格式输出解析
 * 支持中英文混合的关键字识别
 */

import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { BaseOutputParser, OutputParserException } from '@langchain/core/output_parsers';

/**
 * 通义千问 ReAct 输出格式解析器
 *
 * 支持以下中文关键字格式：
 *
 * 执行动作时：
 * ```
 * 思考: 我需要搜索相关信息
 * 动作: search
 * 动作输入: 搜索内容
 * ```
 *
 * 或英文格式：
 * ```
 * Thought: I need to search for information
 * Action: search
 * Action Input: search content
 * ```
 *
 * 完成时：
 * ```
 * 思考: 我已经找到了答案
 * 最终答案: 这是最终的答案
 * ```
 *
 * 或英文格式：
 * ```
 * Thought: I have found the answer
 * Final Answer: This is the final answer
 * ```
 */
export class QwenReActOutputParser extends BaseOutputParser<AgentAction | AgentFinish> {
  lc_namespace = ['blade-ai', 'agents', 'parsers'];

  /**
   * 中文关键字模式
   */
  private readonly chineseKeywords = {
    thought: ['思考', '推理', '分析'],
    action: ['动作', '行动', '操作'],
    actionInput: ['动作输入', '操作输入', '输入'],
    finalAnswer: ['最终答案', '答案', '结果'],
  };

  /**
   * 英文关键字模式
   */
  private readonly englishKeywords = {
    thought: ['thought', 'thinking'],
    action: ['action'],
    actionInput: ['action input', 'input'],
    finalAnswer: ['final answer', 'answer'],
  };

  /**
   * 格式化指令
   */
  getFormatInstructions(): string {
    return `请按照以下格式回答：

如果需要使用工具：
思考: 描述你的思考过程
动作: 工具名称
动作输入: 工具的输入参数

如果有最终答案：
思考: 描述你的思考过程
最终答案: 你的最终答案

注意：
- 每行都要以对应的关键字开头，后面跟冒号
- 支持中英文关键字混用
- 英文格式：Thought:, Action:, Action Input:, Final Answer:
- 中文格式：思考:, 动作:, 动作输入:, 最终答案:`;
  }

  /**
   * 解析模型输出
   */
  async parse(text: string): Promise<AgentAction | AgentFinish> {
    const cleanText = text.trim();

    // 检查是否包含最终答案
    const finalAnswerMatch = this.extractFinalAnswer(cleanText);
    if (finalAnswerMatch) {
      return {
        returnValues: { output: finalAnswerMatch.trim() },
        log: cleanText,
      };
    }

    // 尝试解析动作
    const actionMatch = this.extractAction(cleanText);
    if (actionMatch) {
      const { action, actionInput } = actionMatch;
      return {
        tool: action.trim(),
        toolInput: actionInput.trim(),
        log: cleanText,
      };
    }

    // 如果无法解析，抛出异常
    throw new OutputParserException(
      `无法解析模型输出。请确保输出包含正确的关键字格式。\n输出内容: ${cleanText}`,
      cleanText
    );
  }

  /**
   * 提取最终答案
   */
  private extractFinalAnswer(text: string): string | null {
    // 合并中英文关键字
    const allFinalAnswerKeywords = [
      ...this.chineseKeywords.finalAnswer,
      ...this.englishKeywords.finalAnswer,
    ];

    for (const keyword of allFinalAnswerKeywords) {
      // 创建大小写不敏感的正则表达式
      const regex = new RegExp(`^\\s*${keyword}\\s*[:：]\\s*(.*)$`, 'im');
      const match = text.match(regex);
      if (match) {
        return match[1];
      }

      // 尝试匹配在文本中间的情况
      const multiLineRegex = new RegExp(`(?:^|\\n)\\s*${keyword}\\s*[:：]\\s*(.*)(?:\\n|$)`, 'im');
      const multiLineMatch = text.match(multiLineRegex);
      if (multiLineMatch) {
        return multiLineMatch[1];
      }
    }

    return null;
  }

  /**
   * 提取动作和动作输入
   */
  private extractAction(text: string): { action: string; actionInput: string } | null {
    // 尝试中文格式
    const chineseAction = this.extractActionByLanguage(text, 'chinese');
    if (chineseAction) {
      return chineseAction;
    }

    // 尝试英文格式
    const englishAction = this.extractActionByLanguage(text, 'english');
    if (englishAction) {
      return englishAction;
    }

    return null;
  }

  /**
   * 按语言提取动作
   */
  private extractActionByLanguage(
    text: string,
    language: 'chinese' | 'english'
  ): { action: string; actionInput: string } | null {
    const keywords = language === 'chinese' ? this.chineseKeywords : this.englishKeywords;

    let action = '';
    let actionInput = '';

    // 提取动作
    for (const actionKeyword of keywords.action) {
      const actionRegex = new RegExp(`(?:^|\\n)\\s*${actionKeyword}\\s*[:：]\\s*([^\\n]+)`, 'im');
      const actionMatch = text.match(actionRegex);
      if (actionMatch) {
        action = actionMatch[1].trim();
        break;
      }
    }

    // 提取动作输入
    for (const inputKeyword of keywords.actionInput) {
      const inputRegex = new RegExp(`(?:^|\\n)\\s*${inputKeyword}\\s*[:：]\\s*([^\\n]+)`, 'im');
      const inputMatch = text.match(inputRegex);
      if (inputMatch) {
        actionInput = inputMatch[1].trim();
        break;
      }
    }

    // 如果找到了动作但没找到动作输入，尝试更宽松的匹配
    if (action && !actionInput) {
      // 查找动作行之后的内容作为输入
      for (const actionKeyword of keywords.action) {
        const actionRegex = new RegExp(
          `(?:^|\\n)\\s*${actionKeyword}\\s*[:：]\\s*${action}\\s*(?:\\n|$)([^\\n]+)`,
          'im'
        );
        const inputMatch = text.match(actionRegex);
        if (inputMatch) {
          actionInput = inputMatch[1].trim();
          break;
        }
      }
    }

    return action && actionInput ? { action, actionInput } : null;
  }

  /**
   * 解析器类型标识
   */
  _type(): string {
    return 'qwen_react_output_parser';
  }
}
